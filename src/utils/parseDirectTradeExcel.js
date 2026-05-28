// 직거래 평가 엑셀 파서 (병원/로컬 공용)
import * as XLSX from 'xlsx';

const num = v => v == null || v === '' ? 0 : (typeof v === 'number' ? v : (parseFloat(String(v).replace(/,/g, '')) || 0));
const pct = v => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Math.round(v * 10000) / 10000;
  const s = String(v).trim();
  if (s === '-' || s === '') return 0;
  const n = parseFloat(s.replace('%', ''));
  return isNaN(n) ? 0 : Math.round(n * (s.includes('%') ? 1 : 100) * 100) / 10000;
};
const gradeKey = g => (!g || g === '-' || g === '') ? null : String(g).trim().toUpperCase();
const str = v => v == null ? '' : String(v).trim();

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
 * 사업부(사무소) 시트 — 병원/로컬 동일 구조
 *
 * 컬럼:
 * [0]:사업부 (사무소 영역에서는 사업부명) [1]:사무소(사무소 영역) [2]:담당자/소장
 * [3]:연간 기준점 [4]:연간 성장목표 [5]:1분기 성장목표
 * [6]:3월 기준점 대웅 [7]:관계사 [8]:바이오 [9]:한올 [10]:기준점 합계
 * [11]:매출 대웅 [12]:관계사 [13]:바이오 [14]:한올 [15]:매출 합계
 * [16]:성장 목표 [17]:성장금액 [18]:목표 달성률
 * [19]:평가 ← 최종 등급
 * [20]:가동률 목표 [21]:가동률 당월 [22]:가동률 %
 */
function parseSummary(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // "1. 사업부" / "2. 사무소" 마커 찾기
  let divStart = -1, divEnd = -1, officeStart = -1;
  for (let i = 0; i < rows.length; i++) {
    const c0 = str(rows[i][0]);
    if (c0.includes('1. 사업부')) divStart = i + 5;            // 빈행 + 3행 헤더 + 시작
    else if (c0.includes('2. 사무소')) { divEnd = i; officeStart = i + 5; }
  }
  if (divStart < 0) {
    for (let i = 0; i < rows.length; i++) {
      const c0 = str(rows[i][0]);
      if (c0 === '사업부' && str(rows[i][3]) === '연간 ') {
        if (divStart < 0) divStart = i + 3;
        else if (officeStart < 0) { divEnd = i - 2; officeStart = i + 3; }
      }
    }
  }

  const parseRow = (r, isOffice) => ({
    division: str(r[0]),
    office:   isOffice ? str(r[1]) : '',
    manager:  str(r[2]),
    annualBase:   num(r[3]),
    annualGoal:   num(r[4]),
    q1Goal:       num(r[5]),
    baseAmount:   num(r[10]),     // 3월 기준점 합계
    baseDaewoong: num(r[6]),
    baseRelated:  num(r[7]),
    baseBio:      num(r[8]),
    baseHanall:   num(r[9]),
    salesAmount:  num(r[15]),     // 3월 매출 합계
    salesDaewoong: num(r[11]),
    salesRelated:  num(r[12]),
    salesBio:      num(r[13]),
    salesHanall:   num(r[14]),
    growthGoal:   num(r[16]),
    growthAmount: num(r[17]),
    achieveRate:  pct(r[18]),
    grade:        gradeKey(r[19]),
    targetCount:  num(r[20]),
    activeCount:  num(r[21]),
    activeRate:   pct(r[22]),
  });

  const divisions = [];
  let total = null;
  if (divStart > 0) {
    for (let i = divStart; i < (divEnd > 0 ? divEnd : rows.length); i++) {
      const r = rows[i];
      if (!r || !r.some(c => c !== '')) continue;
      const c0 = str(r[0]);
      if (!c0) continue;
      if (c0.startsWith('※')) continue;
      const isTotal = c0.includes('병원본부') || c0.includes('로컬본부') || c0.includes('본부 계');
      if (isTotal) { total = { name: c0, ...parseRow(r, false) }; continue; }
      divisions.push(parseRow(r, false));
    }
  }

  const offices = [];
  if (officeStart > 0) {
    for (let i = officeStart; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r.some(c => c !== '')) continue;
      const c0 = str(r[0]);
      const c1 = str(r[1]);
      if (!c0 || !c1) continue;
      if (c0.startsWith('※')) continue;
      if (c0.includes('본부')) continue;
      offices.push(parseRow(r, true));
    }
  }

  return { total, divisions, offices };
}

/**
 * MR 시트 파싱
 * 병원 MR (col 22 = 평가):
 *   [0]사업부 [1]사무소 [2]사번 [3]담당자
 *   [4]연간기준점 [5]연간성장목표 [6]1분기성장목표
 *   [7-10]기준점 대웅/관계사/바이오/한올 [11]기준점합계
 *   [12-15]매출 대웅/관계사/바이오/한올 [16]매출합계
 *   [17]평가실적 [18]판촉물예산
 *   [19]성장목표 [20]성장금액 [21]목표달성률 [22]평가
 *   [26]가동률목표 [27]가동률당월 [28]가동률%
 *
 * 로컬 MR (col 23 = 평가, +1 시프트):
 *   ... [17]평가실적 [18]판촉물예산 [19]디테일예산
 *   [20]성장목표 [21]성장금액 [22]목표달성률 [23]평가
 *   [24]가동률목표 [25]가동률당월 [26]가동률%
 */
function parseMR(ws, type) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // 헤더 행 찾기: r[0]='사업부' 인 행
  let headerIdx = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    if (str(rows[i][0]) === '사업부') { headerIdx = i; break; }
  }
  if (headerIdx < 0) return [];
  const dataStart = headerIdx + 3;  // 3행 헤더

  // 로컬은 디테일 예산 컬럼이 추가되어 +1 시프트
  const off = type === 'local' ? 1 : 0;

  const list = [];
  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r.some(c => c !== '')) continue;
    const division = str(r[0]);
    const office = str(r[1]);
    const name = str(r[3]);
    if (!division || !office || !name) continue;
    if (division.startsWith('※') || office.startsWith('※')) continue;

    list.push({
      division, office, name,
      sano: str(r[2]),
      annualBase:   num(r[4]),
      annualGoal:   num(r[5]),
      q1Goal:       num(r[6]),
      baseAmount:   num(r[11]),
      baseDaewoong: num(r[7]),
      baseRelated:  num(r[8]),
      baseBio:      num(r[9]),
      baseHanall:   num(r[10]),
      salesAmount:  num(r[16]),
      salesDaewoong: num(r[12]),
      salesRelated:  num(r[13]),
      salesBio:      num(r[14]),
      salesHanall:   num(r[15]),
      perfScore:    num(r[17]),     // 평가실적
      growthGoal:   num(r[19 + off]),
      growthAmount: num(r[20 + off]),
      achieveRate:  pct(r[21 + off]),
      grade:        gradeKey(r[22 + off]),
      targetCount:  num(r[26 + off - 4]),  // off=0 → col 22, off=1 → col 23
      // 가동률 위치는 다름. 병원: 26/27/28, 로컬: 24/25/26
      activeTarget: num(r[type === 'local' ? 24 : 26]),
      activeCount:  num(r[type === 'local' ? 25 : 27]),
      activeRate:   pct(r[type === 'local' ? 26 : 28]),
    });
  }
  return list;
}

export async function parseDirectTradeExcelFile(file) {
  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const summaryName = wb.SheetNames.find(n => n.includes('사업부')) || wb.SheetNames[0];
    const mrName = wb.SheetNames.find(n => n === 'MR' || n.includes('MR')) || wb.SheetNames[1];

    // 타입 감지
    const isLocal = /로컬/.test(file.name);
    const type = isLocal ? 'local' : 'hospital';

    const summary = parseSummary(wb.Sheets[summaryName]);
    const mrs = mrName ? parseMR(wb.Sheets[mrName], type) : [];

    const period = detectPeriod(file.name);
    console.log(`[parseDirectTrade] type=${type}, period=${period}, divisions=${summary.divisions.length}, offices=${summary.offices.length}, MR=${mrs.length}`);

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
    console.error('[parseDirectTradeExcelFile] 오류:', err);
    throw err;
  }
}
