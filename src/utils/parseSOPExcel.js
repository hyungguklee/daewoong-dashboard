// SOP 현황 엑셀 파서
import * as XLSX from 'xlsx';

function num(v) {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}
function str(v) {
  return v == null ? '' : String(v).trim();
}

function detectPeriod(filename) {
  const m = filename.match(/(\d{2})[.년]\s*(\d{1,2})\s*월/);
  if (m) return `${m[1]}년 ${m[2].padStart(2, '0')}월`;
  const now = new Date();
  return `${String(now.getFullYear()).slice(2)}년 ${String(now.getMonth()+1).padStart(2, '0')}월`;
}

/**
 * SOP평가 시트 파싱 (Tab1 데이터)
 * 헤더 row 19/20, 데이터는 row 21+ 부터
 *
 * 컬럼:
 *  [1]: No
 *  [2]: 평가 (최종평가 / 2.조기성공평가(1차) / 2.조기성공평가(3차) / 3. 평가전)
 *  [3]: 기수
 *  [4]: 발족
 *  [5]: 최종평가 실적월
 *  [6]: 종별 (병원/로컬)
 *  [7]: 사업부, [8]: 사무소
 *  [9]: 사번, [10]: 담당자
 *  [11]: SOP과제
 *  [12]: 분신, [13]: 성공분신, [14]: KPI달성, [15]: 상위30%
 *  [16]: 정량평가, [17]: 정성(월별피드백) — "Drop" 포함 여부 체크
 *  [18]: 최종결과
 */
function parseSOPSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // 헤더 행 찾기: r[1]이 "No"인 행
  let headerIdx = -1;
  for (let i = 0; i < Math.min(40, rows.length); i++) {
    if (str(rows[i][1]) === 'No') { headerIdx = i; break; }
  }
  if (headerIdx < 0) {
    console.error('[parseSOP] SOP평가 헤더 행을 찾을 수 없음');
    return [];
  }
  const dataStart = headerIdx + 2; // 헤더 2줄 + 데이터

  const list = [];
  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r.some(c => c !== '')) continue;
    const no = num(r[1]);
    if (!no) continue;
    const evalType = str(r[2]);
    if (!evalType) continue;

    // 평가 stage 판별
    let stage = '평가전';
    if (evalType.includes('최종평가')) stage = '최종평가';
    else if (evalType.includes('조기성공')) stage = '조기성공';

    // Drop 위험: 정성평가에 'Drop' 포함
    const qualText = str(r[17]) + ' ' + str(r[19]);
    const isDrop = /drop/i.test(qualText);

    list.push({
      no,
      evalType,
      stage,
      gen: str(r[3]),
      foundMonth: str(r[4]),
      evalMonth: str(r[5]),
      type: str(r[6]),                    // 병원 / 로컬
      division: str(r[7]),
      office: str(r[8]),
      sano: str(r[9]),
      name: str(r[10]),
      topic: str(r[11]),
      bunsin: num(r[12]),
      successBunsin: num(r[13]),
      kpiAchieve: num(r[14]),
      top30: num(r[15]),
      isDrop,
      result: str(r[18]),                 // SOP 성공 / SOP 미달성 / 익월 재평가 등
    });
  }
  console.log(`[parseSOP] SOP평가: ${list.length}건`);
  return list;
}

/**
 * 분신현황 시트 파싱 (Tab2 데이터)
 * 헤더 row 5, 데이터 row 6+
 *
 * 컬럼:
 *  [0]: 기수
 *  [1]: 발족
 *  [2]: 최종평가 실적월
 *  [3]: 본부 (1.병원 / 2.로컬)
 *  [4]: 리더 사업부, [5]: 리더 사무소
 *  [6]: 사번, [7]: 리더 담당자
 *  [8]: SOP과제
 *  [9]: 분신 사업부, [10]: 분신 사무소
 *  [11]: 사번, [12]: 분신 담당자
 *  [13]: KPI
 *  [16~31]: 월별 실적 (정성평가 KEY 25.02~25.07, SOP평가 25.06~26.02 등)
 *  [32]: 기준점(발족월 직전 3개월), [33]: 평가(마감실적월 포함-3개월), [34]: 성장금액
 *  [35]: KPI달성, [36]: 상위00%, [37]: 상위30%달성여부, [38]: SOP
 */
function parseBunsinSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // 헤더 행 찾기: r[0]이 "기수"인 행
  let headerIdx = -1;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    if (str(rows[i][0]) === '기수') { headerIdx = i; break; }
  }
  if (headerIdx < 0) headerIdx = 5;
  const dataStart = headerIdx + 1;

  // 월별 컬럼 헤더 추출 (정성평가 6개월 + SOP평가 9개월)
  const monthHeaders = {
    quality: [16, 17, 18, 19, 20, 21].map(c => str(rows[headerIdx][c])).filter(Boolean),
    sop: [23, 24, 25, 26, 27, 28, 29, 30, 31].map(c => {
      const v = rows[headerIdx][c];
      return typeof v === 'number' ? v.toFixed(2) : str(v);
    }).filter(Boolean),
  };

  const list = [];
  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r.some(c => c !== '')) continue;
    const gen = str(r[0]);
    if (!gen.includes('기')) continue;

    list.push({
      gen,
      foundMonth: str(r[1]),
      evalMonth: str(r[2]),
      hq: str(r[3]),
      leaderDiv: str(r[4]),
      leaderOffice: str(r[5]),
      leader: str(r[7]),
      topic: str(r[8]),
      bunsinDiv: str(r[9]),
      bunsinOffice: str(r[10]),
      bunsin: str(r[12]),
      kpi: num(r[13]),
      qualityMonthly: [16, 17, 18, 19, 20, 21].map(c => num(r[c])),  // 6개월 정성평가
      sopMonthly:     [23, 24, 25, 26, 27, 28, 29, 30, 31].map(c => num(r[c])),  // 9개월 SOP 평가
      ref3mo: num(r[32]),
      eval3mo: num(r[33]),
      growth: num(r[34]),
      kpiAchieve: str(r[35]),
      top30pct: num(r[36]),
      top30: str(r[37]),
      sopResult: str(r[38]),
    });
  }
  console.log(`[parseSOP] 분신현황: ${list.length}건`);
  return { rows: list, monthHeaders };
}

export async function parseSOPExcelFile(file) {
  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const sopSheet = wb.Sheets[wb.SheetNames.find(n => n.includes('SOP평가')) || wb.SheetNames[0]];
    const bunsinSheet = wb.Sheets[wb.SheetNames.find(n => n.includes('분신')) || wb.SheetNames[1]];
    if (!sopSheet) throw new Error('SOP평가 시트를 찾을 수 없습니다');

    const period = detectPeriod(file.name);
    const sopRows = parseSOPSheet(sopSheet);
    const bunsinData = bunsinSheet ? parseBunsinSheet(bunsinSheet) : { rows: [], monthHeaders: {} };

    return {
      period,
      sopRows,
      bunsinRows: bunsinData.rows,
      monthHeaders: bunsinData.monthHeaders,
      uploadedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[parseSOPExcelFile] 오류:', err);
    throw err;
  }
}
