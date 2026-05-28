import { useState, useCallback, useMemo, useEffect } from 'react';
import { parseGlossaryExcelFile } from '../utils/parseGlossaryExcel';
import { loadDashboard, saveDashboard } from '../utils/firebase';

const STORAGE_KEY = 'glossary';
const FEATURED_CATEGORY = '제품및임상';  // 추천 카드 분야

// 분야별 색상
const CAT_COLORS = {
  '영업활동': '#2563EB', '지원및관리': '#0891B2', '제품및임상': '#059669',
  '인사및문화': '#7C3AED', '마케팅': '#DB2777', '제도및정책': '#B45309',
  '유관부서': '#475569', 'CRM': '#0D9488', '시설': '#9333EA',
};
const catColor = c => CAT_COLORS[c] || '#6B7280';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 용어 카드
function TermCard({ term, query }) {
  const hl = (text) => {
    if (!query || !text) return text;
    const q = query.trim();
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: '#FEF08A', padding: '0 1px', borderRadius: 2 }}>{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  };
  const c = catColor(term.c);
  return (
    <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 18px', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: c, padding: '2px 8px', borderRadius: 10 }}>{term.c}</span>
        <span style={{ fontSize: 17, fontWeight: 800, color: '#111', letterSpacing: '-.01em' }}>{hl(term.t)}</span>
      </div>
      {term.m && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF' }}>의미 </span>
          <span style={{ fontSize: 13, color: '#1F2937', lineHeight: 1.6 }}>{hl(term.m)}</span>
        </div>
      )}
      {term.d && (
        <div style={{ marginBottom: term.e ? 8 : 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF' }}>세부내용 </span>
          <span style={{ fontSize: 12.5, color: '#4B5563', lineHeight: 1.6 }}>{hl(term.d)}</span>
        </div>
      )}
      {term.e && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #E5E7EB' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF' }}>💬 사용 예시 </span>
          <span style={{ fontSize: 12.5, color: '#6B7280', lineHeight: 1.6, fontStyle: 'italic' }}>"{hl(term.e)}"</span>
        </div>
      )}
    </div>
  );
}

export default function DashboardGlossary({ isAdmin }) {
  const [data, setData] = useState(null);
  const [cloudLoading, setCloudLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [query, setQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState(null);
  const [shuffleSeed, setShuffleSeed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await loadDashboard(STORAGE_KEY);
      if (!cancelled) { setData(d); setCloudLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleFile = useCallback(async (file) => {
    setIsLoading(true);
    setUploadError(null);
    try {
      const parsed = await parseGlossaryExcelFile(file);
      await saveDashboard(STORAGE_KEY, parsed);
      setData(parsed);
    } catch (err) {
      setUploadError('업로드 오류: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 용어 목록 파싱
  const terms = useMemo(() => {
    try { return data?.termsJSON ? JSON.parse(data.termsJSON) : []; }
    catch { return []; }
  }, [data]);

  // 분야별 개수
  const categories = useMemo(() => {
    const m = {};
    terms.forEach(x => { if (x.c) m[x.c] = (m[x.c] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [terms]);

  // 검색 결과
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = terms;
    if (selectedCat) list = list.filter(x => x.c === selectedCat);
    if (q) {
      list = list.filter(x =>
        (x.t && x.t.toLowerCase().includes(q)) ||
        (x.m && x.m.toLowerCase().includes(q)) ||
        (x.d && x.d.toLowerCase().includes(q)) ||
        (x.e && x.e.toLowerCase().includes(q))
      );
      // 용어명 매칭을 상위로 정렬
      list = [...list].sort((a, b) => {
        const am = a.t.toLowerCase().includes(q) ? 0 : 1;
        const bm = b.t.toLowerCase().includes(q) ? 0 : 1;
        if (am !== bm) return am - bm;
        return a.t.localeCompare(b.t, 'ko');
      });
    } else {
      list = [...list].sort((a, b) => a.t.localeCompare(b.t, 'ko'));
    }
    return list;
  }, [terms, query, selectedCat]);

  // 추천 카드 (제품및임상 랜덤 6개)
  const featured = useMemo(() => {
    const pool = terms.filter(x => x.c === FEATURED_CATEGORY);
    return shuffle(pool).slice(0, 6);
  }, [terms, shuffleSeed]);

  const isSearching = query.trim() !== '' || selectedCat;

  return (
    <div style={{ fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif" }}>
      {/* 관리자 업로드 */}
      {isAdmin && (
        <div className="mb-6">
          <label className={`flex items-center justify-center gap-3 p-5 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isLoading?'opacity-60':'hover:border-[#1A3A6B] hover:bg-[#F7F7F4]'} border-[#E5E7EB]`}>
            <span className="text-xl">📖</span>
            <div>
              <div className="text-sm font-medium text-[#1A1F2C]">{isLoading?'처리 중...':'용어사전 엑셀 업로드'}</div>
              <div className="text-xs text-[#9CA3AF]">No / 구분 / 용어 / 의미 / 세부내용 / 용어 사용 예시</div>
            </div>
            <input type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => e.target.files[0] && handleFile(e.target.files[0])} disabled={isLoading} />
          </label>
          {uploadError && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{uploadError}</div>
          )}
        </div>
      )}

      <div style={{ background: '#fff', padding: '36px 32px 32px', boxShadow: '0 1px 30px rgba(0,0,0,0.04)', borderRadius: 6, minHeight: 500 }}>
        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 10, letterSpacing: '.18em', color: '#6B7280', fontWeight: 600, marginBottom: 8 }}>SALES PLANNING · GLOSSARY</div>
          <h1 style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 30, fontWeight: 800, letterSpacing: '-.02em' }}>
            영업기획팀 용어사전
          </h1>
          {data && (
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>
              총 <strong style={{ color: '#1A3A6B' }}>{terms.length.toLocaleString()}</strong>개 용어 · {categories.length}개 분야
            </div>
          )}
        </div>

        {/* 검색바 */}
        <div style={{ maxWidth: 640, margin: '0 auto 22px' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#9CA3AF' }}>🔍</span>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="용어를 검색하세요 (예: 가스모틴, 가용오더, 직거래...)"
              style={{
                width: '100%', fontSize: 15, padding: '14px 16px 14px 46px',
                border: '2px solid #E5E7EB', borderRadius: 30, outline: 'none',
                transition: 'border-color .15s',
              }}
              onFocus={e => e.target.style.borderColor = '#1A3A6B'}
              onBlur={e => e.target.style.borderColor = '#E5E7EB'}
            />
            {query && (
              <button onClick={() => setQuery('')}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: '#F3F4F6', border: 'none', borderRadius: 12, width: 24, height: 24, cursor: 'pointer', color: '#6B7280' }}>✕</button>
            )}
          </div>
        </div>

        {cloudLoading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>용어사전을 불러오는 중...</div>
        ) : !data || terms.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#4B5563', marginBottom: 6 }}>아직 용어 데이터가 없습니다</div>
            <div style={{ fontSize: 13 }}>{isAdmin ? '위에서 용어사전 엑셀을 업로드해주세요.' : '관리자에게 문의해주세요.'}</div>
          </div>
        ) : isSearching ? (
          /* ── 검색/브라우즈 결과 ── */
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 13, color: '#6B7280' }}>
                {selectedCat && <span style={{ fontWeight: 700, color: catColor(selectedCat) }}>[{selectedCat}] </span>}
                검색 결과 <strong style={{ color: '#1A3A6B' }}>{results.length}</strong>개
              </div>
              {selectedCat && (
                <button onClick={() => setSelectedCat(null)}
                  style={{ fontSize: 11, padding: '5px 12px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#F9FAFB', color: '#6B7280', cursor: 'pointer' }}>분야 필터 해제 ✕</button>
              )}
            </div>
            {results.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#9CA3AF' }}>
                "{query}"에 해당하는 용어가 없습니다.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
                {results.slice(0, 200).map((t, i) => <TermCard key={i} term={t} query={query} />)}
              </div>
            )}
            {results.length > 200 && (
              <div style={{ marginTop: 14, textAlign: 'center', fontSize: 12, color: '#9CA3AF' }}>
                상위 200개만 표시됩니다. 검색어를 더 구체적으로 입력해보세요.
              </div>
            )}
          </div>
        ) : (
          /* ── 초기 화면 (검색어 없음) ── */
          <div>
            {/* 분야 칩 */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 10, textAlign: 'center' }}>분야별로 둘러보기</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {categories.map(([cat, cnt]) => (
                  <button key={cat} onClick={() => setSelectedCat(cat)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', borderRadius: 20, cursor: 'pointer',
                      border: `1px solid ${catColor(cat)}33`, background: `${catColor(cat)}0D`,
                      fontSize: 13, fontWeight: 600, color: catColor(cat),
                    }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: catColor(cat) }} />
                    {cat}
                    <span style={{ fontSize: 11, opacity: .7 }}>{cnt}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 제품및임상 랜덤 추천 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>💡 이런 용어는 어때요? <span style={{ color: catColor(FEATURED_CATEGORY), fontSize: 11 }}>({FEATURED_CATEGORY})</span></span>
                <button onClick={() => setShuffleSeed(s => s + 1)}
                  style={{ fontSize: 11, padding: '5px 12px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#F9FAFB', color: '#6B7280', cursor: 'pointer' }}>🔄 다른 용어 보기</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
                {featured.map((t, i) => <TermCard key={i} term={t} query="" />)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
