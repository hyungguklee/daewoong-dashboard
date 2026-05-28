// 고객단계 평가 엑셀 파서 (병원/로컬 공용)
import * as XLSX from 'xlsx';

const num = v => v == null || v === '' ? 0 : (typeof v === 'number' ? v : (parseFloat(String(v).replace(/,/g, '')) || 0));
const gradeKey = g => (!g || g === '-' || g === '') ? null : String(g).trim().toUpperCase();
const str = v => v == null ? '' : String(v).trim();

function detectPeriod(filename) {
  const m = filename.match(/(\d{2})[.년]\s*(\d{1,2})\s*월/);
  if (m) return `${m[1]}년 ${m[2].padStart(2, '0')}월`;
  const now = new Date();
  return `${String(now.getFullYear()).slice(2)}년 ${String(now.getMonth()+1).padStart(2, '0')}월`;
}

/**
 * 사업부/사무소 시트 컬럼 (병원/로컬 동일):
 * [0]:사업부(or 사무소 in office section) [1]:사무소(or manager) [2]:소장(in office section)
 * [3]:T.O [4]:총 고객
 * [5]:25년12월 4단계↑ 고객수 [6]:25년12월 4단계↑ 인당
 * [7]:26년3월 4단계↑ 고객수 [9]:26년3월 4단계↑ 인당
 * [10]:고객단계변화 수 [11]:고객단계변화 인당
 * [12]:평가 등급 (S/A/B/C) — 최종
 * [13]:3단계 고객수 [14]:3단계 비율
 * [15]:2단계 고객수 [16]:2단계 비율
 * [17]:1단계 고객수
 */
function parseSummary(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // 섹션 시작 찾기
  let divStart = -1, divEnd = -1, officeStart = -1;
  for (let i = 0; i < rows.length; i++) {
    const c0 = str(rows[i][0]);
    if (c0.includes('■ 사업부')) divStart = i + 6;     // 사업부 헤더 + 부제목 + 5행 헤더
    else if (c0.includes('■ 사무소')) { divEnd = i; officeStart = i + 6; }
  }

  // 사업부 데이터 패스 (사업부명, 담당자, T.O ..., 평가)
  const parseDivRow = r => ({
    name: str(r[0]),
    manager: str(r[1]),
    to:        num(r[3]),
    custTotal: num(r[4]),
    prevCount: num(r[5]),
    prevPer:   num(r[6]),
    curCount:  num(r[7]),
    curPer:    num(r[9]),
    chgCount:  num(r[10]),
    chgPer:    num(r[11]),
    grade:     gradeKey(r[12]),
    stage3:    num(r[13]),
    stage2:    num(r[15]),
    stage1:    num(r[17]),
  });
  const parseOfficeRow = r => ({
    division: str(r[0]),
    office:   str(r[1]),
    manager:  str(r[2]),
    to:        num(r[3]),
    custTotal: num(r[4]),
    prevCount: num(r[5]),
    prevPer:   num(r[6]),
    curCount:  num(r[7]),
    curPer:    num(r[9]),
    chgCount:  num(r[10]),
    chgPer:    num(r[11]),
    grade:     gradeKey(r[12]),
    stage3:    num(r[13]),
    stage2:    num(r[15]),
    stage1:    num(r[17]),
  });

  const divisions = [];
  let total = null;
  if (divStart > 0) {
    for (let i = divStart; i < (divEnd > 0 ? divEnd : rows.length); i++) {
      const r = rows[i];
      if (!r || !r.some(c => c !== '')) continue;
      const c0 = str(r[0]);
      if (!c0) continue;
      const isTotal = c0.includes('병원 계') || c0.includes('로컬 계') || c0.includes('본부 계');
      if (isTotal) { total = { name: c0, ...parseDivRow(r) }; continue; }
      if (c0.startsWith('※')) continue;
      divisions.push(parseDivRow(r));
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
      if (c0.includes('계')) continue;
      offices.push(parseOfficeRow(r));
    }
  }

  return { total, divisions, offices };
}

/**
 * MR 시트 파싱.
 * 병원 MR (23 cols): [5]25년4↑ [6]25-4 [7]25-5 [8]26년3월 [9]비율 [10]4 [11]5 [12]6 [13]평가 [14]변화 [15]3 [17]2 [19]1
 * 로컬 MR (24 cols): 25년6단계 col 추가로 +1 시프트
 *   [5]25년4↑ [6]25-4 [7]25-5 [8]25-6 [9]26년3월 [10]비율 [11]4 [12]5 [13]6 [14]평가 [15]변화 [16]3 [18]2 [20]1
 */
function parseMR(ws, type) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const isLocal = type === 'local';

  // 헤더 찾기: r[0]='사업부' 인 행
  let headerIdx = -1;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    if (str(rows[i][0]) === '사업부') { headerIdx = i; break; }
  }
  if (headerIdx < 0) return [];
  const dataStart = headerIdx + 2;

  // 로컬은 25년 6단계 컬럼이 추가되어 +1 시프트
  const off = isLocal ? 1 : 0;

  const list = [];
  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r.some(c => c !== '')) continue;
    const division = str(r[0]);
    const office = str(r[1]);
    const name = str(r[2]);
    if (!division || !office || !name) continue;
    if (division.startsWith('※') || office.startsWith('※')) continue;

    list.push({
      division, office, name,
      sano: str(r[3]),
      custTotal:  num(r[4]),
      prevCount:  num(r[5]),
      prevStage4: num(r[6]),
      prevStage5: num(r[7]),
      prevStage6: isLocal ? num(r[8]) : 0,
      curCount:   num(r[8 + off]),
      curPer:     num(r[9 + off]),
      stage4:     num(r[10 + off]),
      stage5:     num(r[11 + off]),
      stage6:     num(r[12 + off]),
      grade:      gradeKey(r[13 + off]),
      chgCount:   num(r[14 + off]),
      stage3:     num(r[15 + off]),
      stage2:     num(r[17 + off]),
      stage1:     num(r[19 + off]),
    });
  }
  return list;
}

export async function parseCustomerStageExcelFile(file) {
  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const summaryName = wb.SheetNames.find(n => n.includes('사업부') && n.includes('사무소')) || wb.SheetNames[0];
    const mrName = wb.SheetNames.find(n => n.includes('MR')) || wb.SheetNames[1];

    // 타입 감지 (시트명에서)
    const isLocal = /로컬/.test(summaryName) || /로컬/.test(file.name);
    const type = isLocal ? 'local' : 'hospital';

    const summary = parseSummary(wb.Sheets[summaryName]);
    const mrs = mrName ? parseMR(wb.Sheets[mrName], type) : [];

    const period = detectPeriod(file.name);

    // MR 기반으로 4/5/6단계 본부 총합 계산
    const stageBreakdown = mrs.reduce((acc, m) => {
      acc.stage4 += m.stage4 || 0;
      acc.stage5 += m.stage5 || 0;
      acc.stage6 += m.stage6 || 0;
      return acc;
    }, { stage4: 0, stage5: 0, stage6: 0 });

    // 25년 4/5단계 본부 총합도 계산 (변화량 계산용)
    const prevBreakdown = mrs.reduce((acc, m) => {
      acc.stage4 += m.prevStage4 || 0;
      acc.stage5 += m.prevStage5 || 0;
      return acc;
    }, { stage4: 0, stage5: 0 });

    console.log(`[parseCustomerStage] type=${type}, divisions=${summary.divisions.length}, offices=${summary.offices.length}, MR=${mrs.length}, stage4=${stageBreakdown.stage4}`);

    return {
      type,
      period,
      total: summary.total,
      divisions: summary.divisions,
      offices: summary.offices,
      mrs,
      stageBreakdown,   // 현재월 4/5/6단계
      prevBreakdown,    // 전년 4/5단계 (6단계는 전년 데이터 없음)
      uploadedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[parseCustomerStageExcelFile] 오류:', err);
    throw err;
  }
}
