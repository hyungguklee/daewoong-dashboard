// MBO시스템 평가 엑셀 파서 (병원/로컬 공용)
import * as XLSX from 'xlsx';

function num(v) {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}
function pct(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Math.round(v * 10000) / 10000;
  const s = String(v).trim();
  if (s.includes('100%')) return 1;
  if (s === '-' || s === '') return 0;
  const n = parseFloat(s.replace('%', ''));
  return isNaN(n) ? 0 : Math.round(n * (s.includes('%') ? 1 : 100) * 100) / 10000;
}
function gradeKey(g) {
  if (!g || g === '-' || g === '') return null;
  return String(g).trim().toUpperCase();
}
function str(v) {
  return v == null ? '' : String(v).trim();
}
function detectPeriod(filename) {
  const m = filename.match(/(\d{1,2})\s*월/);
  if (m) {
    const now = new Date();
    return `${String(now.getFullYear()).slice(2)}년 ${m[1].padStart(2, '0')}월`;
  }
  const now = new Date();
  return `${String(now.getFullYear()).slice(2)}년 ${String(now.getMonth()+1).padStart(2, '0')}월`;
}

/**
 * 사업부/사무소 시트 파싱
 * 병원: col [1]=사업부 [2]=사무소 [3]=담당자 [4]=기준실적 [5]=MBO [6]=MBO수립율 [7]=평가
 *       [8]=약속 [9]=총확인 [10]=1000↑확인 [11]=확인율 [12]=평가
 *       [13]=일치율 [14]=오차율 [15]=평가
 * 로컬: col [1]=사업부 [2]=사무소 [3]=담당자 [4]=MBO [5]=약속 [6]=약속율 [7]=평가
 *       [8]=확인 [9]=확인율 [10]=평가
 *       [11]=미확인건수 [12]=기준실적 [13]=당월실적 [14]=성장금액
 *       [15]=일치율 [16]=오차율 [17]=평가
 */
function parseSummary(ws, type) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // 사업부/사무소 시작 인덱스 찾기
  let divStart = -1, divEnd = -1, officeStart = -1, officeEnd = -1;
  for (let i = 0; i < rows.length; i++) {
    const c1 = str(rows[i][1]);
    if (c1.includes('■ 사업부')) divStart = i + 3;
    else if (c1.includes('■ 사무소')) {
      divEnd = i;
      officeStart = i + 3;
    }
  }
  if (officeEnd < 0) officeEnd = rows.length;

  // 행 파싱 (사업부/사무소 공통)
  const parseRow = (r) => {
    if (type === 'hospital') {
      return {
        baseAmount:   num(r[4]),
        mbo:          num(r[5]),
        mainRate:     pct(r[6]),     // MBO수립율
        mainGrade:    gradeKey(r[7]),
        commit:       num(r[8]),     // 약속
        confirm:      num(r[9]),     // 총 확인
        confirm1000:  num(r[10]),    // 1000↑ 확인
        confirmRate:  pct(r[11]),
        confirmGrade: gradeKey(r[12]),
        matchRate:    pct(r[13]),    // 일치율
        errorRate:    pct(r[14]),
        matchGrade:   gradeKey(r[15]),
        finalGrade:   gradeKey(r[20]), // U열 = 최종평가
      };
    } else {
      const m = gradeKey(r[17]);  // R열 = 최종평가 (= 일치 평가)
      return {
        mbo:          num(r[4]),
        commit:       num(r[5]),
        mainRate:     pct(r[6]),     // 약속율
        mainGrade:    gradeKey(r[7]),
        confirm:      num(r[8]),
        confirmRate:  pct(r[9]),
        confirmGrade: gradeKey(r[10]),
        unverified:   num(r[11]),    // 미확인 건수
        baseAmount:   num(r[12]),    // 기준실적
        currAmount:   num(r[13]),    // 당월 실적
        growthAmount: num(r[14]),
        matchRate:    pct(r[15]),
        errorRate:    pct(r[16]),
        matchGrade:   m,
        finalGrade:   m,
      };
    }
  };

  const divisions = [];
  const offices = [];
  let total = null;

  // 사업부 영역
  if (divStart > 0) {
    for (let i = divStart; i < (divEnd > 0 ? divEnd : rows.length); i++) {
      const r = rows[i];
      if (!r || !r.some(c => c !== '')) continue;
      const name = str(r[1]);
      if (!name) continue;
      const mgr = str(r[2]);
      // 본부 행(병원/로컬): 마지막 행
      const isTotal = name === '병원' || name === '로컬';
      const base = parseRow(r);
      const obj = { name, manager: mgr, ...base };
      if (isTotal) total = obj;
      else divisions.push(obj);
    }
  }

  // 사무소 영역
  if (officeStart > 0) {
    for (let i = officeStart; i < officeEnd; i++) {
      const r = rows[i];
      if (!r || !r.some(c => c !== '')) continue;
      const div = str(r[1]);
      const office = str(r[2]);
      const mgr = str(r[3]);
      if (!div || !office) continue;
      offices.push({ division: div, office, manager: mgr, ...parseRow(r) });
    }
  }

  return { total, divisions, offices };
}

/**
 * MR 시트 파싱
 * 병원MR: [1]본부 [2]사업부 [3]사무소 [4]담당자 [5]신사번 [6]사번 [7]기준실적 [8]MBO [9]MBO수립율 [10]평가
 *         [11]약속 [12]총확인 [13]1000↑확인 [14]확인율 [15]평가 [16]일치율 [17]오차율 [18]평가
 * 로컬MR: [0]본부 [1]사업부 [2]사무소 [3]담당자 [4]신사번 [5]사번 [6]MBO [7]약속 [8]약속율 [9]평가
 *         [10]확인 [11]확인율 [12]평가 [13]미확인 [14]기준실적 [15]당월실적 [16]성장금액 [17]일치율 [18]오차율 [19]평가
 */
function parseMR(ws, type) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // 헤더 찾기: 본부 컬럼이 있는 행
  let headerIdx = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const r = rows[i];
    const c0 = str(r[0]);
    const c1 = str(r[1]);
    if (c0 === '본부' || c1 === '본부') { headerIdx = i; break; }
  }
  if (headerIdx < 0) {
    console.warn('[parseMBO MR] 헤더 행을 찾을 수 없음');
    return [];
  }
  const dataStart = headerIdx + 1;

  // 본부 컬럼 위치
  const hqColOffset = str(rows[headerIdx][0]) === '본부' ? 0 : 1;

  const list = [];
  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r.some(c => c !== '')) continue;
    const hq = str(r[hqColOffset]);
    const division = str(r[hqColOffset + 1]);
    const office = str(r[hqColOffset + 2]);
    const manager = str(r[hqColOffset + 3]);
    if (!office || !manager) continue;

    const base = hqColOffset; // 0(local) or 1(hospital)
    if (type === 'hospital') {
      // hq=r[1], div=r[2], office=r[3], manager=r[4], 신사번=r[5], 사번=r[6], 기준실적=r[7], MBO=r[8]...
      // X열(col 23) = 최종평가 → base + 22 (with base=1)
      list.push({
        hq, division, office, manager,
        sano: str(r[base + 5]),       // 사번
        baseAmount: num(r[base + 6]), // 기준실적
        mbo: num(r[base + 7]),
        mainRate: pct(r[base + 8]),
        mainGrade: gradeKey(r[base + 9]),
        commit: num(r[base + 10]),
        confirm: num(r[base + 11]),
        confirm1000: num(r[base + 12]),
        confirmRate: pct(r[base + 13]),
        confirmGrade: gradeKey(r[base + 14]),
        matchRate: pct(r[base + 15]),
        errorRate: pct(r[base + 16]),
        matchGrade: gradeKey(r[base + 17]),
        finalGrade: gradeKey(r[base + 22]),  // X열 (col 23 with base=1)
      });
    } else {
      // hq=r[0], div=r[1], office=r[2], manager=r[3], sano=r[5], MBO=r[6]...
      // T열(col 19) = 최종평가 = 일치평가 → base + 19 (with base=0)
      const m = gradeKey(r[base + 19]);
      list.push({
        hq, division, office, manager,
        sano: str(r[base + 5]),
        mbo: num(r[base + 6]),
        commit: num(r[base + 7]),
        mainRate: pct(r[base + 8]),
        mainGrade: gradeKey(r[base + 9]),
        confirm: num(r[base + 10]),
        confirmRate: pct(r[base + 11]),
        confirmGrade: gradeKey(r[base + 12]),
        unverified: num(r[base + 13]),
        baseAmount: num(r[base + 14]),
        currAmount: num(r[base + 15]),
        growthAmount: num(r[base + 16]),
        matchRate: pct(r[base + 17]),
        errorRate: pct(r[base + 18]),
        matchGrade: m,
        finalGrade: m,
      });
    }
  }
  return list;
}

export async function parseMBOExcelFile(file) {
  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });

    // 시트 타입 감지: 첫 시트 이름으로
    const sheets = wb.SheetNames;
    const summaryName = sheets.find(n => n.includes('사업부')) || sheets[0];
    const mrName = sheets.find(n => n === '병원MR' || n === '로컬MR') || sheets[1];
    const type = summaryName.includes('병원') || mrName === '병원MR' ? 'hospital' : 'local';

    const summary = parseSummary(wb.Sheets[summaryName], type);
    const mrs = mrName ? parseMR(wb.Sheets[mrName], type) : [];

    const period = detectPeriod(file.name);
    console.log(`[parseMBO] type=${type}, period=${period}, divisions=${summary.divisions.length}, offices=${summary.offices.length}, MR=${mrs.length}`);

    return {
      type,
      period,
      total: summary.total,
      divisions: summary.divisions,
      offices: summary.offices,
      mrs,
      uploadedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[parseMBOExcelFile] 오류:', err);
    throw err;
  }
}
