// Netlify 서버리스 함수 — Anthropic Claude API 프록시
// API 키는 Netlify 환경변수(ANTHROPIC_API_KEY)에 저장되어 브라우저에 노출되지 않음.
// 모델은 환경변수(ANTHROPIC_MODEL)로 변경 가능. 기본값은 비용 효율적인 Haiku.

const DEFAULT_MODEL = 'claude-haiku-4-5';

const SYSTEM_INSTRUCTIONS = `당신은 대웅제약 영업기획팀의 월간 평가 대시보드 AI 어시스턴트입니다.
아래에 제공되는 [대시보드 데이터]만을 근거로 정확하게 한국어로 답변하세요.

규칙:
- 반드시 제공된 데이터에 있는 사실만 답변하세요. 데이터에 없으면 "해당 데이터가 없습니다"라고 답하세요.
- 숫자(등급, %, 금액, 인원)는 데이터 그대로 정확히 인용하세요. 추측하거나 만들어내지 마세요.
- 순위/비교/집계 질문은 데이터를 계산해서 답하세요 (예: 달성률 1위, S등급 개수 등).
- 등급 체계는 S > A > B > C 순서입니다 (S가 가장 우수, C가 가장 낮음). +가 붙으면 해당 등급의 상위입니다.
- 답변은 간결하고 명확하게. 표나 목록이 도움되면 사용하세요.
- 과제명: MBO시스템, 풀동도, 110대병원, 2차병원, 고객단계, SOP, 직거래, 신제품
- 각 과제는 병원본부/로컬본부로 나뉩니다 (110대병원·2차병원은 병원만 해당).`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: '잘못된 요청 형식' }) };
  }

  const { messages, context } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: '메시지가 없습니다.' }) };
  }

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  // system 프롬프트: 지침 + 데이터(프롬프트 캐싱 적용으로 반복 질의 비용 절감)
  const system = [
    { type: 'text', text: SYSTEM_INSTRUCTIONS },
    {
      type: 'text',
      text: `[대시보드 데이터]\n${context || '(데이터 없음)'}`,
      cache_control: { type: 'ephemeral' },
    },
  ];

  const reqBody = JSON.stringify({ model, max_tokens: 1024, system, messages });
  const headers = {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // 과부하(529) 응답은 즉시 반환되므로 재시도 비용이 낮음 → 여러 번 시도
  const MAX_ATTEMPTS = 6;
  const BACKOFF = [400, 800, 1300, 1800, 2200]; // ms (마지막 시도 전까지 누적 ~6.5s)

  let lastErr = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: reqBody });
      const data = await resp.json();

      if (resp.ok) {
        const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
        return { statusCode: 200, body: JSON.stringify({ text, usage: data.usage }) };
      }

      // 과부하(529)/속도제한(429)/일시오류(500,503) → 재시도
      const retriable = [429, 500, 503, 529].includes(resp.status) ||
                        /overloaded/i.test(data?.error?.message || '');
      lastErr = data?.error?.message || `AI 호출 실패 (${resp.status})`;
      if (retriable && attempt < MAX_ATTEMPTS - 1) {
        await sleep(BACKOFF[attempt]);
        continue;
      }
      console.error('[chat] Anthropic API 오류:', data);
      const friendly = retriable
        ? 'AI 서버가 잠시 혼잡합니다. 잠시 후 다시 시도해주세요.'
        : lastErr;
      return { statusCode: resp.status, body: JSON.stringify({ error: friendly }) };
    } catch (err) {
      lastErr = err.message;
      if (attempt < MAX_ATTEMPTS - 1) { await sleep(BACKOFF[attempt]); continue; }
      console.error('[chat] 예외:', err);
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }
  return { statusCode: 503, body: JSON.stringify({ error: lastErr || 'AI 호출 실패' }) };
};
