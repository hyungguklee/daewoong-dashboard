// Cloudflare Workers — 통합 API 라우터 + 정적 자산 서빙
// 새 Workers + Static Assets 모델용 단일 진입점
// 환경변수: HIRA_SERVICE_KEY, ANTHROPIC_API_KEY, ANTHROPIC_MODEL(선택)

const DEFAULT_MODEL = 'claude-haiku-4-5';

const SYSTEM_INSTRUCTIONS = `당신은 대웅제약 영업기획팀의 월간 평가 대시보드 AI 어시스턴트입니다.
아래에 제공되는 [대시보드 데이터]만을 근거로 정확하게 한국어로 답변하세요.

규칙:
- 반드시 제공된 데이터에 있는 사실만 답변하세요. 데이터에 없으면 "해당 데이터가 없습니다"라고 답하세요.
- 숫자(등급, %, 금액, 인원)는 데이터 그대로 정확히 인용하세요. 추측하거나 만들어내지 마세요.
- 순위/비교/집계 질문은 데이터를 계산해서 답하세요.
- 등급 체계는 S > A > B > C 순서입니다 (S가 가장 우수). +가 붙으면 해당 등급의 상위입니다.
- 답변은 간결하고 명확하게.
- 과제명: MBO시스템, 풀동도, 110대병원, 2차병원, 고객단계, SOP, 직거래, 신제품
- 각 과제는 병원본부/로컬본부로 나뉩니다 (110대병원·2차병원은 병원만 해당).`;

const json = (status, obj) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json' },
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── /api/hira-hospital ─────────────────────────────────────────
const HOSP_BASE = 'http://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList';
async function handleHiraHospital(request, env) {
  const key = env.HIRA_SERVICE_KEY;
  if (!key) return json(500, { error: 'HIRA_SERVICE_KEY 환경변수가 설정되지 않았습니다.' });
  const u = new URL(request.url);
  const pageNo = u.searchParams.get('pageNo') || '1';
  const numOfRows = u.searchParams.get('numOfRows') || '50';
  const yadmNm = (u.searchParams.get('yadmNm') || '').trim();
  let api = `${HOSP_BASE}?serviceKey=${encodeURIComponent(key)}&pageNo=${pageNo}&numOfRows=${numOfRows}&_type=json`;
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

// ─── /api/hira-drug ─────────────────────────────────────────────
const DRUG_BASE = 'https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList';
async function handleHiraDrug(request, env) {
  const key = env.HIRA_SERVICE_KEY;
  if (!key) return json(500, { error: 'HIRA_SERVICE_KEY 환경변수가 설정되지 않았습니다.' });
  const u = new URL(request.url);
  const itemName = (u.searchParams.get('itemName') || '').trim();
  const pageNo = u.searchParams.get('pageNo') || '1';
  const numOfRows = u.searchParams.get('numOfRows') || '20';
  if (!itemName) return json(400, { error: '검색어가 없습니다.' });
  const api = `${DRUG_BASE}?serviceKey=${encodeURIComponent(key)}&itemName=${encodeURIComponent(itemName)}&pageNo=${pageNo}&numOfRows=${numOfRows}&type=json`;
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

// ─── /api/chat ─────────────────────────────────────────────────
async function handleChat(request, env) {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return json(500, { error: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.' });

  let body;
  try { body = await request.json(); }
  catch { return json(400, { error: '잘못된 요청 형식' }); }

  const { messages, context } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return json(400, { error: '메시지가 없습니다.' });
  }

  const model = env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const system = [
    { type: 'text', text: SYSTEM_INSTRUCTIONS },
    { type: 'text', text: `[대시보드 데이터]\n${context || '(데이터 없음)'}`, cache_control: { type: 'ephemeral' } },
  ];
  const reqBody = JSON.stringify({ model, max_tokens: 1024, system, messages });
  const headers = { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };

  const MAX_ATTEMPTS = 6;
  const BACKOFF = [400, 800, 1300, 1800, 2200];
  let lastErr = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: reqBody });
      const data = await resp.json();
      if (resp.ok) {
        const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
        return json(200, { text, usage: data.usage });
      }
      const retriable = [429, 500, 503, 529].includes(resp.status) || /overloaded/i.test(data?.error?.message || '');
      lastErr = data?.error?.message || `AI 호출 실패 (${resp.status})`;
      if (retriable && attempt < MAX_ATTEMPTS - 1) { await sleep(BACKOFF[attempt]); continue; }
      const friendly = retriable ? 'AI 서버가 잠시 혼잡합니다. 잠시 후 다시 시도해주세요.' : lastErr;
      return json(resp.status, { error: friendly });
    } catch (err) {
      lastErr = err.message;
      if (attempt < MAX_ATTEMPTS - 1) { await sleep(BACKOFF[attempt]); continue; }
      return json(500, { error: err.message });
    }
  }
  return json(503, { error: lastErr || 'AI 호출 실패' });
}

// ─── 메인 라우터 ───────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (path === '/api/chat' && method === 'POST') return handleChat(request, env);
    if (path === '/api/hira-hospital' && method === 'GET') return handleHiraHospital(request, env);
    if (path === '/api/hira-drug' && method === 'GET') return handleHiraDrug(request, env);
    if (path.startsWith('/api/')) return json(404, { error: `Unknown API: ${path}` });

    // 그 외는 정적 자산
    return env.ASSETS.fetch(request);
  },
};
