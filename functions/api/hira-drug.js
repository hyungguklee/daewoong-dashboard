// Cloudflare Pages Function — 식약처 의약품개요정보(e약은요) 프록시
// 환경변수: HIRA_SERVICE_KEY (병원 API와 동일 키 재사용)

const BASE = 'https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList';

const json = (status, obj) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json' },
});

export async function onRequestGet({ request, env }) {
  const key = env.HIRA_SERVICE_KEY;
  if (!key) return json(500, { error: 'HIRA_SERVICE_KEY 환경변수가 설정되지 않았습니다.' });

  const url = new URL(request.url);
  const itemName = (url.searchParams.get('itemName') || '').trim();
  const pageNo = url.searchParams.get('pageNo') || '1';
  const numOfRows = url.searchParams.get('numOfRows') || '20';
  if (!itemName) return json(400, { error: '검색어가 없습니다.' });

  const api = `${BASE}?serviceKey=${encodeURIComponent(key)}&itemName=${encodeURIComponent(itemName)}&pageNo=${pageNo}&numOfRows=${numOfRows}&type=json`;

  try {
    const r = await fetch(api);
    const text = await r.text();
    let j;
    try { j = JSON.parse(text); }
    catch { return json(502, { error: '의약품 API 응답 형식 오류', detail: text.slice(0, 200) }); }

    if (j.header?.resultCode && j.header.resultCode !== '00') {
      return json(502, { error: '의약품 API 오류: ' + (j.header.resultMsg || j.header.resultCode) });
    }
    const body = j.body;
    let items = body?.items || [];
    if (!Array.isArray(items)) items = items ? [items] : [];
    const list = items.map(it => ({
      entpName: it.entpName || '', itemName: it.itemName || '',
      efcyQesitm: it.efcyQesitm || '', atpnQesitm: it.atpnQesitm || '',
      seQesitm: it.seQesitm || '', itemImage: it.itemImage || '',
    }));
    return json(200, { totalCount: body?.totalCount || 0, items: list });
  } catch (err) {
    return json(500, { error: err.message });
  }
}
