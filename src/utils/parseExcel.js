import * as XLSX from 'xlsx';

function pct(val) {
  if (val == null || val === '' || val === '***') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace('%', '')) / 100;
  return isNaN(n) ? null : Math.round(n * 10000) / 10000;
}

function num(val) {
  if (val == null || val === '' || val === '***') return 0;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

function gradeKey(g) {
  if (!g) return 'B';
  return String(g).trim().replace('+', 'p');
}

// ─── 평가관리 시트 파싱 ────────────────────────────────────────────────────────
// 실제 컬럼 구조 (header:1 기준, 0-indexed):
// [사업부 섹션] r[0]:이름, r[1]:소장, r[2]:"", r[3]:최종, r[4]:정성, r[5]:정량, ...
// [사무소 섹션] r[0]:사업부명, r[1]:사무소명, r[2]:소장, r[3]:최종, r[4]:정성, r[5]:정량, ...
// 공통 지표 컬럼(사무소 기준): r[3]최종 r[4]정성 r[5]정량 r[6]대상처
//   r[7]전월거래 r[8]당월거래 r[9]거래율 r[10]종합병원대상 r[11]종합병원거래 r[12]종합병원거래율
//   r[13]병원대상 r[14]병원거래 r[15]병원거래율 r[16]기준점(원) r[17]매출(원) r[18]매출(백만) r[19]성장률
// 섹션 구분: "■ 사업부" 행 → div 섹션, "■ 사무소" 행 → off 섹션
function parseEvalSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const total = {};
  const divisions = [];
  const offices = [];

  const DIV_NAMES = new Set(['서울1', '서울2', '지방1', '지방2', '프로트랙']);

  let section = null; // 'div' | 'off'
  let sectionMarkerFound = false;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every(c => c === '')) continue;

    const c0 = String(r[0] || '').trim();

    // 섹션 마커 감지
    if (c0.includes('■') && (c0.includes('사업부') || c0.includes('사무소'))) {
      section = c0.includes('사무소') ? 'off' : 'div';
      sectionMarkerFound = true;
      console.log(`[parseEvalSheet] 섹션 감지 row${i}: "${c0}" → section="${section}"`);
      continue;
    }
    if (!section) continue;

    // 헤더 행 스킵 (사업부/사무소 라벨 행, 공란 행)
    if (c0 === '사업부' || c0 === '사무소' || c0 === '') continue;

    const c1 = String(r[1] || '').trim();
    const c2 = String(r[2] || '').trim();

    const isTotal = c0.includes('ETC 병원본부') || c0.includes('병원 계');
    const isDivName = DIV_NAMES.has(c0);

    // 공통 지표 추출 (사업부 행: r[3]~, 사무소 행도 동일)
    const base = {
      grade_final:   gradeKey(r[3]),
      grade_quality: gradeKey(r[4]),
      grade_quant:   gradeKey(r[5]),
      target:        num(r[6]),
      trade_prev:    num(r[7]),
      trade_cur:     num(r[8]),
      trade_rate:    pct(r[9]),
      gj_target:     num(r[10]),
      gj_cur:        num(r[11]),
      gj_rate:       pct(r[12]),
      hosp_target:   num(r[13]),
      hosp_cur:      num(r[14]),
      hosp_rate:     pct(r[15]),
      baseline:      num(r[16]),
      sales:         num(r[17]),
      sales_mil:     num(r[18]),
      growth_rate:   pct(r[19]),
    };

    if (isTotal) {
      Object.assign(total, base);
    } else if (section === 'div' && isDivName) {
      // 사업부 섹션: r[0]=사업부명, r[1]=소장
      divisions.push({ name: c0, manager: c1, ...base });
    } else if (section === 'off' && isDivName && c1) {
      // 사무소 섹션: r[0]=사업부명, r[1]=사무소명, r[2]=소장
      offices.push({ division: c0, office: c1, manager: c2, ...base });
    } else {
      // 파싱 스킵된 행 — 디버그용
      console.warn(
        `[parseEvalSheet] row${i} 스킵: section="${section}" c0="${c0}" isDivName=${isDivName} c1="${c1}"`,
        `r[0..4]=`, r.slice(0, 5)
      );
    }
  }

  // 파싱 결과 요약
  if (!sectionMarkerFound) {
    console.error('[parseEvalSheet] ■ 섹션 마커(사업부/사무소)를 찾지 못했습니다. 시트 구조를 확인하세요.');
  }
  if (divisions.length === 0) {
    console.error('[parseEvalSheet] 사업부 파싱 결과 0건. DIV_NAMES:', [...DIV_NAMES], '→ 엑셀의 사업부명과 일치하는지 확인하세요.');
  }
  if (offices.length === 0) {
    console.error('[parseEvalSheet] 사무소 파싱 결과 0건. r[0]=사업부명, r[1]=사무소명 구조인지 확인하세요.');
  }
  console.log(`[parseEvalSheet] 완료: 사업부 ${divisions.length}개, 사무소 ${offices.length}개`);

  return { total, divisions, offices };
}

// ─── 누적현황 시트 파싱 ────────────────────────────────────────────────────────
function parseTrendSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  let monthRow = -1, subRow = -1;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const joined = rows[i].join('|');
    if (joined.match(/\d{2}\.\d{2}/) || joined.match(/\d{2}\.\d+Q/)) monthRow = i;
    if (joined.includes('처수') && joined.includes('매출')) { subRow = i; break; }
  }

  if (monthRow === -1) {
    console.error('[parseTrendSheet] 월 헤더 행을 찾지 못했습니다 (예: "26.01", "26.02" 형식 셀이 없음). 누적현황 시트 구조를 확인하세요.');
    return { divisions: {}, offices: {}, total: {} };
  }
  if (subRow === -1) {
    console.warn('[parseTrendSheet] 서브헤더(처수/매출) 행을 찾지 못했습니다. 지표 매핑이 불완전할 수 있습니다.');
  }

  const monthHeaders = rows[monthRow];
  const subHeaders = subRow > -1 ? rows[subRow] : [];

  const colMap = {};
  let curMonth = '';
  for (let c = 0; c < monthHeaders.length; c++) {
    const mh = String(monthHeaders[c]).trim();
    if (mh.match(/^\d{2}\.\d{2}/) || mh.match(/^\d{2}\.\d+Q/)) curMonth = mh;
    const sub = String(subHeaders[c] || '').trim();
    if (curMonth && sub) colMap[c] = { month: curMonth, metric: sub };
  }
  console.log(`[parseTrendSheet] colMap 구성: ${Object.keys(colMap).length}개 컬럼, 월: ${[...new Set(Object.values(colMap).map(v => v.month))].join(', ')}`);

  const divTrend = {}, offTrend = {}, totalTrend = {};
  const knownDivs = ['프로트랙','서울1','서울2','지방1','지방2','ETC 병원본부','병원 계'];

  for (let i = subRow + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every(c => c === '')) continue;
    const nameB = String(r[1] || '').trim();
    const nameC = String(r[2] || '').trim();
    const name = nameB || nameC;
    if (!name) continue;

    const isTotal = name.includes('병원 계') || name.includes('ETC 병원본부');
    const isDiv = knownDivs.some(d => name.includes(d) || d.includes(name));

    const trend = {};
    for (const [col, { month, metric }] of Object.entries(colMap)) {
      if (!trend[month]) trend[month] = {};
      if (metric === '처수') trend[month].trade_cnt = num(r[col]);
      else if (metric === '매출') trend[month].sales_mil = num(r[col]);
      else if (metric.includes('거래율')) {
        const v = pct(r[col]);
        // 거래율 0%는 미입력으로 처리 (0%는 실제 불가능) → null로 두면 connectNulls가 이어줌
        if (v != null && v > 0) trend[month].trade_rate = v;
      }
    }

    if (isTotal) Object.assign(totalTrend, trend);
    else if (isDiv) divTrend[name] = trend;
    else offTrend[nameC || nameB] = trend;
  }

  console.log(`[parseTrendSheet] 완료: 사업부 ${Object.keys(divTrend).length}개, 사무소 ${Object.keys(offTrend).length}개`);
  return { divisions: divTrend, offices: offTrend, total: totalTrend };
}

// ─── 평가raw 시트 파싱 ────────────────────────────────────────────────────────
// 컬럼 구조 (header:1 기준, 0-indexed):
// [0]:" "  [1]:key  [2]:사업부  [3]:사무소  [4]:로컬사업부  [5]:로컬사무소
// [6]:종별코드명  [7]:병상수  [8]:사업자번호  [9]:요양기관명  [10]:주소
// [11]:의사결정자  [12]:고객명  [13]:고객단계  [14]:26년3월 기준점
// [15]:26년1월 실적  [16]:26년2월 실적  [17]:26.03월 평가실적  [18]:25.10~26.03 누적
// 거래여부: 기준점>0 or 26.03월실적>0 → 거래중
// 헤더 행: index 5, 서브헤더: index 6, 데이터: index 7~
function parseRawSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const hospitalData = {};

  // 데이터 시작 행 찾기
  let dataStart = 7;
  let headerFound = false;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const joined = rows[i].join('|');
    if (joined.includes('요양기관명') || joined.includes('거래처명')) {
      dataStart = i + 2;
      headerFound = true;
      console.log(`[parseRawSheet] 헤더 발견 row${i}, 데이터 시작: row${dataStart}`);
      // 컬럼 구조 로그
      console.log(`[parseRawSheet] 헤더 행 컬럼(0~20):`, rows[i].slice(0, 20));
      break;
    }
  }
  if (!headerFound) {
    console.warn(`[parseRawSheet] "요양기관명"/"거래처명" 헤더를 찾지 못함 → 기본값 row${dataStart}부터 파싱 시작`);
  }

  let parsedCount = 0;
  let skippedCount = 0;

  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every(c => c === '')) continue;

    // 병원 사무소(col3) 우선, 없으면 로컬 사무소(col5)
    const office = String(r[3] || r[5] || '').trim();
    const hospName = String(r[9] || '').trim();

    if (!office || !hospName) {
      // 데이터가 있어 보이는 행인데 스킵되면 경고
      const hasData = r.slice(2, 15).some(c => c !== '' && c != null);
      if (hasData) {
        console.warn(
          `[parseRawSheet] row${i} 스킵: office="${office}"(r[3]="${r[3]}", r[5]="${r[5]}") hospName="${hospName}"(r[9]="${r[9]}")`,
          `r[2..10]=`, r.slice(2, 11)
        );
      }
      skippedCount++;
      continue;
    }

    const baseline  = num(r[14]);
    const sales_jan = num(r[15]);
    const sales_feb = num(r[16]);
    const sales_mar = num(r[17]);
    const six_month_total = num(r[18]);

    // num() 파싱 실패 감지 (원본이 있는데 0이 나오는 경우)
    const rawBaseline = r[14];
    if (rawBaseline !== '' && rawBaseline != null && baseline === 0 && typeof rawBaseline !== 'number') {
      console.warn(`[parseRawSheet] row${i} "${hospName}" r[14](기준점) 파싱 실패: 원본값="${rawBaseline}"`);
    }
    const rawSalesMar = r[17];
    if (rawSalesMar !== '' && rawSalesMar != null && sales_mar === 0 && typeof rawSalesMar !== 'number') {
      console.warn(`[parseRawSheet] row${i} "${hospName}" r[17](3월실적) 파싱 실패: 원본값="${rawSalesMar}"`);
    }

    // 기준점>0 이거나 당월실적>0 이면 거래중
    const is_traded = baseline > 0 || sales_mar > 0;

    const hospital = {
      name:           hospName,
      address:        String(r[10] || '').trim(),
      beds:           num(r[7]),
      type:           String(r[6] || '').trim(),
      decision_maker: String(r[11] || '').trim(),
      customer_name:  String(r[12] || '').trim(),
      customer_stage: String(r[13] || '').trim(),
      baseline,
      sales_jan,
      sales_feb,
      sales_mar,
      six_month_total,
      is_traded,
      division:       String(r[2] || '').trim(),
      office,
      // 로컬 채널 담당 사무소 (로컬 사무소명)
      local_office:   String(r[5] || '').trim(),
    };

    if (!hospitalData[office]) hospitalData[office] = [];
    hospitalData[office].push(hospital);
    parsedCount++;
  }

  const officeList = Object.keys(hospitalData);
  console.log(`[parseRawSheet] 완료: ${parsedCount}개 병원 파싱, ${skippedCount}개 스킵, 사무소 ${officeList.length}개`);
  if (officeList.length > 0) {
    console.log(`[parseRawSheet] 파싱된 사무소 목록:`, officeList);
  } else {
    console.error('[parseRawSheet] 사무소 데이터가 없습니다! r[3](사무소), r[9](요양기관명) 컬럼 위치를 확인하세요.');
  }

  return hospitalData;
}

function detectPeriod(filename, ws) {
  const m = filename.match(/(\d{2})년\s*(\d{1,2})월/);
  if (m) return `${m[1]}년 ${m[2].padStart(2,'0')}월`;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  for (const row of rows.slice(0, 5)) {
    const m2 = row.join(' ').match(/(\d{2})년\s*(\d{1,2})월/);
    if (m2) return `${m2[1]}년 ${m2[2].padStart(2,'0')}월`;
  }
  const now = new Date();
  return `${String(now.getFullYear()).slice(2)}년 ${String(now.getMonth()+1).padStart(2,'0')}월`;
}

export async function parseExcelFile(file) {
  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheetNames = wb.SheetNames;
    console.log(`[parseExcelFile] 파일: "${file.name}", 시트 목록:`, sheetNames);

    const evalSheetName  = sheetNames.find(n => n.includes('평가관리'))   || sheetNames[0];
    const trendSheetName = sheetNames.find(n => n.includes('누적현황'))   || sheetNames[1];
    const rawSheetName   = sheetNames.find(n => n.includes('평가raw'))    || sheetNames[2];

    if (!sheetNames.find(n => n.includes('평가관리')))
      console.warn(`[parseExcelFile] "평가관리" 시트 없음 → fallback: "${evalSheetName}"`);
    if (!sheetNames.find(n => n.includes('누적현황')))
      console.warn(`[parseExcelFile] "누적현황" 시트 없음 → fallback: "${trendSheetName}"`);
    if (!sheetNames.find(n => n.includes('평가raw')))
      console.warn(`[parseExcelFile] "평가raw" 시트 없음 → rawSheetName: "${rawSheetName}"`);

    const evalWs  = wb.Sheets[evalSheetName];
    const trendWs = wb.Sheets[trendSheetName];
    const rawWs   = rawSheetName ? wb.Sheets[rawSheetName] : null;

    const period = detectPeriod(file.name, evalWs);
    console.log(`[parseExcelFile] 감지된 기간: "${period}"`);

    const { total, divisions, offices } = parseEvalSheet(evalWs);
    const trendData   = parseTrendSheet(trendWs);
    const hospitalData = rawWs ? parseRawSheet(rawWs) : {};

    if (!rawWs) {
      console.error('[parseExcelFile] 평가raw 시트가 없어 병원 상세 데이터를 파싱할 수 없습니다.');
    }

    // 사무소 이름 매칭 검증
    const officeNames = offices.map(o => o.office);
    const rawOfficeNames = Object.keys(hospitalData);
    const mismatched = officeNames.filter(n => !rawOfficeNames.includes(n));
    if (mismatched.length > 0) {
      console.warn(
        `[parseExcelFile] 평가관리 사무소명 중 평가raw에 없는 항목 ${mismatched.length}개:`,
        mismatched,
        `\n평가raw 사무소 목록:`, rawOfficeNames
      );
    }

    return { period, total, divisions, offices, hospitalData, trendData, uploadedAt: new Date().toISOString() };
  } catch (err) {
    console.error('[parseExcelFile] 파싱 중 예외 발생:', err);
    throw err;
  }
}
