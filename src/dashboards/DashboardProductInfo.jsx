import { useState, useCallback } from 'react';

const EXAMPLES = ['타이레놀', '우루사', '베아제', '판콜', '게보린', '후시딘'];

function Field({ label, value, color }) {
  if (!value) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{value}</div>
    </div>
  );
}

function DrugCard({ d }) {
  return (
    <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: '18px 20px', background: '#fff', display: 'flex', gap: 16 }}>
      {d.itemImage && (
        <img src={d.itemImage} alt={d.itemName} loading="lazy"
          style={{ width: 90, height: 64, objectFit: 'contain', borderRadius: 6, border: '1px solid #F3F4F6', flexShrink: 0, background: '#FAFAF8' }}
          onError={e => { e.currentTarget.style.display = 'none'; }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#111', letterSpacing: '-.01em' }}>{d.itemName}</span>
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>🏭 {d.entpName}</div>
        <Field label="💊 효능" value={d.efcyQesitm} color="#059669" />
        <Field label="⚠️ 사용상 주의사항" value={d.atpnQesitm} color="#B45309" />
        <Field label="🩺 이상반응" value={d.seQesitm} color="#DC2626" />
      </div>
    </div>
  );
}

export default function DashboardProductInfo() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState(null);

  const doSearch = useCallback(async (q) => {
    const term = (q ?? query).trim();
    if (!term) { setResults(null); return; }
    if (q != null) setQuery(q);
    setSearching(true);
    setError(null);
    try {
      const r = await fetch(`/api/hira-drug?itemName=${encodeURIComponent(term)}&pageNo=1&numOfRows=30`);
      const text = await r.text();
      let j;
      try { j = JSON.parse(text); } catch { throw new Error('응답 형식 오류'); }
      if (!r.ok) throw new Error(j.error || '조회 실패');
      setResults(j.items);
      setTotalCount(j.totalCount);
    } catch (err) {
      setError(err.message);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const isSearching = query.trim() !== '' && results !== null;

  return (
    <div style={{ fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif" }}>
      <div style={{ background: '#fff', padding: '36px 32px 32px', boxShadow: '0 1px 30px rgba(0,0,0,0.04)', borderRadius: 6, minHeight: 500 }}>
        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 10, letterSpacing: '.18em', color: '#6B7280', fontWeight: 600, marginBottom: 8 }}>MFDS · DRUG INFO</div>
          <h1 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 30, fontWeight: 800, letterSpacing: '-.02em' }}>품목 정보 검색</h1>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>식약처 의약품개요정보(e약은요) · 제품명으로 검색하세요</div>
        </div>

        {/* 검색바 */}
        <div style={{ maxWidth: 640, margin: '0 auto 16px' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#9CA3AF' }}>🔍</span>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) doSearch(); }}
              placeholder="제품명을 입력하세요 (예: 타이레놀, 우루사...)"
              style={{ width: '100%', fontSize: 15, padding: '14px 110px 14px 46px', border: '2px solid #E5E7EB', borderRadius: 30, outline: 'none' }}
              onFocus={e => e.target.style.borderColor = '#1A3A6B'}
              onBlur={e => e.target.style.borderColor = '#E5E7EB'}
            />
            <button onClick={() => doSearch()} disabled={searching || !query.trim()}
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', padding: '9px 18px', fontSize: 13, fontWeight: 700, background: searching || !query.trim() ? '#D1D5DB' : '#1A3A6B', color: '#fff', border: 'none', borderRadius: 24, cursor: searching || !query.trim() ? 'default' : 'pointer' }}>
              {searching ? '검색 중' : '검색'}
            </button>
            {query && !searching && (
              <button onClick={() => { setQuery(''); setResults(null); }}
                style={{ position: 'absolute', right: 92, top: '50%', transform: 'translateY(-50%)', background: '#F3F4F6', border: 'none', borderRadius: 12, width: 22, height: 22, cursor: 'pointer', color: '#6B7280', fontSize: 11 }}>✕</button>
            )}
          </div>
        </div>

        {error && (
          <div style={{ maxWidth: 640, margin: '0 auto 16px', fontSize: 12, color: '#DC2626', background: '#FEE2E2', borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
            {error} {error.includes('환경변수') && '(관리자: Netlify에 HIRA_SERVICE_KEY 등록 필요)'}
          </div>
        )}

        {isSearching ? (
          /* ── 검색 결과 ── */
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 13, color: '#6B7280' }}>
                "<strong style={{ color: '#1A3A6B' }}>{query}</strong>" 검색 결과 <strong>{totalCount.toLocaleString()}</strong>건
                {totalCount > 30 && <span style={{ color: '#9CA3AF' }}> (상위 30건 표시)</span>}
              </div>
              <button onClick={() => { setQuery(''); setResults(null); }}
                style={{ fontSize: 11, padding: '5px 12px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#F9FAFB', color: '#6B7280', cursor: 'pointer' }}>초기화면으로 ✕</button>
            </div>
            {results.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#9CA3AF' }}>
                "{query}"에 해당하는 품목이 없습니다.<br />
                <span style={{ fontSize: 12 }}>※ e약은요는 주로 일반의약품 정보라, 전문의약품은 조회되지 않을 수 있습니다.</span>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 12 }}>
                {results.map((d, i) => <DrugCard key={i} d={d} />)}
              </div>
            )}
          </div>
        ) : (
          /* ── 초기 화면 ── */
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 18, lineHeight: 1.7 }}>
              제품명을 검색하면 <strong>업체명 · 효능 · 사용상 주의사항 · 이상반응</strong> 정보를 보여드립니다.<br />
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>식약처 의약품개요정보(e약은요) 기준 · 주로 일반의약품(OTC) 정보</span>
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginBottom: 10 }}>이런 제품을 검색해보세요</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => doSearch(ex)}
                  style={{ padding: '8px 16px', borderRadius: 20, border: '1px solid #E5E7EB', background: '#F9FAFB', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#1A3A6B'; e.currentTarget.style.background = '#F0F4FA'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#F9FAFB'; }}
                >{ex}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
