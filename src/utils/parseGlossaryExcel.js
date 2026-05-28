// 용어사전 엑셀 파서
// 컬럼: No / 구분 / 용어 / 의미 / 세부내용 / 용어 사용 예시
import * as XLSX from 'xlsx';

const str = v => v == null ? '' : String(v).trim();

export async function parseGlossaryExcelFile(file) {
  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // 헤더 행 찾기 (col2 === '용어')
    let header = -1;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      if (str(rows[i][2]) === '용어') { header = i; break; }
    }
    if (header < 0) header = 0;

    const terms = [];
    for (let i = header + 1; i < rows.length; i++) {
      const r = rows[i];
      const term = str(r[2]);
      if (!term) continue;
      terms.push({
        c: str(r[1]),  // 구분
        t: term,        // 용어
        m: str(r[3]),  // 의미
        d: str(r[4]),  // 세부내용
        e: str(r[5]),  // 용어 사용 예시
      });
    }

    const categories = {};
    terms.forEach(x => { if (x.c) categories[x.c] = (categories[x.c] || 0) + 1; });

    console.log(`[parseGlossary] 용어 ${terms.length}개, 분야 ${Object.keys(categories).length}개`);

    return {
      count: terms.length,
      categories,
      termsJSON: JSON.stringify(terms),  // 검색은 클라이언트에서 → 문자열로 저장 (인덱스 절약)
      uploadedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[parseGlossaryExcelFile] 오류:', err);
    throw err;
  }
}
