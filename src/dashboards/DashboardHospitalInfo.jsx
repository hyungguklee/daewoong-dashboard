import { useState, useCallback, useEffect, useMemo } from 'react';
import { loadDashboard } from '../utils/firebase';

const CACHE_KEY = 'hira_hospital_cache';
const CL_COLORS = {
  '상급종합': '#1A3A6B', '종합병원': '#2563EB', '병원': '#0891B2', '요양병원': '#7C3AED',
  '의원': '#059669', '치과병원': '#DB2777', '치과의원': '#DB2777', '한방병원': '#B45309',
  '한의원': '#B45309', '보건소': '#475569', '보건지소': '#475569', '조산원': '#9333EA',
};
const clColor = c => CL_COLORS[c] || '#6B7280';

const fmtEstb = (v) => {
  const s = String(v);
  if (s.length !== 8) return s || '-';
  return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`;
};

const RETRY_BACKOFF = [1000, 2000, 3000, 4500]; // 재시도 대기(ms) — 스로틀 회복용

async function fetchPage(pageNo, numOfRows, yadmNm, attempt = 0) {
  const params = new URLSearchParams({ pageNo: String(pageNo), numOfRows: String(numOfRows) });
  if (yadmNm) params.set('yadmNm', yadmNm);
  try {
    const r = await fetch(`/api/hira-hospital?${params}`);
    const text = await r.text();
    if (!text) throw new Error('빈 응답 (서버 시간 초과)');
    let j;
    try { j = JSON.parse(text); }
    catch { throw new Error('응답 형식 오류 (시간 초과 가능)'); }
    if (!r.ok) throw new Error(j.error || '조회 실패');
    return j;
  } catch (e) {
    if (attempt < RETRY_BACKOFF.length) {
      await new Promise(res => setTimeout(res, RETRY_BACKOFF[attempt]));
      return fetchPage(pageNo, numOfRows, yadmNm, attempt + 1);
    }
    throw e;
  }
}

function HospTable({ rows }) {
  return (
    <div style={{ overflow: 'auto', border: '1px solid #E5E7EB', borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 760 }}>
        <thead>
          <tr>
            {['#', '병원명', '종별', '시도', '시군구', '주소', '의사수'].map((h, i) => (
              <th key={i} style={{
                background: '#FAF8F1', padding: '10px 10px', fontSize: 11, fontWeight: 700, color: '#6B7280',
                textAlign: i === 0 ? 'center' : (i === 6 ? 'right' : 'left'),
                borderBottom: '1.5px solid #1A1F2C', whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((h, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }} className="hover:bg-[#FCFAF3]">
              <td style={{ padding: '10px 10px', textAlign: 'center', color: '#9CA3AF', fontSize: 11 }}>{i + 1}</td>
              <td style={{ padding: '10px 10px', fontWeight: 700 }}>{h.yadmNm}</td>
              <td style={{ padding: '10px 10px' }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', background: clColor(h.clCdNm), padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>{h.clCdNm || '-'}</span>
              </td>
              <td style={{ padding: '10px 10px', color: '#4B5563' }}>{h.sidoCdNm}</td>
              <td style={{ padding: '10px 10px', color: '#4B5563' }}>{h.sgguCdNm}</td>
              <td style={{ padding: '10px 10px', color: '#4B5563', fontSize: 12 }}>{h.addr}</td>
              <td style={{ padding: '10px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{Number(h.drTotCnt || 0).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardHospitalInfo({ isAdmin }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null); // null=미검색, []=결과없음
  const [totalCount, setTotalCount] = useState(0);
  const [searchError, setSearchError] = useState(null);

  const [cache, setCache] = useState(null);
  const [cacheLoading, setCacheLoading] = useState(true);

  // 캐시 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await loadDashboard(CACHE_KEY);
      if (!cancelled) { setCache(c); setCacheLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // 검색
  const doSearch = useCallback(async (q) => {
    const term = (q ?? query).trim();
    if (!term) { setResults(null); return; }
    setSearching(true);
    setSearchError(null);
    try {
      const j = await fetchPage(1, 100, term);
      setResults(j.items);
      setTotalCount(j.totalCount);
    } catch (err) {
      setSearchError(err.message);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const isSearching = query.trim() !== '' && results !== null;

  // 통계 정렬
  const classStats = useMemo(() => Object.entries(cache?.byClass || {}).sort((a, b) => b[1] - a[1]), [cache]);
  const sidoStats = useMemo(() => Object.entries(cache?.bySido || {}).sort((a, b) => b[1] - a[1]), [cache]);

  return (
    <div style={{ fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif" }}>
      <div style={{ background: '#fff', padding: '36px 32px 32px', boxShadow: '0 1px 30px rgba(0,0,0,0.04)', borderRadius: 6, minHeight: 500 }}>
        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 10, letterSpacing: '.18em', color: '#6B7280', fontWeight: 600, marginBottom: 8 }}>HIRA · HOSPITAL SEARCH</div>
          <h1 style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 30, fontWeight: 800, letterSpacing: '-.02em' }}>병의원 정보 검색</h1>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>심평원 공공데이터 기반 · 병원명으로 검색하세요</div>
        </div>

        {/* 검색바 */}
        <div style={{ maxWidth: 640, margin: '0 auto 16px' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#9CA3AF' }}>🔍</span>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) doSearch(); }}
              placeholder="병원명을 입력하세요 (예: 서울아산, 연세, 삼성...)"
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

        {searchError && (
          <div style={{ maxWidth: 640, margin: '0 auto 16px', fontSize: 12, color: '#DC2626', background: '#FEE2E2', borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
            {searchError} {searchError.includes('환경변수') && '(관리자: Netlify에 HIRA_SERVICE_KEY 등록 필요)'}
          </div>
        )}

        {isSearching ? (
          /* ── 검색 결과 ── */
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 13, color: '#6B7280' }}>
                "<strong style={{ color: '#1A3A6B' }}>{query}</strong>" 검색 결과 <strong>{totalCount.toLocaleString()}</strong>건
                {totalCount > 100 && <span style={{ color: '#9CA3AF' }}> (상위 100건 표시)</span>}
              </div>
              <button onClick={() => { setQuery(''); setResults(null); }}
                style={{ fontSize: 11, padding: '5px 12px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#F9FAFB', color: '#6B7280', cursor: 'pointer' }}>초기화면으로 ✕</button>
            </div>
            {results.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#9CA3AF' }}>"{query}"에 해당하는 병원이 없습니다.</div>
            ) : (
              <HospTable rows={results} />
            )}
          </div>
        ) : (
          /* ── 초기 화면: 통계 + 신규개설 ── */
          <div>
            {/* 관리자 갱신 안내 (PC 명령 방식) */}
            {isAdmin && (
              <div style={{ marginBottom: 20, padding: '14px 16px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10 }}>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
                  {cache?.updatedAt
                    ? <>마지막 갱신: <strong style={{ color: '#374151' }}>{new Date(cache.updatedAt).toLocaleString('ko-KR')}</strong></>
                    : '아직 갱신된 통계/신규개설 데이터가 없습니다.'}
                </div>
                <div style={{ fontSize: 11.5, color: '#6B7280', lineHeight: 1.6 }}>
                  📌 통계·신규개설 갱신은 PC에서 아래 명령으로 실행하세요 (전국 8만건 스캔, 약 3~5분):
                  <div style={{ marginTop: 6, padding: '8px 12px', background: '#1A1F2C', color: '#E5E7EB', borderRadius: 6, fontFamily: 'monospace', fontSize: 11.5, overflowX: 'auto' }}>
                    node scripts/sync-hospitals.mjs <span style={{ color: '#F59E0B' }}>본인_API키</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 10.5, color: '#9CA3AF' }}>실행 후 이 화면을 새로고침하면 반영됩니다. 주 1회 정도 권장.</div>
                </div>
              </div>
            )}

            {cacheLoading ? (
              <div style={{ padding: 50, textAlign: 'center', color: '#9CA3AF' }}>불러오는 중...</div>
            ) : !cache ? (
              <div style={{ padding: 50, textAlign: 'center', color: '#9CA3AF' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🏥</div>
                <div style={{ fontSize: 13 }}>병원명을 검색하거나, {isAdmin ? '위 버튼으로 통계를 갱신해주세요.' : '관리자가 통계를 갱신하면 현황이 표시됩니다.'}</div>
              </div>
            ) : (
              <>
                {/* 통계 요약 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
                  {/* 전체 + 종별 */}
                  <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 18px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>전국 병의원</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#1A3A6B', marginBottom: 12 }}>{cache.totalCount.toLocaleString()}<span style={{ fontSize: 13, color: '#9CA3AF', marginLeft: 3 }}>개</span></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {classStats.slice(0, 6).map(([cat, cnt]) => (
                        <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 4, background: clColor(cat), flexShrink: 0 }} />
                          <span style={{ color: '#4B5563', flex: 1 }}>{cat}</span>
                          <span style={{ fontWeight: 700, color: '#1F2937', fontVariantNumeric: 'tabular-nums' }}>{cnt.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* 시도별 */}
                  <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 18px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>시도별 분포 (상위)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 16px' }}>
                      {sidoStats.slice(0, 10).map(([sido, cnt]) => (
                        <div key={sido} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: '#4B5563' }}>{sido}</span>
                          <span style={{ fontWeight: 700, color: '#1F2937', fontVariantNumeric: 'tabular-nums' }}>{cnt.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 신규 개설 병원 */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
                    <span style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 17, fontWeight: 700 }}>🆕 최근 30일 신규 개설 병의원</span>
                    <span style={{ fontSize: 12, color: '#6B7280' }}>{(cache.newlyOpened || []).length}개</span>
                  </div>
                  {(cache.newlyOpened || []).length === 0 ? (
                    <div style={{ padding: '30px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>최근 30일 내 신규 개설 병의원이 없습니다.</div>
                  ) : (
                    <div style={{ overflow: 'auto', border: '1px solid #E5E7EB', borderRadius: 8 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 720 }}>
                        <thead>
                          <tr>
                            {['#', '병원명', '종별', '시도', '시군구', '주소', '개설일'].map((h, i) => (
                              <th key={i} style={{ background: '#FAF8F1', padding: '10px 10px', fontSize: 11, fontWeight: 700, color: '#6B7280', textAlign: i === 0 ? 'center' : (i === 6 ? 'right' : 'left'), borderBottom: '1.5px solid #1A1F2C', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(cache.newlyOpened || []).map((h, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }} className="hover:bg-[#FCFAF3]">
                              <td style={{ padding: '10px 10px', textAlign: 'center', color: '#9CA3AF', fontSize: 11 }}>{i + 1}</td>
                              <td style={{ padding: '10px 10px', fontWeight: 700 }}>{h.yadmNm}</td>
                              <td style={{ padding: '10px 10px' }}><span style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', background: clColor(h.clCdNm), padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>{h.clCdNm || '-'}</span></td>
                              <td style={{ padding: '10px 10px', color: '#4B5563' }}>{h.sidoCdNm}</td>
                              <td style={{ padding: '10px 10px', color: '#4B5563' }}>{h.sgguCdNm}</td>
                              <td style={{ padding: '10px 10px', color: '#4B5563', fontSize: 12 }}>{h.addr}</td>
                              <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>{fmtEstb(h.estbDd)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
