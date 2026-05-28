export function fmtPct(val, digits = 1) {
  if (val == null || isNaN(val)) return '-';
  return (val * 100).toFixed(digits) + '%';
}

export function fmtMil(val, digits = 1) {
  if (val == null || isNaN(val)) return '-';
  return Number(val).toLocaleString('ko-KR', { maximumFractionDigits: digits }) + '백만';
}

export function fmtNum(val) {
  if (val == null || isNaN(val)) return '-';
  return Number(val).toLocaleString('ko-KR');
}

export function fmtGrowth(val) {
  if (val == null || isNaN(val)) return '-';
  const pct = (val * 100).toFixed(1);
  return (val >= 0 ? '+' : '') + pct + '%';
}

export function gradeKey(g) {
  if (!g) return 'B';
  return String(g).replace('+', 'p');
}

export function gradeLabel(key) {
  if (!key) return '-';
  return String(key).replace('p', '+');
}

const GRADE_ORDER = ['S', 'Ap', 'A', 'Bp', 'B', 'Cp', 'C'];

export function gradeColor(key) {
  const map = {
    S: '#1A3A6B', Ap: '#1E5FA8', A: '#3D5A8C',
    Bp: '#3A3A3A', B: '#111111', Cp: '#C47A1A', C: '#B83838',
  };
  return map[key] || '#6B6B6B';
}

export function sortByGrade(arr, field = 'grade_final') {
  return [...arr].sort((a, b) =>
    GRADE_ORDER.indexOf(a[field]) - GRADE_ORDER.indexOf(b[field])
  );
}

// 사업부명에서 '사업부' 제거 (서울1사업부 → 서울1)
export function fmtDiv(name) {
  return String(name || '').replace('사업부', '').trim();
}

// 사무소명에서 '사무소' 제거 (병원서울1사무소 → 병원서울1)
export function fmtOffice(name) {
  return String(name || '').replace('사무소', '').trim();
}

const DIV_SORT = ['서울1', '서울2', '지방1', '지방2'];

// 서울1→서울2→지방1→지방2 순, 같은 사업부 내에서는 ㄱㄴㄷ순
export function sortOfficesByDivision(offices) {
  return [...offices].sort((a, b) => {
    const da = DIV_SORT.indexOf(fmtDiv(a.division));
    const db = DIV_SORT.indexOf(fmtDiv(b.division));
    const divCmp = (da === -1 ? 99 : da) - (db === -1 ? 99 : db);
    if (divCmp !== 0) return divCmp;
    return String(fmtOffice(a.office)).localeCompare(String(fmtOffice(b.office)), 'ko');
  });
}
