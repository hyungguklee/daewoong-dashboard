import { useState, useRef, useEffect, useCallback } from 'react';
import { buildAIContext } from '../utils/buildAIContext';

const SUGGESTIONS = [
  'MBO 병원에서 S등급 사무소는?',
  '직거래 달성률 1위 사업부는?',
  '고객단계 4단계↑ 인당 가장 높은 사무소는?',
  'SOP 이번 달 성공자 알려줘',
];

export default function ChatWidget({ period }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // {role, content}
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showNudge, setShowNudge] = useState(false);   // 안내 말풍선
  const [isMobile, setIsMobile] = useState(false);     // 모바일 여부 (라벨 숨김용)

  // 컨텍스트 캐시 (기간이 바뀌면 갱신)
  const contextRef = useRef({ period: null, text: null });
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  // 모바일 감지
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // 첫 방문 안내 말풍선 (세션당 1회, 채팅 안 열었을 때만)
  useEffect(() => {
    if (sessionStorage.getItem('chatNudgeDismissed')) return;
    const t = setTimeout(() => {
      if (!open) setShowNudge(true);
    }, 2500);
    return () => clearTimeout(t);
  }, [open]);

  const dismissNudge = useCallback(() => {
    setShowNudge(false);
    sessionStorage.setItem('chatNudgeDismissed', '1');
  }, []);

  const openChat = useCallback(() => {
    setOpen(true);
    setShowNudge(false);
    sessionStorage.setItem('chatNudgeDismissed', '1');
  }, []);

  const ensureContext = useCallback(async () => {
    if (contextRef.current.period === period && contextRef.current.text) {
      return contextRef.current.text;
    }
    const text = await buildAIContext(period);
    contextRef.current = { period, text };
    return text;
  }, [period]);

  const send = useCallback(async (text) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setError(null);
    setInput('');
    const newMessages = [...messages, { role: 'user', content: q }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const context = await ensureContext();
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          context,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'AI 호출 실패');
      setMessages(m => [...m, { role: 'assistant', content: data.text || '(응답 없음)' }]);
    } catch (err) {
      setError(err.message);
      setMessages(m => [...m, { role: 'assistant', content: '⚠️ 오류가 발생했습니다: ' + err.message }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, ensureContext]);

  return (
    <>
      <style>{`@keyframes chatNudgeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      {/* 떠있는 버튼 + 안내 말풍선 */}
      {!open && (
        <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          {/* 안내 말풍선 (nudge) */}
          {showNudge && (
            <div style={{
              position: 'relative', maxWidth: 240,
              background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14,
              boxShadow: '0 8px 28px rgba(0,0,0,.16)', padding: '14px 16px',
              animation: 'chatNudgeIn .35s ease',
            }}>
              <button onClick={dismissNudge}
                style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>✕</button>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1A3A6B', marginBottom: 4 }}>평가 데이터가 궁금하세요? 👋</div>
              <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                AI에게 편하게 물어보세요.<br />"직거래 달성률 1위 사업부는?" 처럼요!
              </div>
              {/* 꼬리 */}
              <div style={{ position: 'absolute', bottom: -7, right: 28, width: 14, height: 14, background: '#fff', borderRight: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB', transform: 'rotate(45deg)' }} />
            </div>
          )}

          {/* 알약형 버튼 */}
          <button
            onClick={openChat}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: isMobile ? 0 : '0 20px 0 16px',
              width: isMobile ? 60 : 'auto', height: 60,
              justifyContent: 'center', borderRadius: 30,
              background: 'linear-gradient(135deg, #1A3A6B 0%, #2C3548 100%)',
              color: '#fff', border: 'none', cursor: 'pointer',
              boxShadow: '0 6px 24px rgba(0,0,0,.28)',
              fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap',
              transition: 'transform .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            title="AI에게 물어보기"
          >
            <span style={{ fontSize: 24, lineHeight: 1 }}>🤖</span>
            {!isMobile && <span>AI에게 물어보기</span>}
          </button>
        </div>
      )}

      {/* 채팅 패널 */}
      {open && (
        <div style={{
          position: 'fixed', right: 24, bottom: 24, zIndex: 1000,
          width: 'min(420px, calc(100vw - 32px))', height: 'min(620px, calc(100vh - 48px))',
          background: '#fff', borderRadius: 16,
          boxShadow: '0 12px 48px rgba(0,0,0,.25)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          border: '1px solid #E5E7EB',
        }}>
          {/* 헤더 */}
          <div style={{
            background: 'linear-gradient(135deg, #1A3A6B 0%, #2C3548 100%)',
            color: '#fff', padding: '16px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>📊 평가 데이터 AI</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', marginTop: 2 }}>{period} 기준 · 대시보드 데이터 기반 답변</div>
            </div>
            <button onClick={() => setOpen(false)}
              style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>

          {/* 메시지 영역 */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#F9FAFB' }}>
            {messages.length === 0 && (
              <div>
                <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 14, padding: '12px 14px', background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                  안녕하세요! 👋 영업기획팀 평가 데이터에 대해 무엇이든 물어보세요.<br />
                  9개 과제(MBO·풀동도·110대병원·2차병원·고객단계·SOP·직거래·신제품)의 본부·사업부·사무소·MR 데이터를 근거로 답변드립니다.
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8, fontWeight: 600 }}>예시 질문</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} onClick={() => send(s)}
                      style={{
                        textAlign: 'left', fontSize: 12, padding: '9px 12px',
                        background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
                        color: '#374151', cursor: 'pointer',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#1A3A6B'; e.currentTarget.style.background = '#F0F4FA'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#fff'; }}
                    >{s}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                <div style={{
                  maxWidth: '85%', padding: '10px 13px', borderRadius: 12, fontSize: 13, lineHeight: 1.6,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  background: m.role === 'user' ? '#1A3A6B' : '#fff',
                  color: m.role === 'user' ? '#fff' : '#1F2937',
                  border: m.role === 'user' ? 'none' : '1px solid #E5E7EB',
                }}>{m.content}</div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
                <div style={{ padding: '10px 14px', borderRadius: 12, fontSize: 13, background: '#fff', border: '1px solid #E5E7EB', color: '#9CA3AF' }}>
                  생각 중...
                </div>
              </div>
            )}
          </div>

          {/* 입력 영역 */}
          <div style={{ padding: 12, borderTop: '1px solid #E5E7EB', background: '#fff' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send(); }}
                placeholder="질문을 입력하세요..."
                disabled={loading}
                style={{
                  flex: 1, fontSize: 13, padding: '10px 12px',
                  border: '1.5px solid #E5E7EB', borderRadius: 10, outline: 'none',
                }}
              />
              <button onClick={() => send()} disabled={loading || !input.trim()}
                style={{
                  padding: '0 16px', fontSize: 13, fontWeight: 700,
                  background: loading || !input.trim() ? '#D1D5DB' : '#1A3A6B',
                  color: '#fff', border: 'none', borderRadius: 10,
                  cursor: loading || !input.trim() ? 'default' : 'pointer',
                }}>↑</button>
            </div>
            <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 6, textAlign: 'center' }}>
              AI 답변은 참고용입니다. 중요한 수치는 대시보드에서 직접 확인하세요.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
