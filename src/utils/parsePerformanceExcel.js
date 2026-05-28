// 로컬본부 실적 엑셀 파서 (.xlsb 지원)
// 시트: 사업부별 / 담당자별 / 거래처별
import * as XLSX from 'xlsx';

const num = v => v == null || v === '' ? 0 : (typeof v === 'number' ? v : (parseFloat(String(v).replace(/,/g, '')) || 0));
const str = v => v == null ? '' : String(v).trim();

function detectPeriod(filename) {
  // "26년03월", "2026.03월", "2026-03" 등 다양한 형식 대응
  const m = String(filename).match(/(\d{2,4})\s*[.\-년]\s*0?(\d{1,2})\s*월?/);
  if (m) {
    const yy = m[1].slice(-2);
    return `${yy}년 ${m[2].padStart(2, '0')}월`;
  }
  const now = new Date();
  return `${String(now.getFullYear()).slice(2)}년 ${String(now.getMonth()+1).padStart(2, '0')}월`;
}

// 사업부별 시트: 사업부 섹션 + 사무소 섹션
function parseDivisionSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  let divHeader = -1, officeHeader = -1;
  for (let i = 0; i < rows.length; i++) {
    if (str(rows[i][0]) === '사업부') {
      if (str(rows[i][1]) === '사무소') officeHeader = i;
      else if (divHeader < 0) divHeader = i;
    }
  }

  const rowVals = r => ({
    base: num(r[2]),
    sales: num(r[3]),
    growth: num(r[4]),
    growthRate: num(r[5]),
  });

  const divisions = [];
  let total = null;
  if (divHeader >= 0) {
    for (let i = divHeader + 1; i < (officeHeader > 0 ? officeHeader : rows.length); i++) {
      const r = rows[i];
      if (!r || !r.some(c => c !== '')) continue;
      const name = str(r[0]);
      if (!name) continue;
      if (name.includes('계')) { total = { name, ...rowVals(r) }; continue; }
      divisions.push({ name, ...rowVals(r) });
    }
  }

  const offices = [];
  if (officeHeader >= 0) {
    for (let i = officeHeader + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r.some(c => c !== '')) continue;
      const division = str(r[0]);
      const office = str(r[1]);
      if (!division || !office) continue;
      if (division.includes('계')) continue;
      offices.push({ division, office, ...rowVals(r) });
    }
  }

  return { total, divisions, offices };
}

// 담당자별 시트
function parseRepSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  let header = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    if (str(rows[i][0]) === '사업부' && str(rows[i][3]) === '담당자') { header = i; break; }
  }
  if (header < 0) return [];

  const reps = [];
  for (let i = header + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r.some(c => c !== '')) continue;
    const office = str(r[1]);
    const name = str(r[3]);
    if (!office || !name) continue;
    reps.push({
      division: str(r[0]),
      office,
      sano: str(r[2]),
      name,
      base: num(r[4]),
      sales: num(r[5]),
      growth: num(r[6]),
      growthRate: num(r[7]),
    });
  }
  return reps;
}

// 거래처별 시트 → 사번(sano)별로 그룹핑 [거래처명, 최종실적]
function parseClientSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  let header = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    if (str(rows[i][0]) === '사업부' && str(rows[i][9]).includes('거래처명')) { header = i; break; }
  }
  if (header < 0) return {};

  const bySano = {};
  for (let i = header + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r.some(c => c !== '')) continue;
    const sano = str(r[2]);
    const clientName = str(r[9]);
    if (!sano || !clientName) continue;
    const sales = Math.round(num(r[10]));
    if (!bySano[sano]) bySano[sano] = [];
    bySano[sano].push({ n: clientName, s: sales });  // {거래처명, 최종실적} — Firestore 중첩배열 방지
  }
  return bySano;
}

// ─── 병원 형식: 성장평가 시트(담당자 단위) → 집계 ─────────────────────────────
// 성장평가 컬럼: [0]사업부 [1]사무소 [2]사번 [3]담당자 [4]제약기준점 ... [12]최종실적 [13]제약성장금액
function parseHospitalGrowthSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  let header = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    if (str(rows[i][0]) === '사업부' && str(rows[i][3]) === '담당자') { header = i; break; }
  }
  if (header < 0) return [];
  const dataStart = header + 2; // 헤더 2줄(사업부.. / 제약기준점..)

  const reps = [];
  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r.some(c => c !== '')) continue;
    const office = str(r[1]);
    const name = str(r[3]);
    if (!office || !name) continue;
    const base = num(r[4]);    // 제약 기준점
    const sales = num(r[12]);  // 최종실적
    reps.push({
      division: str(r[0]),
      office,
      sano: str(r[2]),
      name,
      base,
      sales,
      growth: sales - base,
      growthRate: base ? (sales - base) / base : 0,
    });
  }
  return reps;
}

// 병원 거래처별: [1]사업부 [2]사무소 [3]사번 [4]담당자 [9]거래처명 [12]최종실적(교차판매후)
function parseHospitalClientSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  let header = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    if (str(rows[i][1]) === '사업부' && str(rows[i][9]).includes('거래처명')) { header = i; break; }
  }
  if (header < 0) return {};
  const dataStart = header + 2;

  const bySano = {};
  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r.some(c => c !== '')) continue;
    const sano = str(r[3]);
    const clientName = str(r[9]);
    if (!sano || !clientName) continue;
    const sales = Math.round(num(r[12]));
    if (!bySano[sano]) bySano[sano] = [];
    bySano[sano].push({ n: clientName, s: sales });
  }
  return bySano;
}

// 담당자(reps) → 사무소 / 사업부 / 본부 집계
function aggregateReps(reps, totalName) {
  const rollup = (keyFn, nameFn) => {
    const map = {};
    reps.forEach(r => {
      const k = keyFn(r);
      if (!map[k]) map[k] = { ...nameFn(r), base: 0, sales: 0 };
      map[k].base += r.base;
      map[k].sales += r.sales;
    });
    return Object.values(map).map(o => ({
      ...o,
      growth: o.sales - o.base,
      growthRate: o.base ? (o.sales - o.base) / o.base : 0,
    }));
  };
  const offices = rollup(r => r.division + '|' + r.office, r => ({ division: r.division, office: r.office }));
  const divisions = rollup(r => r.division, r => ({ name: r.division }));
  const tBase = reps.reduce((a, r) => a + r.base, 0);
  const tSales = reps.reduce((a, r) => a + r.sales, 0);
  const total = { name: totalName, base: tBase, sales: tSales, growth: tSales - tBase, growthRate: tBase ? (tSales - tBase) / tBase : 0 };
  return { total, divisions, offices };
}

export async function parsePerformanceExcelFile(file) {
  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const names = wb.SheetNames;
    const period = detectPeriod(file.name);

    // ── 로컬 형식: '사업부별' 시트 존재 ──
    if (names.some(n => n.includes('사업부'))) {
      const divName = names.find(n => n.includes('사업부'));
      const repName = names.find(n => n.includes('담당자'));
      const clientName = names.find(n => n.includes('거래처'));
      const { total, divisions, offices } = parseDivisionSheet(wb.Sheets[divName]);
      const reps = repName ? parseRepSheet(wb.Sheets[repName]) : [];
      const clientsBySano = clientName ? parseClientSheet(wb.Sheets[clientName]) : {};
      console.log(`[parsePerformance:local] period=${period}, div=${divisions.length}, off=${offices.length}, reps=${reps.length}`);
      return { type: 'local', period, total, divisions, offices, reps, clientsBySano, uploadedAt: new Date().toISOString() };
    }

    // ── 병원 형식: '성장평가' 시트 존재 → 담당자 집계 ──
    const growthName = names.find(n => n.includes('성장평가'));
    const clientName = names.find(n => n.includes('거래처'));
    if (!growthName) throw new Error('인식할 수 없는 엑셀 형식입니다 (사업부별 또는 성장평가 시트 필요)');
    const reps = parseHospitalGrowthSheet(wb.Sheets[growthName]);
    const { total, divisions, offices } = aggregateReps(reps, '병원본부');
    const clientsBySano = clientName ? parseHospitalClientSheet(wb.Sheets[clientName]) : {};
    console.log(`[parsePerformance:hospital] period=${period}, div=${divisions.length}, off=${offices.length}, reps=${reps.length}`);
    return { type: 'hospital', period, total, divisions, offices, reps, clientsBySano, uploadedAt: new Date().toISOString() };
  } catch (err) {
    console.error('[parsePerformanceExcelFile] 오류:', err);
    throw err;
  }
}
