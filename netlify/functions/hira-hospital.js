// 심평원 병원정보서비스 프록시
// API 키는 Netlify 환경변수(HIRA_SERVICE_KEY)에 저장 (브라우저 노출 방지 + CORS 우회)
// 엔드포인트: B551182/hospInfoServicev2/getHospBasisList

const BASE = 'http://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList';

function resp(status, obj) {
  return { statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) };
}

exports.handler = async (event) => {
  const key = process.env.HIRA_SERVICE_KEY;
  if (!key) return resp(500, { error: 'HIRA_SERVICE_KEY 환경변수가 설정되지 않았습니다.' });

  const p = event.queryStringParameters || {};
  const pageNo = p.pageNo || '1';
  const numOfRows = p.numOfRows || '50';
  const yadmNm = (p.yadmNm || '').trim();

  let url = `${BASE}?serviceKey=${encodeURIComponent(key)}&pageNo=${pageNo}&numOfRows=${numOfRows}&_type=json`;
  if (yadmNm) url += `&yadmNm=${encodeURIComponent(yadmNm)}`;

  try {
    const r = await fetch(url);
    const text = await r.text();
    let j;
    try { j = JSON.parse(text); }
    catch { return resp(502, { error: '심평원 API 응답 형식 오류', detail: text.slice(0, 200) }); }

    const body = j.response?.body;
    const headerMsg = j.response?.header?.resultMsg;
    if (j.response?.header?.resultCode && j.response.header.resultCode !== '00') {
      return resp(502, { error: '심평원 API 오류: ' + (headerMsg || j.response.header.resultCode) });
    }

    let items = body?.items?.item || [];
    if (!Array.isArray(items)) items = items ? [items] : [];
    const list = items.map(it => ({
      yadmNm: it.yadmNm || '',
      clCdNm: it.clCdNm || '',
      sidoCdNm: it.sidoCdNm || '',
      sgguCdNm: it.sgguCdNm || '',
      addr: it.addr || '',
      drTotCnt: it.drTotCnt || 0,
      estbDd: it.estbDd || 0,
      telno: it.telno || '',
    }));

    return resp(200, { totalCount: body?.totalCount || 0, pageNo: Number(pageNo), numOfRows: Number(numOfRows), items: list });
  } catch (err) {
    console.error('[hira-hospital] 예외:', err);
    return resp(500, { error: err.message });
  }
};
