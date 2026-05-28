// 신제품 평가 현황 엑셀 파서 (병원/로컬 공용)
import * as XLSX from 'xlsx';

function num(v) {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}
function pct(v) {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace('%', '')) / 100;
  return isNaN(n) ? 0 : Math.round(n * 10000) / 10000;
}
function gradeKey(g) {
  if (!g || g === '-') return null;
  return String(g).trim().toUpperCase();
}

function detectPeriod(filename) {
  const m = filename.match(/(\d{2})[.년]\s*(\d{1,2})\s*월/);
  if (m) return `${m[1]}년 ${m[2].padStart(2, '0')}월`;
  const now = new Date();
  return `${String(now.getFullYear()).slice(2)}년 ${String(now.getMonth()+1).padStart(2, '0')}월`;
}

// 5개 품목 데이터 추출 (cols 7,10,13,16,19에서 목표/달성/달성율 3개씩)
function extractProducts(r) {
  const products = [];
  for (let p = 0; p < 5; p++) {
    const c = 7 + p * 3;
    products.push({
      target: num(r[c]),
      achieved: num(r[c + 1]),
      rate: pct(r[c + 2]),
    });
  }
  return products;
}

/**
 * 사업부-사무소 시트 파싱
 * - row index 5-7: 헤더 영역 (5: 사업부 columns, 6: 품목명, 7: sub-header 목표/달성/달성율)
 * - "1. 사업부" 이후: 사업부 행들 (col 0=구분, col 1=사업부명, col 2=담당자), 합계로 끝남
 * - "2. 사무소" 이후: 사무소 행들 (col 0=사업부, col 1=사무소명, col 2=담당자), 합계로 끝남
 */
function parseSummary(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // 품목명 추출: "1. 사업부" 헤더 + 2번째 행에 있음 (목표/달성/달성율/평가/엔블로/제미다파/...)
  let productNames = ['', '', '', '', ''];
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim().includes('1. 사업부')) {
      const productRow = rows[i + 2] || [];
      for (let p = 0; p < 5; p++) {
        const name = String(productRow[7 + p * 3] || '').trim();
        productNames[p] = name || `상품${p + 1}`;
      }
      break;
    }
  }

  // 데이터 영역 찾기
  let divStart = -1, divEnd = -1, officeStart = -1, officeEnd = -1;
  for (let i = 0; i < rows.length; i++) {
    const c0 = String(rows[i][0] || '').trim();
    if (c0.includes('1. 사업부')) {
      // 헤더 3행 건너뛰고 데이터 시작
      divStart = i + 4;
    } else if (c0.includes('2. 사무소')) {
      divEnd = i;
      officeStart = i + 4;
    } else if (officeStart > 0 && officeEnd < 0 && c0 === '합계') {
      officeEnd = i;
    }
  }

  const divisions = [];
  const offices = [];
  let total = null;

  // 사업부 영역
  if (divStart > 0) {
    for (let i = divStart; i < (divEnd > 0 ? divEnd : rows.length); i++) {
      const r = rows[i];
      if (!r || !r.some(c => c !== '')) continue;
      const c0 = String(r[0] || '').trim();
      const c1 = String(r[1] || '').trim();
      const c2 = String(r[2] || '').trim();

      if (c0 === '합계') {
        // 본부 총합
        total = {
          target: num(r[3]),
          achieved: num(r[4]),
          rate: pct(r[5]),
          grade: gradeKey(r[6]),
          products: extractProducts(r),
        };
        break;
      }
      if (!c1) continue;
      divisions.push({
        name: c1,
        manager: c2,
        target: num(r[3]),
        achieved: num(r[4]),
        rate: pct(r[5]),
        grade: gradeKey(r[6]),
        products: extractProducts(r),
      });
    }
  }

  // 사무소 영역
  if (officeStart > 0) {
    for (let i = officeStart; i < (officeEnd > 0 ? officeEnd : rows.length); i++) {
      const r = rows[i];
      if (!r || !r.some(c => c !== '')) continue;
      const c0 = String(r[0] || '').trim();
      const c1 = String(r[1] || '').trim();
      const c2 = String(r[2] || '').trim();
      if (c0 === '합계') break;
      if (!c1) continue;
      offices.push({
        division: c0,
        office: c1,
        manager: c2,
        target: num(r[3]),
        achieved: num(r[4]),
        rate: pct(r[5]),
        grade: gradeKey(r[6]),
        products: extractProducts(r),
      });
    }
  }

  console.log(`[parseShinjepum] 사업부 ${divisions.length}개, 사무소 ${offices.length}개, 품목 ${productNames.filter(Boolean).length}개`);
  return { productNames, total, divisions, offices };
}

export async function parseShinjepumExcelFile(file) {
  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const summarySheet = wb.SheetNames.find(n => n.includes('사업부') && n.includes('사무소')) || wb.SheetNames[0];
    const ws = wb.Sheets[summarySheet];
    if (!ws) throw new Error('사업부-사무소 시트를 찾을 수 없습니다');

    const period = detectPeriod(file.name);
    const { productNames, total, divisions, offices } = parseSummary(ws);

    return {
      period,
      productNames,
      total,
      divisions,
      offices,
      uploadedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[parseShinjepumExcelFile] 오류:', err);
    throw err;
  }
}
