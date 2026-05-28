// 전국 병의원 데이터 동기화 스크립트 (PC에서 실행 — 서버리스 10초 제한 없음)
// 사용법: node scripts/sync-hospitals.mjs <심평원_서비스키>
//
// 동작: 심평원 병원정보서비스 전체(약 8만건)를 스캔 → 통계·신규개설 집계
//       → Firebase Firestore(dashboards/hira_hospital_cache)에 저장
// 대시보드는 이 캐시를 읽어서 표시합니다. 주 1회 정도 실행하면 됩니다.

const SERVICE_KEY = process.argv[2];
if (!SERVICE_KEY) {
  console.error('\n❌ 서비스키가 없습니다.\n사용법: node scripts/sync-hospitals.mjs <심평원_서비스키>\n');
  process.exit(1);
}

const HOSP_BASE = 'http://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList';
const FB_PROJECT = 'etc-dashboard-4937f';
const FB_APIKEY = 'AIzaSyD-RVnR3HbEioQ1kBkQOXSIohkyKzBpWHE';

const NUM = 1000;       // 페이지당 건수 (PC라 제한 없음)
const CONC = 4;         // 동시 호출
const RETRY = [1000, 2000, 3000, 5000, 8000];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchPage(pageNo, attempt = 0) {
  const url = `${HOSP_BASE}?serviceKey=${encodeURIComponent(SERVICE_KEY)}&pageNo=${pageNo}&numOfRows=${NUM}&_type=json`;
  try {
    const r = await fetch(url);
    const text = await r.text();
    if (!text) throw new Error('빈 응답');
    const j = JSON.parse(text);
    if (j.response?.header?.resultCode && j.response.header.resultCode !== '00') {
      throw new Error(j.response.header.resultMsg || '조회 실패');
    }
    let items = j.response?.body?.items?.item || [];
    if (!Array.isArray(items)) items = items ? [items] : [];
    return { totalCount: j.response?.body?.totalCount || 0, items };
  } catch (e) {
    if (attempt < RETRY.length) {
      await sleep(RETRY[attempt]);
      return fetchPage(pageNo, attempt + 1);
    }
    throw new Error(`page ${pageNo} 실패: ${e.message}`);
  }
}

// JS 객체 → Firestore 타입 값 변환
function fsVal(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsVal) } };
  if (typeof v === 'object') return { mapValue: { fields: fsFields(v) } };
  return { stringValue: String(v) };
}
function fsFields(o) {
  const f = {};
  for (const k of Object.keys(o)) f[k] = fsVal(o[k]);
  return f;
}

async function saveToFirestore(docId, obj) {
  const url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/dashboards/${docId}?key=${FB_APIKEY}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fields: fsFields(obj) }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Firestore 저장 실패 (${r.status}): ${t.slice(0, 300)}`);
  }
}

function ymdNum(d) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

(async () => {
  const t0 = Date.now();
  console.log('\n🏥 전국 병의원 데이터 스캔 시작...\n');

  // 1페이지로 총 건수 확인
  const first = await fetchPage(1);
  const total = first.totalCount;
  const pages = Math.ceil(total / NUM);
  console.log(`총 ${total.toLocaleString()}건 · ${pages}페이지 (페이지당 ${NUM}건, 동시 ${CONC}개)\n`);

  let all = first.items.slice();
  process.stdout.write(`\r진행: ${all.length.toLocaleString()} / ${total.toLocaleString()}   `);

  for (let start = 2; start <= pages; start += CONC) {
    const batch = [];
    for (let pg = start; pg < start + CONC && pg <= pages; pg++) batch.push(fetchPage(pg));
    const res = await Promise.all(batch);
    res.forEach(r => { all = all.concat(r.items); });
    process.stdout.write(`\r진행: ${Math.min(all.length, total).toLocaleString()} / ${total.toLocaleString()}   `);
  }
  console.log('\n\n✅ 스캔 완료. 집계 중...');

  // 통계 집계
  const byClass = {}, bySido = {};
  all.forEach(h => {
    const cl = (h.clCdNm || '').trim();
    const sd = (h.sidoCdNm || '').trim();
    if (cl) byClass[cl] = (byClass[cl] || 0) + 1;
    if (sd) bySido[sd] = (bySido[sd] || 0) + 1;
  });

  // 최근 30일 신규개설
  const cutoff = ymdNum(new Date(Date.now() - 30 * 86400000));
  const newlyOpened = all
    .filter(h => h.estbDd && Number(h.estbDd) >= cutoff)
    .map(h => ({
      yadmNm: h.yadmNm || '', clCdNm: h.clCdNm || '', sidoCdNm: h.sidoCdNm || '',
      sgguCdNm: h.sgguCdNm || '', addr: h.addr || '',
      estbDd: Number(h.estbDd) || 0, drTotCnt: Number(h.drTotCnt) || 0,
    }))
    .sort((a, b) => b.estbDd - a.estbDd)
    .slice(0, 500);

  const cache = {
    updatedAt: new Date().toISOString(),
    totalCount: total,
    byClass, bySido,
    newlyOpened,
    cutoff,
  };

  console.log(`신규개설(최근 30일): ${newlyOpened.length}건 · 종별 ${Object.keys(byClass).length}종 · 시도 ${Object.keys(bySido).length}개`);
  console.log('Firebase 저장 중...');
  await saveToFirestore('hira_hospital_cache', cache);

  console.log(`\n🎉 완료! (소요 ${((Date.now() - t0) / 1000 / 60).toFixed(1)}분)`);
  console.log('대시보드 → 병의원 정보 화면을 새로고침하면 반영됩니다.\n');
})().catch(err => {
  console.error('\n❌ 오류:', err.message, '\n');
  process.exit(1);
});
