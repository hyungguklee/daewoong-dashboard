// 풀동도 평가 엑셀 파서 (병원/로컬 공용)
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
  const m = filename.match(/(\d{2})[.년]\s*(\d{1,2})\s*월/);
  if (m) return `${m[1]}년 ${m[2].padStart(2, '0')}월`;
  const now = new Date();
  return `${String(now.getFullYear()).slice(2)}년 ${String(now.getMonth()+1).padStart(2, '0')}월`;
}

/**
 * 풀동도 첫 시트 컬럼 (병원/로컬 동일):
 * [1]:사업부 [2]:사무소 [3]:소장명 [4]:평가인원
 * [5]:3월 풀동도 평가 (F열, 최종등급) [6]:평가 점수
 * [7]:고객수(병원)/품목수(로컬) [8]:MBO 총액
 * [9]:약속 총금액 [10]:약속 인당평균 [11]:약속 %
 * [12]:확인 총금액 [13]:확인 인당평균 [14]:확인 %
 * [15]:확인율 평가 [16]:(blank) [17]:일치 성장금액 [18]:일치율 [19]:일치율 평가
 *
 * 본부 계 행: col[1] === '병원본부 계' 또는 '로컬 본부 계' (또는 포함)
 */
function parseSummarySheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // 헤더 행 찾기: r[1] === '사업부' 이고 r[2] === '사무소'
  let headerIdx = -1;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    if (str(rows[i][1]) === '사업부' && str(rows[i][2]) === '사무소') {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) {
    console.error('[parsePuldongdo] 헤더 행을 못 찾음');
    return { total: null, offices: [] };
  }
  // 헤더는 보통 2행 (10/11 또는 9/10). 데이터는 그 다음부터.
  const dataStart = headerIdx + 2;

  const parseRow = (r) => ({
    division:    str(r[1]),
    office:      str(r[2]),
    manager:     str(r[3]),
    evalCount:   num(r[4]),
    finalGrade:  gradeKey(r[5]),
    finalScore:  num(r[6]),
    itemCount:   num(r[7]),
    mbo:         num(r[8]),
    commitTotal: num(r[9]),
    commitPerHead: num(r[10]),
    commitRate:  pct(r[11]),
    confirmTotal: num(r[12]),
    confirmPerHead: num(r[13]),
    confirmRate: pct(r[14]),
    confirmGrade: gradeKey(r[15]),
    growthAmount: num(r[17]),
    matchRate:   pct(r[18]),
    matchGrade:  gradeKey(r[19]),
    errorRate:   num(r[19]) !== 0 ? 0 : 0,  // not directly given
  });

  let total = null;
  const offices = [];
  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r.some(c => c !== '')) continue;
    const c1 = str(r[1]);
    if (!c1) continue;

    // 본부 계 row
    if (c1.includes('본부 계') || c1.includes('병원본부 계') || c1.includes('로컬 본부 계')) {
      total = { name: c1, ...parseRow(r) };
      continue;
    }

    // 사업부에 의미있는 값이 들어가있어야 사무소 행 (예외 처리)
    const office = str(r[2]);
    if (!office) continue;
    offices.push(parseRow(r));
  }

  console.log(`[parsePuldongdo] total=${!!total}, offices=${offices.length}`);
  return { total, offices };
}

export async function parsePuldongdoExcelFile(file) {
  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    if (!firstSheet) throw new Error('시트가 없습니다');

    const period = detectPeriod(file.name);
    const { total, offices } = parseSummarySheet(firstSheet);

    // 타입 감지: 본부 계 행 이름 또는 파일명
    const isLocal = /로컬/.test(file.name) || /로컬/.test(total?.name || '');
    const type = isLocal ? 'local' : 'hospital';

    return {
      type,
      period,
      total,
      offices,
      uploadedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[parsePuldongdoExcelFile] 오류:', err);
    throw err;
  }
}
