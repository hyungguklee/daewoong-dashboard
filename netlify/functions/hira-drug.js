// 식약처 의약품개요정보(e약은요) 프록시
// API 키는 Netlify 환경변수 HIRA_SERVICE_KEY 재사용 (병원 API와 동일 키)
// 엔드포인트: 1471000/DrbEasyDrugInfoService/getDrbEasyDrugList

const BASE = 'https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList';

function resp(status, obj) {
  return { statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) };
}

exports.handler = async (event) => {
  const key = process.env.HIRA_SERVICE_KEY;
  if (!key) return resp(500, { error: 'HIRA_SERVICE_KEY 환경변수가 설정되지 않았습니다.' });

  const p = event.queryStringParameters || {};
  const itemName = (p.itemName || '').trim();
  const pageNo = p.pageNo || '1';
  const numOfRows = p.numOfRows || '20';
  if (!itemName) return resp(400, { error: '검색어가 없습니다.' });

  const url = `${BASE}?serviceKey=${encodeURIComponent(key)}&itemName=${encodeURIComponent(itemName)}&pageNo=${pageNo}&numOfRows=${numOfRows}&type=json`;

  try {
    const r = await fetch(url);
    const text = await r.text();
    let j;
    try { j = JSON.parse(text); }
    catch { return resp(502, { error: '의약품 API 응답 형식 오류', detail: text.slice(0, 200) }); }

    if (j.header?.resultCode && j.header.resultCode !== '00') {
      return resp(502, { error: '의약품 API 오류: ' + (j.header.resultMsg || j.header.resultCode) });
    }

    const body = j.body;
    let items = body?.items || [];
    if (!Array.isArray(items)) items = items ? [items] : [];
    const list = items.map(it => ({
      entpName: it.entpName || '',
      itemName: it.itemName || '',
      efcyQesitm: it.efcyQesitm || '',
      atpnQesitm: it.atpnQesitm || '',
      seQesitm: it.seQesitm || '',
      itemImage: it.itemImage || '',
    }));

    return resp(200, { totalCount: body?.totalCount || 0, items: list });
  } catch (err) {
    console.error('[hira-drug] 예외:', err);
    return resp(500, { error: err.message });
  }
};
