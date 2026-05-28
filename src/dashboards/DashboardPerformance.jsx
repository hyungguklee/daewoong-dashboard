import { useState, useCallback, useMemo, useEffect } from 'react';
import { parsePerformanceExcelFile } from '../utils/parsePerformanceExcel';
import { loadDashboard, saveDashboard } from '../utils/firebase';

const POS = '#059669';   // 성장 양수
const NEG = '#DC2626';   // 성장 음수
const INK = '#1A1F2C';

const TAB_INFO = {
  local: {
    label: '로컬',
    storageKey: 'performance_local',
    title: 'ETC로컬 실적',
    eyebrow: 'SALES PERFORMANCE · LOCAL',
    excludeFn: (name) => name === '서울3(MS)' || name === 'MS' || name === 'MS(서울3)',
    excludeNote: '서울3(MS)',
  },
  hospital: {
    label: '병원',
    storageKey: 'performance_hospital',
    title: 'ETC병원 실적',
    eyebrow: 'SALES PERFORMANCE · HOSPITAL',
    excludeFn: (name) => String(name).includes('프로트랙'),
    excludeNote: '프로트랙',
  },
};

const pctStr = (v, dec = 1) => v == null || isNaN(v) ? '-' : (v * 100).toFixed(dec) + '%';
const money = v => {
  if (v == null || isNaN(v) || v === 0) return '-';
  const a = Math.abs(v);
  if (a >= 1e8) return (v / 1e8).toFixed(2) + '억';
  if (a >= 1e4) return Math.round(v / 1e4).toLocaleString() + '만';
  return Math.round(v).toLocaleString();
};
const growthColor = v => (v == null || isNaN(v)) ? '#6B7280' : (v >= 0 ? POS : NEG);

// ─── 사무소 → 담당자 → 거래처 드릴다운 모달 ──────────────────────────────────
function DrillModal({ office, reps, clientsBySano, onClose }) {
  const [selectedRep, setSelectedRep] = useState(null);
  if (!office) return null;

  // 해당 사무소 담당자 (office 이름으로 매칭)
  const officeReps = reps
    .filter(r => r.office === office.office)
    .sort((a, b) => (b.growthRate || 0) - (a.growthRate || 0));

  // 선택된 담당자의 거래처 (사번으로 매칭) — {n: 거래처명, s: 최종실적}
  const clients = selectedRep
    ? (clientsBySano[selectedRep.sano] || []).slice().sort((a, b) => (b.s || 0) - (a.s || 0))
    : [];

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content animate-in" style={{ maxWidth: 920 }}>
        {/* 헤더 */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: '.16em', color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
              {selectedRep ? '담당자 → 거래처별 실적' : '사무소 → 담당자 실적'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              {selectedRep && (
                <button onClick={() => setSelectedRep(null)}
                  style={{ fontSize: 12, color: '#3D5A8C', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  ← 담당자 목록
                </button>
              )}
              <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.02em' }}>
                {selectedRep ? selectedRep.name : office.office}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>
              {selectedRep
                ? `${office.office} · 사번 ${selectedRep.sano} · 거래처 ${clients.length}개 · 최종실적 ${money(selectedRep.sales)}`
                : `${office.division} · 담당자 ${officeReps.length}명 · 최종실적 ${money(office.sales)} · 성장률 ${pctStr(office.growthRate)}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #E5E7EB', color: '#6B7280', width: 30, height: 30, borderRadius: 6, cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        <div style={{ padding: '16px 22px 20px', overflowY: 'auto', maxHeight: 'calc(88vh - 120px)' }}>
          {!selectedRep ? (
            /* 담당자 목록 */
            <div style={{ border: '1px solid #E5E7EB', borderRadius: 6, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['#', '담당자', '사번', '기준점', '최종실적', '성장금액', '성장률', ''].map((h, i) => (
                      <th key={i} style={thStyle(i === 0 ? 'center' : (i === 1 || i === 2 ? 'left' : (i === 7 ? 'center' : 'right')))}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {officeReps.map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #F3F4F6', cursor: 'pointer' }} className="hover:bg-[#FCFAF3]" onClick={() => setSelectedRep(r)}>
                      <td style={{ padding: '9px 8px', textAlign: 'center', color: '#9CA3AF', fontSize: 11 }}>{i + 1}</td>
                      <td style={{ padding: '9px 8px', fontWeight: 700, color: '#3D5A8C' }}>{r.name} ›</td>
                      <td style={{ padding: '9px 8px', color: '#9CA3AF', fontSize: 11 }}>{r.sano}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(r.base)}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{money(r.sales)}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: growthColor(r.growth) }}>{r.growth >= 0 ? '+' : ''}{money(r.growth)}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 800, color: growthColor(r.growthRate) }}>{r.growthRate >= 0 ? '+' : ''}{pctStr(r.growthRate)}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'center', color: '#9CA3AF' }}>›</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {officeReps.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: '#9CA3AF' }}>담당자 데이터 없음</div>}
            </div>
          ) : (
            /* 거래처 목록 */
            <div style={{ border: '1px solid #E5E7EB', borderRadius: 6, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['#', '거래처명', '최종실적'].map((h, i) => (
                      <th key={i} style={thStyle(i === 0 ? 'center' : (i === 1 ? 'left' : 'right'))}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #F3F4F6' }} className="hover:bg-[#FCFAF3]">
                      <td style={{ padding: '8px 8px', textAlign: 'center', color: '#9CA3AF', fontSize: 11 }}>{i + 1}</td>
                      <td style={{ padding: '8px 8px', fontWeight: 600 }}>{c.n}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{money(c.s)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {clients.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: '#9CA3AF' }}>거래처 데이터 없음</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function thStyle(align) {
  return {
    background: '#FAF8F1', padding: '9px 8px', fontSize: 10.5, fontWeight: 700,
    color: '#6B7280', textAlign: align, borderBottom: '1.5px solid #1A1F2C', whiteSpace: 'nowrap',
  };
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
export default function DashboardPerformance({ isAdmin, period, type = 'local' }) {
  const tab = TAB_INFO[type];
  const [index, setIndex] = useState(null);          // { period(최신), periods:[] }
  const [periodData, setPeriodData] = useState(null); // 현재 표시 월의 데이터
  const [cloudLoading, setCloudLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [selectedOffice, setSelectedOffice] = useState(null);
  const [divFilter, setDivFilter] = useState('전체');     // 사업부 필터
  const [officeFilter, setOfficeFilter] = useState('전체'); // 사무소 필터

  // 월별 문서 키 (공백 제거)
  const periodKey = useCallback(p => `${tab.storageKey}__${String(p).replace(/\s/g, '')}`, [tab.storageKey]);

  // 특정 월의 데이터 로드 (신형식 월별문서 → 구형식 임베디드 history 폴백)
  const loadHeavy = useCallback(async (p) => {
    if (!p) return null;
    const perDoc = await loadDashboard(periodKey(p));
    if (perDoc && (perDoc.total || perDoc.offices)) return perDoc;
    const idx = await loadDashboard(tab.storageKey);
    if (idx) {
      if (idx.history?.[p]) return { ...idx.history[p], period: p };
      if (idx.period === p) return idx;
    }
    return null;
  }, [periodKey, tab.storageKey]);

  // 인덱스 로드 (mount 시)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const idx = await loadDashboard(tab.storageKey);
      if (cancelled) return;
      const periods = idx?.periods || Object.keys(idx?.history || {});
      setIndex(idx ? { ...idx, periods } : { periods: [] });
      setCloudLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tab.storageKey]);

  // 선택 월 데이터 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!index) return;
      const has = (index.periods || []).includes(period);
      if (!has) { if (!cancelled) setPeriodData(null); return; }
      const heavy = await loadHeavy(period);
      if (!cancelled) setPeriodData(heavy);
    })();
    return () => { cancelled = true; };
  }, [period, index, loadHeavy]);

  const handleFile = useCallback(async (file) => {
    setIsLoading(true);
    setUploadError(null);
    try {
      const parsed = await parsePerformanceExcelFile(file);
      if (parsed.type !== type) {
        throw new Error(`현재 ${tab.label} 탭이지만 업로드된 파일은 ${parsed.type === 'hospital' ? '병원' : '로컬'} 양식입니다`);
      }
      // 월별 문서로 저장 (거래처 JSON 문자열 포함) → 1MB 한도 회피
      const heavy = {
        type: parsed.type, period,
        total: parsed.total, divisions: parsed.divisions, offices: parsed.offices, reps: parsed.reps,
        clientsJSON: JSON.stringify(parsed.clientsBySano || {}),
      };
      await saveDashboard(periodKey(period), heavy);

      // 기존 인덱스 로드 + 구형식 history가 있으면 월별 문서로 마이그레이션
      const idx = await loadDashboard(tab.storageKey);
      if (idx?.history) {
        for (const [p, slice] of Object.entries(idx.history)) {
          if (p === period) continue;
          const exist = await loadDashboard(periodKey(p));
          if (!exist || !(exist.total || exist.offices)) {
            await saveDashboard(periodKey(p), { type: idx.type || parsed.type, period: p, ...slice });
          }
        }
      }
      const prevPeriods = idx?.periods || Object.keys(idx?.history || {});
      const periods = Array.from(new Set([...prevPeriods, period]));
      const newIndex = { type: parsed.type, period, periods };
      await saveDashboard(tab.storageKey, newIndex);  // 슬림 인덱스로 교체

      setIndex(newIndex);
      setPeriodData(heavy);
    } catch (err) {
      setUploadError('업로드 오류: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [period, type, tab, periodKey]);

  const handleDelete = async () => {
    if (!window.confirm(`${period} ${tab.label} 실적 데이터를 삭제하시겠습니까?`)) return;
    setIsLoading(true);
    try {
      const idx = await loadDashboard(tab.storageKey);
      const prevPeriods = idx?.periods || Object.keys(idx?.history || {});
      const periods = prevPeriods.filter(p => p !== period);
      await saveDashboard(periodKey(period), { period: null }); // 월별 문서 비우기
      const newLatest = periods.length ? periods[periods.length - 1] : null;
      const newIndex = { type: idx?.type || type, period: newLatest, periods };
      await saveDashboard(tab.storageKey, newIndex);
      setIndex(newIndex);
      setPeriodData(null);
    } catch (err) {
      setUploadError('삭제 오류: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const displayData = periodData;
  const { total, divisions = [], offices = [], reps = [] } = displayData || {};

  // 거래처는 JSON 문자열로 저장됨 → 파싱
  const clientsBySano = useMemo(() => {
    try { return displayData?.clientsJSON ? JSON.parse(displayData.clientsJSON) : {}; }
    catch { return {}; }
  }, [displayData]);

  const mainDivisions = useMemo(() => divisions.filter(d => !tab.excludeFn(d.name)), [divisions, tab]);
  const sortedDivisions = useMemo(() => [...mainDivisions].sort((a, b) => (b.growthRate || 0) - (a.growthRate || 0)), [mainDivisions]);

  // 필터 옵션 (한글 내림차순)
  const divOptions = useMemo(() => {
    const set = [...new Set(offices.map(o => o.division).filter(Boolean))];
    return set.sort((a, b) => b.localeCompare(a, 'ko'));
  }, [offices]);
  const officeOptions = useMemo(() => {
    let list = offices;
    if (divFilter !== '전체') list = list.filter(o => o.division === divFilter);
    return [...new Set(list.map(o => o.office).filter(Boolean))].sort((a, b) => b.localeCompare(a, 'ko'));
  }, [offices, divFilter]);

  // 사무소 실적: 성장률 내림차순 정렬 후 필터 적용
  const sortedOffices = useMemo(() => {
    let list = [...offices].sort((a, b) => (b.growthRate || 0) - (a.growthRate || 0));
    if (divFilter !== '전체') list = list.filter(o => o.division === divFilter);
    if (officeFilter !== '전체') list = list.filter(o => o.office === officeFilter);
    return list;
  }, [offices, divFilter, officeFilter]);

  return (
    <div style={{ fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif" }}>
      {/* 업로드 / 삭제 */}
      {isAdmin && (
        <div className="mb-6">
          <div className="flex gap-2 items-stretch">
            <label className={`flex-1 flex items-center justify-center gap-3 p-5 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isLoading?'opacity-60':'hover:border-[#1A1F2C] hover:bg-[#F7F7F4]'} border-[#E5E7EB]`}>
              <span className="text-xl">💰</span>
              <div>
                <div className="text-sm font-medium text-[#1A1F2C]">{isLoading?'처리 중...':`${tab.label} 실적 엑셀 업로드`}</div>
                <div className="text-xs text-[#9CA3AF]">{tab.label} 실적 엑셀 (.xlsb) — 26년 X월</div>
              </div>
              <input type="file" accept=".xlsb,.xlsx,.xls" className="hidden"
                onChange={e => e.target.files[0] && handleFile(e.target.files[0])} disabled={isLoading} />
            </label>
            <button onClick={handleDelete}
              className="flex flex-col items-center justify-center gap-1 px-5 rounded-xl border-2 border-dashed border-red-200 text-red-400 hover:bg-red-50 hover:border-red-400 hover:text-red-600 transition-all text-xs font-medium whitespace-nowrap">
              <span className="text-lg">🗑️</span>
              <span>{period}</span>
              <span>데이터 삭제</span>
            </button>
          </div>
          {uploadError && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{uploadError}</div>
          )}
        </div>
      )}

      <div style={{ background: '#fff', padding: '36px 28px 28px', boxShadow: '0 1px 30px rgba(0,0,0,0.04)', borderRadius: 6 }}>
        {/* 헤더 */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 18, borderBottom: '2px solid #1A1F2C', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '.18em', color: '#6B7280', fontWeight: 600, marginBottom: 8 }}>{tab.eyebrow}</div>
            <h1 style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 30, fontWeight: 800, letterSpacing: '-.015em', lineHeight: 1.1 }}>
              {tab.title} <span style={{ fontWeight: 300, color: '#4B5563' }}>리포트</span>
            </h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 24, fontWeight: 700, letterSpacing: '-.01em' }}>{period}</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>50% 품목 기준점 적용 · 성장평가품목 반영</div>
          </div>
        </header>

        {cloudLoading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>데이터 불러오는 중...</div>
        ) : (!displayData || !offices.length) ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">📭</div>
            <div className="text-base font-bold text-[#4B5563] mb-2">{period} 실적 데이터가 없습니다</div>
            <div className="text-sm text-[#9CA3AF]">{isAdmin ? '위에서 엑셀 파일을 업로드해주세요. (3월 기준 데이터)' : '관리자에게 문의해주세요.'}</div>
          </div>
        ) : (
          <>
            {/* 섹션 01: 본부 현황 */}
            <section style={{ marginBottom: 36 }}>
              <SecHead num="01" title="본부 현황" sub={`${tab.label} 전사 종합 / ${mainDivisions.length}개 사업부 · ${offices.length}개 사무소 · 담당자 ${reps.length}명`} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <KpiCard label="최종실적 (50% 기준)" core coreLabel="CORE KPI" note={`기준점 ${money(total?.base)} 대비`}>
                  <span style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 30, fontWeight: 800, color: '#34D399', letterSpacing: '-.025em', lineHeight: 1 }}>{money(total?.sales)}</span>
                </KpiCard>
                <KpiCard label="성장률" valueColor={growthColor(total?.growthRate)} note={`${mainDivisions.length}개 사업부 종합`}>
                  <span style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 32, fontWeight: 800, color: growthColor(total?.growthRate), letterSpacing: '-.025em', lineHeight: 1 }}>
                    {total?.growthRate >= 0 ? '+' : ''}{pctStr(total?.growthRate)}
                  </span>
                </KpiCard>
                <KpiCard label="성장금액" note="최종실적 - 기준점">
                  <span style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 28, fontWeight: 800, color: growthColor(total?.growth), letterSpacing: '-.025em', lineHeight: 1 }}>
                    {total?.growth >= 0 ? '+' : ''}{money(total?.growth)}
                  </span>
                </KpiCard>
                <KpiCard label="기준점" note="50% 품목 기준점">
                  <span style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 28, fontWeight: 800, color: INK, letterSpacing: '-.025em', lineHeight: 1 }}>{money(total?.base)}</span>
                </KpiCard>
              </div>
            </section>

            {/* 섹션 02: 사업부 평가 */}
            <section style={{ marginBottom: 36 }}>
              <SecHead num="02" title="사업부 실적" sub={`${mainDivisions.length}개 사업부 · 성장률 내림차순`} />
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, Math.min(4, sortedDivisions.length))}, 1fr)`, gap: 12 }}>
                {sortedDivisions.map(d => <DivCard key={d.name} div={d} />)}
              </div>
            </section>

            {/* 섹션 03: 사무소 평가 */}
            <section>
              <SecHead num="03" title="사무소 실적" sub={`${sortedOffices.length}개 사무소 · 성장률 내림차순 · 사무소명 클릭 → 담당자 → 거래처`} />

              {/* 필터 (사업부 / 사무소) */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>사업부</span>
                  <select
                    value={divFilter}
                    onChange={e => { setDivFilter(e.target.value); setOfficeFilter('전체'); }}
                    style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', cursor: 'pointer', minWidth: 110 }}
                  >
                    <option value="전체">전체</option>
                    {divOptions.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>사무소</span>
                  <select
                    value={officeFilter}
                    onChange={e => setOfficeFilter(e.target.value)}
                    style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', cursor: 'pointer', minWidth: 130 }}
                  >
                    <option value="전체">전체</option>
                    {officeOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                {(divFilter !== '전체' || officeFilter !== '전체') && (
                  <button
                    onClick={() => { setDivFilter('전체'); setOfficeFilter('전체'); }}
                    style={{ fontSize: 11, padding: '6px 12px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#F9FAFB', color: '#6B7280', cursor: 'pointer' }}
                  >필터 초기화 ✕</button>
                )}
              </div>

              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 760 }}>
                  <thead>
                    <tr>
                      {['#', '사업부', '사무소', '기준점', '최종실적', '성장금액', '성장률'].map((h, i) => (
                        <th key={i} style={{
                          textAlign: i === 0 ? 'center' : (i <= 2 ? 'left' : 'right'),
                          padding: '11px 10px', fontWeight: 500, color: '#6B7280', fontSize: 10.5,
                          borderBottom: '1.5px solid #1A1F2C', borderTop: '1px solid #E5E7EB',
                          background: '#FAF8F1', whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedOffices.map((o, idx) => (
                      <tr key={o.office + idx} style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }} className="hover:bg-[#F7F7F4]" onClick={() => setSelectedOffice(o)}>
                        <td style={{ padding: '11px 10px', textAlign: 'center', color: '#9CA3AF', fontSize: 10.5 }}>{idx + 1}</td>
                        <td style={{ padding: '11px 10px', fontSize: 11.5 }}>{o.division}</td>
                        <td style={{ padding: '11px 10px' }}>
                          <span style={{ color: '#3D5A8C', fontWeight: 700, borderBottom: '1px dashed #3D5A8C', paddingBottom: 1 }}>{o.office} ›</span>
                        </td>
                        <td style={{ padding: '11px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{money(o.base)}</td>
                        <td style={{ padding: '11px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{money(o.sales)}</td>
                        <td style={{ padding: '11px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: growthColor(o.growth) }}>{o.growth >= 0 ? '+' : ''}{money(o.growth)}</td>
                        <td style={{ padding: '11px 10px', textAlign: 'right', fontWeight: 800, color: growthColor(o.growthRate) }}>{o.growthRate >= 0 ? '+' : ''}{pctStr(o.growthRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sortedOffices.length === 0 && (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: '#9CA3AF' }}>조건에 맞는 사무소가 없습니다</div>
                )}
              </div>
            </section>

            <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #E5E7EB', textAlign: 'center', fontSize: 10.5, color: '#9CA3AF' }}>
              ※ 자료 기준일: {period} · 단위: 억원 · {tab.excludeNote} 사업부 섹션 제외
            </div>
          </>
        )}
      </div>

      {selectedOffice && (
        <DrillModal office={selectedOffice} reps={reps} clientsBySano={clientsBySano} onClose={() => setSelectedOffice(null)} />
      )}
    </div>
  );
}

function SecHead({ num, title, sub }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, letterSpacing: '.05em' }}>{num}</span>
        <h2 style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 18, fontWeight: 700 }}>{title}</h2>
      </div>
      <div style={{ fontSize: 11, color: '#6B7280' }}>{sub}</div>
    </div>
  );
}

function KpiCard({ label, children, note, core = false, coreLabel }) {
  return (
    <div style={{
      border: '1px solid #E5E7EB', borderRadius: 4, padding: '20px 20px 16px',
      background: core ? 'linear-gradient(135deg, #1A1F2C 0%, #2C3548 100%)' : '#fff',
      color: core ? '#fff' : 'inherit', borderColor: core ? '#1A1F2C' : '#E5E7EB',
      position: 'relative', minHeight: 130, display: 'flex', flexDirection: 'column',
    }}>
      {core && coreLabel && (
        <div style={{ position: 'absolute', top: 18, right: 18, fontSize: 9, letterSpacing: '.18em', color: 'rgba(255,255,255,.5)', fontWeight: 700 }}>{coreLabel}</div>
      )}
      <div style={{ fontSize: 12, color: core ? 'rgba(255,255,255,.6)' : '#6B7280', marginBottom: 12, fontWeight: 500 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10, flex: 1 }}>{children}</div>
      {note && (
        <div style={{ fontSize: 11, color: core ? 'rgba(255,255,255,.55)' : '#6B7280', paddingTop: 10, borderTop: `1px solid ${core ? 'rgba(255,255,255,.1)' : '#F3F4F6'}` }}>{note}</div>
      )}
    </div>
  );
}

function DivCard({ div }) {
  const c = growthColor(div.growthRate);
  return (
    <div style={{ border: '1px solid #E5E7EB', borderLeft: `3px solid ${c}`, borderRadius: 4, padding: '18px 18px 16px', background: '#fff', minHeight: 150 }}>
      <div style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: '-.015em', marginBottom: 12 }}>{div.name}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
        <span style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 28, fontWeight: 800, color: c, letterSpacing: '-.025em', lineHeight: 1 }}>
          {div.growthRate >= 0 ? '+' : ''}{pctStr(div.growthRate)}
        </span>
        <span style={{ fontSize: 10, color: '#6B7280', marginLeft: 4 }}>성장률</span>
      </div>
      <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 10, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11.5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6B7280' }}>최종실적</span><span style={{ fontWeight: 700, color: INK }}>{money(div.sales)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6B7280' }}>기준점</span><span style={{ fontWeight: 600, color: '#6B7280' }}>{money(div.base)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6B7280' }}>성장금액</span><span style={{ fontWeight: 700, color: c }}>{div.growth >= 0 ? '+' : ''}{money(div.growth)}</span></div>
      </div>
    </div>
  );
}
