import { useState, useCallback, useMemo, useEffect } from 'react';
import { parseShinjepumExcelFile } from '../utils/parseShinjepumExcel';
import { loadDashboard, saveDashboard } from '../utils/firebase';

// ─── 상수 ─────────────────────────────────────────────────────────────────────
const GRADE_COLORS = {
  S: { fg: '#059669', bg: '#ECFDF5', bar: '#10B981' },
  A: { fg: '#2563EB', bg: '#EFF6FF', bar: '#3B82F6' },
  B: { fg: '#F59E0B', bg: '#FEF3C7', bar: '#F59E0B' },
  C: { fg: '#DC2626', bg: '#FEE2E2', bar: '#EF4444' },
};
const GRADES = ['S', 'A', 'B', 'C'];

const TAB_INFO = {
  hospital: {
    label: '병원',
    storageKey: 'shinjepum_hospital',
    title: 'ETC병원 신제품 평가',
    eyebrow: 'NEW PRODUCT EVALUATION · HOSPITAL SALES',
  },
  local: {
    label: '로컬',
    storageKey: 'shinjepum_local',
    title: 'ETC로컬 신제품 평가',
    eyebrow: 'NEW PRODUCT EVALUATION · LOCAL SALES',
  },
};

const pctStr = (v, dec = 1) => v != null && !isNaN(v) ? (v * 100).toFixed(dec) + '%' : '-';
const gradeColor = (g) => GRADE_COLORS[g] || { fg: '#6B7280', bg: '#F3F4F6', bar: '#9CA3AF' };

// ─── 작은 컴포넌트들 ──────────────────────────────────────────────────────────
function GradeBadge({ grade, size = 'md' }) {
  if (!grade) return <span className="text-[var(--ink-4)]">-</span>;
  const c = gradeColor(grade);
  const dim = size === 'lg' ? { width: 38, height: 38, fontSize: 18 }
            : size === 'sm' ? { width: 22, height: 22, fontSize: 11 }
            : { width: 28, height: 28, fontSize: 13 };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      ...dim, borderRadius: 6, fontWeight: 800, color: '#fff', background: c.fg, letterSpacing: '.02em',
    }}>{grade}</span>
  );
}

function KpiCard({ label, children, note, core = false, coreLabel }) {
  return (
    <div style={{
      border: '1px solid #E5E7EB', borderRadius: 4, padding: '22px 22px 20px',
      background: core ? 'linear-gradient(135deg, #1A1F2C 0%, #2C3548 100%)' : '#fff',
      color: core ? '#fff' : 'inherit',
      borderColor: core ? '#1A1F2C' : '#E5E7EB',
      position: 'relative', minHeight: 144, display: 'flex', flexDirection: 'column',
    }}>
      {core && coreLabel && (
        <div style={{
          position: 'absolute', top: 18, right: 18,
          fontSize: 9, letterSpacing: '.18em', color: 'rgba(255,255,255,.5)', fontWeight: 700,
        }}>{coreLabel}</div>
      )}
      <div style={{
        fontSize: 12, color: core ? 'rgba(255,255,255,.6)' : '#6B7280',
        marginBottom: 14, fontWeight: 500,
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10, flex: 1 }}>
        {children}
      </div>
      {note && (
        <div style={{
          fontSize: 11, color: core ? 'rgba(255,255,255,.55)' : '#6B7280',
          paddingTop: 10, borderTop: `1px solid ${core ? 'rgba(255,255,255,.1)' : '#F3F4F6'}`,
        }}>{note}</div>
      )}
    </div>
  );
}

function BizCard({ div, productNames }) {
  const c = gradeColor(div.grade);
  return (
    <div style={{
      border: `1px solid ${c.bg === '#F3F4F6' ? '#E5E7EB' : c.fg}33`,
      borderRadius: 4, padding: '18px 18px 16px',
      background: '#fff', position: 'relative',
      borderLeft: `3px solid ${c.fg}`,
    }}>
      <div style={{ position: 'absolute', top: 14, right: 14 }}>
        <GradeBadge grade={div.grade} />
      </div>
      <div style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: '-.015em', marginBottom: 2 }}>
        {div.name}
      </div>
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 14 }}>
        {div.manager || '-'} · 저변 {div.target}개
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
        <span style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 32, fontWeight: 800, color: c.fg, letterSpacing: '-.025em', lineHeight: 1 }}>
          {(div.rate * 100).toFixed(1)}
        </span>
        <span style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 16, fontWeight: 600, color: c.fg }}>%</span>
      </div>
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 12 }}>
        달성 {div.achieved}개 / 목표 {div.target}개
      </div>
      <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {productNames.map((pn, i) => {
          const p = div.products?.[i];
          if (!p || !pn) return null;
          return (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: '#6B7280' }}>{pn}</span>
              <span style={{ color: '#1A1F2C', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{pctStr(p.rate)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OfficeRow({ idx, office }) {
  const c = gradeColor(office.grade);
  const ratePct = (office.rate * 100).toFixed(1);
  return (
    <tr style={{ borderBottom: '1px solid #F3F4F6' }} className="hover:bg-[#F7F7F4]">
      <td style={{ padding: '12px 10px', color: '#9CA3AF', fontSize: 10.5, width: 32, textAlign: 'center' }}>{idx + 1}</td>
      <td style={{ padding: '12px 10px' }}>{office.division}</td>
      <td style={{ padding: '12px 10px', fontWeight: 600 }}>{office.office}</td>
      <td style={{ padding: '12px 10px' }}>{office.manager}</td>
      <td style={{ padding: '12px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{office.target}</td>
      <td style={{ padding: '12px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{office.achieved}</td>
      <td style={{ padding: '12px 10px', textAlign: 'right' }}>
        <strong style={{ color: c.fg }}>{ratePct}%</strong>
      </td>
      <td style={{ padding: '16px 10px', width: 140 }}>
        <div style={{ height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, office.rate * 100)}%`, height: '100%', background: c.bar, borderRadius: 3 }} />
        </div>
      </td>
      <td style={{ padding: '12px 10px', textAlign: 'center' }}>
        <GradeBadge grade={office.grade} size="sm" />
      </td>
    </tr>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
export default function DashboardShinjepum({ isAdmin, period }) {
  const [activeTab, setActiveTab] = useState('hospital');
  const [dataMap, setDataMap] = useState({ hospital: null, local: null });
  const [cloudLoading, setCloudLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [gradeFilter, setGradeFilter] = useState('전체');

  // 초기 로딩
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [h, l] = await Promise.all([
        loadDashboard('shinjepum_hospital'),
        loadDashboard('shinjepum_local'),
      ]);
      if (!cancelled) {
        setDataMap({ hospital: h, local: l });
        setCloudLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const tab = TAB_INFO[activeTab];
  const data = dataMap[activeTab];

  const handleFile = useCallback(async (file) => {
    setIsLoading(true);
    setUploadError(null);
    try {
      const parsed = await parseShinjepumExcelFile(file);
      parsed.period = period;
      const existing = await loadDashboard(tab.storageKey);
      const merged = existing
        ? {
            ...existing,
            history: {
              ...(existing.history || {}),
              [period]: {
                total: parsed.total, divisions: parsed.divisions,
                offices: parsed.offices, productNames: parsed.productNames,
              },
            },
            period, total: parsed.total, divisions: parsed.divisions,
            offices: parsed.offices, productNames: parsed.productNames,
          }
        : {
            ...parsed,
            history: {
              [period]: {
                total: parsed.total, divisions: parsed.divisions,
                offices: parsed.offices, productNames: parsed.productNames,
              },
            },
          };
      await saveDashboard(tab.storageKey, merged);
      setDataMap(prev => ({ ...prev, [activeTab]: merged }));
    } catch (err) {
      setUploadError('업로드 오류: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, period, tab.storageKey]);

  const handleDelete = async () => {
    if (!window.confirm(`${tab.label} ${period} 데이터를 삭제하시겠습니까?`)) return;
    setIsLoading(true);
    try {
      const stored = await loadDashboard(tab.storageKey);
      if (!stored) { setDataMap(prev => ({ ...prev, [activeTab]: null })); return; }
      const updated = { ...stored, history: { ...(stored.history || {}) } };
      delete updated.history[period];
      if (updated.period === period) {
        const remaining = Object.keys(updated.history);
        if (remaining.length > 0) {
          const prev = remaining[remaining.length - 1];
          const h = updated.history[prev];
          Object.assign(updated, { period: prev, ...h });
        } else {
          await saveDashboard(tab.storageKey, { period: null, history: {} });
          setDataMap(prev => ({ ...prev, [activeTab]: null }));
          return;
        }
      }
      await saveDashboard(tab.storageKey, updated);
      setDataMap(prev => ({ ...prev, [activeTab]: updated }));
    } catch (err) {
      setUploadError('삭제 오류: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 선택 기간 데이터
  const displayData = useMemo(() => {
    if (!data) return null;
    if (!period || period === data.period) return data;
    const hist = data.history?.[period];
    return hist ? { ...data, ...hist, period } : null;
  }, [data, period]);

  const { total, divisions = [], offices = [], productNames = [] } = displayData || {};

  // 사업부 정렬 (달성율 내림차순)
  const sortedDivisions = useMemo(() => {
    return [...divisions].sort((a, b) => (b.rate || 0) - (a.rate || 0));
  }, [divisions]);

  // 사무소 정렬 + 등급 필터
  const filteredOffices = useMemo(() => {
    const sorted = [...offices].sort((a, b) => (b.rate || 0) - (a.rate || 0));
    if (gradeFilter === '전체') return sorted;
    return sorted.filter(o => o.grade === gradeFilter);
  }, [offices, gradeFilter]);

  // 등급별 카운트
  const gradeCounts = useMemo(() => {
    const counts = { 전체: offices.length, S: 0, A: 0, B: 0, C: 0 };
    offices.forEach(o => { if (counts[o.grade] != null) counts[o.grade]++; });
    return counts;
  }, [offices]);

  const sCount = gradeCounts.S;

  // 탭 버튼
  const TabButton = ({ id, label }) => (
    <button
      onClick={() => { setActiveTab(id); setGradeFilter('전체'); }}
      style={{
        padding: '8px 20px',
        fontSize: 13,
        fontWeight: activeTab === id ? 700 : 500,
        background: activeTab === id ? '#1A1F2C' : 'transparent',
        color: activeTab === id ? '#fff' : '#6B7280',
        border: `1px solid ${activeTab === id ? '#1A1F2C' : '#E5E7EB'}`,
        borderRadius: 6,
        cursor: 'pointer',
        transition: 'all .15s',
      }}
    >{label}</button>
  );

  return (
    <div style={{ fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif" }}>
      {/* 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <TabButton id="hospital" label="병원" />
        <TabButton id="local" label="로컬" />
      </div>

      {/* 업로드 / 삭제 */}
      {isAdmin && (
        <div className="mb-6">
          <div className="flex gap-2 items-stretch">
            <label className={`flex-1 flex items-center justify-center gap-3 p-5 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isLoading?'opacity-60':'hover:border-[#1A1F2C] hover:bg-[#F7F7F4]'} border-[#E5E7EB]`}>
              <span className="text-xl">📊</span>
              <div>
                <div className="text-sm font-medium text-[#1A1F2C]">
                  {isLoading?'처리 중...':`${tab.label} 신제품 평가 엑셀 업로드`}
                </div>
                <div className="text-xs text-[#9CA3AF]">○{tab.label} 신제품 평가 현황(수식)_26.X월.xlsx</div>
              </div>
              <input type="file" accept=".xlsx,.xls" className="hidden"
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

      {/* 컨테이너 */}
      <div style={{
        background: '#fff',
        padding: '40px 48px 32px',
        boxShadow: '0 1px 30px rgba(0,0,0,0.04)',
        borderRadius: 6,
      }}>
        {/* 헤더 */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 18, borderBottom: '2px solid #1A1F2C', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '.18em', color: '#6B7280', fontWeight: 600, marginBottom: 8 }}>
              {tab.eyebrow}
            </div>
            <h1 style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 30, fontWeight: 800, letterSpacing: '-.015em', lineHeight: 1.1 }}>
              {tab.title} <span style={{ fontWeight: 300, color: '#4B5563' }}>리포트</span>
            </h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 24, fontWeight: 700, letterSpacing: '-.01em' }}>
              {period}
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>1Q 75% 진행 시점</div>
          </div>
        </header>

        {/* 데이터 없을 때 */}
        {(!displayData || !offices.length) ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">📭</div>
            <div className="text-base font-bold text-[#4B5563] mb-2">{period} 데이터가 없습니다</div>
            <div className="text-sm text-[#9CA3AF]">
              {isAdmin ? '위에서 엑셀 파일을 업로드해주세요.' : '관리자에게 문의해주세요.'}
            </div>
          </div>
        ) : (
          <>
            {/* 섹션 01: 본부 현황 */}
            <section style={{ marginBottom: 40 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, letterSpacing: '.05em' }}>01</span>
                  <h2 style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 18, fontWeight: 700 }}>본부 현황</h2>
                </div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>
                  {tab.label} 전사 종합 / {divisions.length}개 사업부 · {offices.length}개 사무소
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <KpiCard label="전체 저변 달성율" core coreLabel="CORE KPI" note="1Q 75% 시점 · 평가 기준 S 37.5%↑">
                  <span style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 32, fontWeight: 800, color: '#34D399', letterSpacing: '-.025em', lineHeight: 1 }}>
                    {pctStr(total?.rate)}
                  </span>
                </KpiCard>
                <KpiCard label="본부 종합 평가" note={`${divisions.length}개 사업부 평균 달성율 ${pctStr(total?.rate)}`}>
                  <GradeBadge grade={total?.grade} size="lg" />
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>등급</span>
                </KpiCard>
                <KpiCard label="달성 거래처 수" note={`전체 평가 ${total?.target}개 중 ${pctStr(total?.rate)}`}>
                  <span style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 32, fontWeight: 800, color: '#1A1F2C', letterSpacing: '-.025em', lineHeight: 1 }}>
                    {(total?.achieved ?? 0).toLocaleString()}
                  </span>
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>개</span>
                </KpiCard>
                <KpiCard label="우수(S) 사무소" note={`전체 사무소 중 ${offices.length ? ((sCount/offices.length)*100).toFixed(1) : 0}%`}>
                  <span style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 32, fontWeight: 800, color: '#059669', letterSpacing: '-.025em', lineHeight: 1 }}>
                    {sCount}
                  </span>
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>개 / {offices.length}</span>
                </KpiCard>
              </div>
            </section>

            {/* 섹션 02: 사업부 평가 */}
            <section style={{ marginBottom: 40 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, letterSpacing: '.05em' }}>02</span>
                  <h2 style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 18, fontWeight: 700 }}>사업부 평가</h2>
                </div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>
                  {divisions.length}개 사업부 · 달성율 내림차순
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(5, sortedDivisions.length || 1)}, 1fr)`, gap: 12 }}>
                {sortedDivisions.map(d => (
                  <BizCard key={d.name} div={d} productNames={productNames} />
                ))}
              </div>
            </section>

            {/* 섹션 03: 사무소 평가 */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, letterSpacing: '.05em' }}>03</span>
                  <h2 style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif", fontSize: 18, fontWeight: 700 }}>사무소 평가</h2>
                </div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>
                  {offices.length}개 사무소 · 저변 달성율 내림차순
                </div>
              </div>

              {/* 등급 chips */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                {['전체', ...GRADES].map(g => {
                  const active = gradeFilter === g;
                  const c = g !== '전체' ? gradeColor(g) : null;
                  return (
                    <button key={g} onClick={() => setGradeFilter(g)}
                      style={{
                        padding: '6px 12px',
                        fontSize: 11.5, fontWeight: 600,
                        background: active ? '#1A1F2C' : '#fff',
                        color: active ? '#fff' : '#4B5563',
                        border: `1px solid ${active ? '#1A1F2C' : '#E5E7EB'}`,
                        borderRadius: 16, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}>
                      {c && <span style={{ width: 6, height: 6, borderRadius: 3, background: c.fg }} />}
                      {g === '전체' ? '전체' : `${g}등급`}
                      <span style={{ fontSize: 10, opacity: .6 }}>{gradeCounts[g] ?? 0}</span>
                    </button>
                  );
                })}
              </div>

              {/* 테이블 */}
              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 880 }}>
                  <thead>
                    <tr>
                      {['#', '사업부', '사무소', '담당자', '저변 목표', '달성', '달성율', '진척도', '평가'].map((h, i) => (
                        <th key={i} style={{
                          textAlign: [4,5,6,7].includes(i) ? 'right' : (i === 0 || i === 8 ? 'center' : 'left'),
                          padding: '11px 10px', fontWeight: 500, color: '#6B7280', fontSize: 10.5,
                          letterSpacing: '.02em', borderBottom: '1.5px solid #1A1F2C', borderTop: '1px solid #E5E7EB',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOffices.map((o, idx) => (
                      <OfficeRow key={o.office + idx} idx={idx} office={o} />
                    ))}
                  </tbody>
                </table>
                {filteredOffices.length === 0 && (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: '#9CA3AF' }}>조건에 맞는 사무소가 없습니다</div>
                )}
              </div>
            </section>

            {/* 푸터 */}
            <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #E5E7EB', textAlign: 'center', fontSize: 10.5, color: '#9CA3AF' }}>
              ※ 자료 기준일: {period} · 1Q 75% 진행 시점 · 평가 기준 S 37.5%↑ / A 28.1%↑ / B 18.7%↑ / C 18.7%↓
            </div>
          </>
        )}
      </div>
    </div>
  );
}
