// Cloudflare Pages Function — 심평원 병원정보서비스 프록시
// 환경변수: HIRA_SERVICE_KEY (Cloudflare Pages 대시보드에서 설정)

const BASE = 'http://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList';

const json = (status, obj) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json' },
});

export async function onRequestGet({ request, env }) {
  const key = env.HIRA_SERVICE_KEY;
  if (!key) return json(500, { error: 'HIRA_SERVICE_KEY 환경변수가 설정되지 않았습니다.' });

  const url = new URL(request.url);
  const pageNo = url.searchParams.get('pageNo') || '1';
  const numOfRows = url.searchParams.get('numOfRows') || '50';
  const yadmNm = (url.searchParams.get('yadmNm') || '').trim();

  let api = `${BASE}?serviceKey=${encodeURIComponent(key)}&pageNo=${pageNo}&numOfRows=${numOfRows}&_type=json`;
  if (yadmNm) api += `&yadmNm=${encodeURIComponent(yadmNm)}`;

  try {
    const r = await fetch(api);
    const text = await r.text();
    let j;
    try { j = JSON.parse(text); }
    catch { return json(502, { error: '심평원 API 응답 형식 오류', detail: text.slice(0, 200) }); }

    if (j.response?.header?.resultCode && j.response.header.resultCode !== '00') {
      return json(502, { error: '심평원 API 오류: ' + (j.response.header.resultMsg || j.response.header.resultCode) });
    }
    const body = j.response?.body;
    let items = body?.items?.item || [];
    if (!Array.isArray(items)) items = items ? [items] : [];
    const list = items.map(it => ({
      yadmNm: it.yadmNm || '', clCdNm: it.clCdNm || '', sidoCdNm: it.sidoCdNm || '',
      sgguCdNm: it.sgguCdNm || '', addr: it.addr || '',
      drTotCnt: it.drTotCnt || 0, estbDd: it.estbDd || 0, telno: it.telno || '',
    }));
    return json(200, { totalCount: body?.totalCount || 0, pageNo: Number(pageNo), numOfRows: Number(numOfRows), items: list });
  } catch (err) {
    return json(500, { error: err.message });
  }
}
