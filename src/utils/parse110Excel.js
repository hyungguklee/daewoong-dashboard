import * as XLSX from 'xlsx';

function num(v) {
  if (v == null || v === '' || v === '***') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function pct(v) {
  if (v == null || v === '' || v === '***') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace('%', '')) / 100;
  return isNaN(n) ? null : Math.round(n * 10000) / 10000;
}

function gradeKey(g) {
  if (!g || g === '-') return null;
  return String(g).trim().replace('+', 'p');
}

// ─── 사업부,사무소별 시트 파싱 ────────────────────────────────────────────────
// 실제 컬럼(0-indexed from header:1):
// [0]:빈칸  [1]:사업부  [2]:사무소  [3]:담당자  [4]:110대병원수  [5]:최종  [6]:정성  [7]:정량
// [8]:총목표  [9]:자동목표  [10]:추가목표  [11]:기준점  [12]:수립금액  [13]:%  [14]:평가
// [15]:약속품목  [16]:약속%  [17]:상정품목  [18]:상정%  [19]:통과품목  [20]:통과%
// [21]:코딩품목  [22]:코딩%  [23]:계획상정  [24]:계획통과  [25]:계획코딩
// [26]:상정완료  [27]:상정완료%  [28]:결과평가  [29]:통과완료
// [30]:통과완료%  [31]:통과완료평가  [32]:코딩완료수  [33]:코딩완료%
// [34]:코딩MBO금액  [35]:코딩실적  [36]:MBO대비%  [37]:MBO대비평가  [38]:기준점대비%  [39]:기준점대비평가
function parseSummarySheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const total = {};
  const divisions = [];
  const offices = [];

  const divNames = ['서울1사업부','서울2사업부','지방1사업부','지방2사업부','ETC 병원본부'];
  let lastDiv = '';

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.some(c => c !== '')) continue;

    const col1 = String(r[1] || '').trim();
    const col2 = String(r[2] || '').trim();
    const col3 = String(r[3] || '').trim();

    const isTotal = col1.includes('ETC') || col1.includes('병원본부');
    const isOffice = col2.includes('사무소');                           // col2에 사무소명 있으면 무조건 사무소 행
    const isDiv = !isTotal && !isOffice && divNames.some(d => col1 === d); // 사무소 행이 아닐 때만 사업부 판별

    if (!isTotal && !isDiv && !isOffice) continue;

    const base = parseRowCols(r);

    // isOffice를 isDiv보다 먼저 체크: col1(사업부)과 col2(사무소) 모두 있을 때 사무소 행 우선
    if (isOffice) {
      if (col1 && divNames.some(d => col1 === d)) lastDiv = col1; // col1에 사업부명 있으면 lastDiv 갱신
      offices.push({ division: col1 || lastDiv, office: col2, manager: col3, ...base });
    } else if (isTotal) {
      Object.assign(total, { name: col1, ...base });
    } else if (isDiv) {
      lastDiv = col1;
      divisions.push({ name: col1, manager: col3, ...base });
    }
  }

  if (divisions.length === 0) {
    console.error('[110 parseSummarySheet] 사업부 파싱 0건. divNames:', divNames);
  }
  if (offices.length === 0) {
    console.error('[110 parseSummarySheet] 사무소 파싱 0건. col2에 "사무소" 포함 여부 확인 필요');
  }
  console.log(`[110 parseSummarySheet] 완료: 사업부 ${divisions.length}개, 사무소 ${offices.length}개`);

  return { total, divisions, offices };
}

function parseRowCols(r) {
  return {
    hosp_count:           num(r[4]),
    grade_final:          gradeKey(r[5]),
    grade_quality:        gradeKey(r[6]),
    grade_quant:          gradeKey(r[7]),
    total_target:         num(r[8]),
    auto_target:          num(r[9]),
    add_target:           num(r[10]),
    mbo_base:             num(r[11]),
    mbo_plan:             num(r[12]),
    mbo_rate:             pct(r[13]),
    mbo_eval:             gradeKey(r[14]),
    promise_cnt:          num(r[15]),
    promise_rate:         pct(r[16]),
    sangjeong_cnt:        num(r[17]),
    sangjeong_rate:       pct(r[18]),
    pass_cnt:             num(r[19]),
    pass_rate:            pct(r[20]),
    coding_cnt:           num(r[21]),
    coding_rate:          pct(r[22]),
    plan_sangjeong:       num(r[23]),
    plan_pass:            num(r[24]),
    plan_coding:          num(r[25]),
    result_sangjeong:     num(r[26]),
    result_sangjeong_rate:pct(r[27]),
    result_eval:          gradeKey(r[28]),
    result_pass:          num(r[29]),
    result_pass_rate:     pct(r[30]),
    result_pass_eval:     gradeKey(r[31]),
    result_coding:        num(r[32]),
    result_coding_rate:   pct(r[33]),
    coding_mbo_amount:    num(r[34]),
    coding_actual:        num(r[35]),
    mbo_vs:               pct(r[36]),
    mbo_vs_eval:          gradeKey(r[37]),
    base_vs:              pct(r[38]),
    base_vs_eval:         gradeKey(r[39]),
  };
}

// ─── 110대현황 raw 시트 파싱 ─────────────────────────────────────────────────
// 실제 컬럼(0-indexed, 헤더가 0~4행, 데이터: 5~):
// [0]:빈칸  [1]:사업부  [2]:사무소  [3]:사업자번호  [4]:거래처명
// [5]:최종  [6]:정성  [7]:정량
// [8]:총목표  [9]:자동목표  [10]:추가목표  [11]:기준점(MBO월평균)  [12]:수립금액  [13]:%  [14]:평가
// [15]:약속품목  [16]:약속%  [17]:상정품목  [18]:상정%  [19]:통과품목  [20]:통과%
// [21]:코딩품목  [22]:코딩%  [23]:계획상정  [24]:계획통과  [25]:계획코딩
// [26]:상정완료  [27]:상정완료%  [28]:결과평가  [29]:통과완료  [30]:통과완료%
// [31]:통과완료평가  [32]:코딩완료수  [33]:코딩완료%  [34]:3월MBO  [35]:26.03월실적
// [36]:MBO대비%  [37]:MBO대비평가  [38]:기준점대비%  [39]:기준점대비평가
// raw 시트 실제 컬럼(0-indexed, 헤더 0~4행, 데이터 5~행):
// [0]:사업부  [1]:사무소  [2]:사업자번호  [3]:거래처명(병원명)
// [4]:최종  [5]:정성  [6]:정량
// [7]:총목표  [8]:자동목표  [9]:추가목표  [10]:기준점(MBO월평균)  [11]:수립금액  [12]:%  [13]:평가
// [14]:약속품목  [15]:약속%  [16]:상정품목  [17]:상정%  [18]:통과품목  [19]:통과%
// [20]:코딩품목  [21]:코딩%  [22]:계획상정  [23]:계획통과  [24]:계획코딩
// [25]:상정완료  [26]:상정완료%  [27]:결과평가  [28]:통과완료  [29]:통과완료%
// [30]:통과완료평가  [31]:코딩완료수  [32]:코딩완료%  [33]:3월MBO  [34]:26.03월실적
// [35]:MBO대비%  [36]:MBO대비평가  [37]:기준점대비%  [38]:기준점대비평가
function parseRawSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const hospitalData = {};
  const DATA_START = 5;

  if (rows[2]) {
    console.log(`[110 parseRawSheet] 헤더(row2) 컬럼(0~10):`, rows[2].slice(0, 11));
  }

  let parsedCount = 0;
  let skippedCount = 0;

  for (let i = DATA_START; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every(c => c === '')) continue;

    const division = String(r[0] || '').trim();
    const office   = String(r[1] || '').trim();
    const hospName = String(r[3] || '').trim();

    if (!office || !hospName) {
      const hasData = r.slice(0, 10).some(c => c !== '' && c != null);
      if (hasData) {
        console.warn(
          `[110 parseRawSheet] row${i} 스킵: office="${office}"(r[1]) hospName="${hospName}"(r[3])`,
          `r[0..4]=`, r.slice(0, 5)
        );
      }
      skippedCount++;
      continue;
    }

    const hosp = {
      division,
      office,
      biz_num:              String(r[2] || '').trim(),
      name:                 hospName,
      grade_final:          gradeKey(r[4]),
      grade_quality:        gradeKey(r[5]),
      grade_quant:          gradeKey(r[6]),
      total_target:         num(r[7]),
      auto_target:          num(r[8]),
      add_target:           num(r[9]),
      mbo_base:             num(r[10]),
      mbo_plan:             num(r[11]),
      mbo_rate:             pct(r[12]),
      mbo_eval:             gradeKey(r[13]),
      promise_cnt:          num(r[14]),
      promise_rate:         pct(r[15]),
      sangjeong_cnt:        num(r[16]),
      sangjeong_rate:       pct(r[17]),
      pass_cnt:             num(r[18]),
      pass_rate:            pct(r[19]),
      coding_cnt:           num(r[20]),
      coding_rate:          pct(r[21]),
      plan_sangjeong:       num(r[22]),
      plan_pass:            num(r[23]),
      plan_coding:          num(r[24]),
      result_sangjeong:     num(r[25]),
      result_sangjeong_rate:pct(r[26]),
      result_eval:          gradeKey(r[27]),
      result_pass:          num(r[28]),
      result_pass_rate:     pct(r[29]),
      result_pass_eval:     gradeKey(r[30]),
      result_coding:        num(r[31]),
      result_coding_rate:   pct(r[32]),
      mbo_mar:              num(r[33]),   // 3월 MBO
      sales_mar:            num(r[34]),   // 당월 실적
      mbo_vs:               pct(r[35]),
      mbo_vs_eval:          gradeKey(r[36]),
      base_vs:              pct(r[37]),
      base_vs_eval:         gradeKey(r[38]),
    };

    if (!hospitalData[office]) hospitalData[office] = [];
    hospitalData[office].push(hosp);
    parsedCount++;
  }

  const officeList = Object.keys(hospitalData);
  console.log(`[110 parseRawSheet] 완료: ${parsedCount}개 병원, ${skippedCount}개 스킵, 사무소 ${officeList.length}개`);
  if (officeList.length > 0) {
    console.log(`[110 parseRawSheet] 사무소 목록:`, officeList);
  } else {
    console.error('[110 parseRawSheet] 사무소 데이터 없음! r[2](사무소), r[4](거래처명) 컬럼 위치 확인 필요');
  }

  return hospitalData;
}

function detectPeriod(filename) {
  const m = filename.match(/(\d{2})년\s*(\d{1,2})월/);
  if (m) return `${m[1]}년 ${m[2].padStart(2,'0')}월`;
  const now = new Date();
  return `${String(now.getFullYear()).slice(2)}년 ${String(now.getMonth()+1).padStart(2,'0')}월`;
}

export async function parse110ExcelFile(file) {
  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheetNames = wb.SheetNames;
    console.log(`[parse110ExcelFile] 파일: "${file.name}", 시트 목록:`, sheetNames);

    const summarySheetName = sheetNames.find(n => n.includes('사업부') || n.includes('사무소')) || sheetNames[0];
    const rawSheetName = sheetNames.find(n => n.includes('110대현황 raw')) || sheetNames[1];

    if (!sheetNames.find(n => n.includes('사업부') || n.includes('사무소')))
      console.warn(`[parse110ExcelFile] "사업부"/"사무소" 시트 없음 → fallback: "${summarySheetName}"`);
    if (!sheetNames.find(n => n.includes('110대현황 raw')))
      console.warn(`[parse110ExcelFile] "110대현황 raw" 시트 없음 → fallback: "${rawSheetName}"`);

    const summaryWs = wb.Sheets[summarySheetName];
    const rawWs = rawSheetName ? wb.Sheets[rawSheetName] : null;

    const period = detectPeriod(file.name);
    console.log(`[parse110ExcelFile] 감지된 기간: "${period}"`);

    const { total, divisions, offices } = parseSummarySheet(summaryWs);
    const hospitalData = rawWs ? parseRawSheet(rawWs) : {};

    if (!rawWs) {
      console.error('[parse110ExcelFile] raw 시트 없음 → 병원 상세 데이터 파싱 불가');
    }

    // 사무소 이름 매칭 검증
    const officeNames = offices.map(o => o.office);
    const rawOfficeNames = Object.keys(hospitalData);
    const mismatched = officeNames.filter(n => !rawOfficeNames.includes(n));
    if (mismatched.length > 0) {
      console.warn(
        `[parse110ExcelFile] summary 사무소 중 raw에 없는 항목 ${mismatched.length}개:`,
        mismatched,
        '\nraw 사무소:', rawOfficeNames
      );
    }

    return { period, total, divisions, offices, hospitalData, uploadedAt: new Date().toISOString() };
  } catch (err) {
    console.error('[parse110ExcelFile] 파싱 예외:', err);
    throw err;
  }
}
