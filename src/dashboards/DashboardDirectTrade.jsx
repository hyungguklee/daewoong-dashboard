import { useState, useCallback, useMemo, useEffect } from 'react';
import { parseDirectTradeExcelFile } from '../utils/parseDirectTradeExcel';
import { loadDashboard, saveDashboard } from '../utils/firebase';

const GRADE_COLORS = {
  S: { fg: '#059669', bg: '#ECFDF5' },
  A: { fg: '#2563EB', bg: '#EFF6FF' },
  B: { fg: '#F59E0B', bg: '#FEF3C7' },
  C: { fg: '#DC2626', bg: '#FEE2E2' },
};
const GRADES = ['S', 'A', 'B', 'C'];

const TAB_INFO = {
  hospital: {
    label: '병원',
    storageKey: 'direct_trade_hospital',
    title: 'ETC병원 직거래 평가',
    eyebrow: 'DIRECT TRADE EVALUATION · HOSPITAL',
  },
  local: {
    label: '로컬',
    storageKey: 'direct_trade_local',
    title: 'ETC로컬 직거래 평가',
    eyebrow: 'DIRECT TRADE EVALUATION · LOCAL',
  },
};

const pctStr = (v, dec = 1) => v != null && !isNaN(v) ? (v * 100).toFixed(dec) + '%' : '-';
const gradeColor = g => GRADE_COLORS[g] || { fg: '#6B7280', bg: '#F3F4F6' };

// 금액 포맷 (억/백만)
const fmtMoney = v => {
  if (v == null || isNaN(v) || v === 0) return '-';
  const abs = Math.abs(v);
  if (abs >= 1e8) return (v / 1e8).toFixed(1) + '억';
  if (abs >= 1e6) return (v / 1e6).toFixed(1) + '백만';
  return Math.round(v).toLocaleString();
};
const fmtNum = (v, dec = 0) => v == null || isNaN(v) ? '-' : Number(v).toLocaleString(undefined, { maximumFractionDigits: dec });

// ─── 작은 컴포넌트들 ──────────────────────────────────────────────────────────
function GradeBadge({ grade, size = 'md' }) {
  if (!grade) return <span style={{ color: '#9CA3AF' }}>-</span>;
  const c = gradeColor(grade);
  const dim = size === 'lg' ? { width: 50, height: 50, fontSize: 28 }
            : size === 'sm' ? { width: 24, height: 22, fontSize: 12 }
            : { width: 32, height: 28, fontSize: 14 };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      ...dim, borderRadius: 6, fontWeight: 800, color: '#fff', background: c.fg,
    }}>{grade}</span>
  );
}

function KpiCard({ label, children, note, core = false, coreLabel, valueColor }) {
  return (
    <div style={{
      border: '1px solid #E5E7EB', borderRadius: 4, padding: '20px 20px 16px',
      background: core ? 'linear-gradient(135deg, #1A1F2C 0%, #2C3548 100%)' : '#fff',
      color: core ? '#fff' : 'inherit',
      borderColor: core ? '#1A1F2C' : '#E5E7EB',
      position: 'relative', minHeight: 140, display: 'flex', flexDirection: 'column',
    }}>
      {core && coreLabel && (
        <div style={{ position: 'absolute', top: 18, right: 18, fontSize: 9, letterSpacing: '.18em', color: 'rgba(255,255,255,.5)', fontWeight: 700 }}>
          {coreLabel}
        </div>
      )}
      <div style={{ fontSize: 12, color: core ? 'rgba(255,255,255,.6)' : '#6B7280', marginBottom: 12, fontWeight: 500 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10, flex: 1, color: valueColor }}>
        {children}
      </div>
      {note && (
        <div style={{ fontSize: 11, color: core ? 'rgba(255,255,255,.55)' : '#6B7280', paddingTop: 10, borderTop: `1px solid ${core ? 'rgba(255,255,255,.1)' : '#F3F4F6'}` }}>
          {note}
        </div>
      )}
    </div>
  );
}

function BizCard({ div }) {
  const c = gradeColor(div.grade);
  return (
    <div style={{
      border: '1px solid #E5E7EB', borderLeft: `3px solid ${c.fg}`,
      borderRadius: 4, padding: '18px 18px 16px',
      background: '#fff', position: 'relative', minHeight: 180,
    }}>
      <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 700, letterSpacing: '.05em' }}>최종</span>
        <GradeBadge grade={div.grade} size="lg" />
      </div>
      <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 22, fontWeight: 800, letterSpacing: '-.015em', marginBottom: 2, paddingRight: 70 }}>
        {div.division}
      </div>
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 14 }}>
        {div.manager || '-'}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
        <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 30, fontWeight: 800, color: c.fg, letterSpacing: '-.025em', lineHeight: 1 }}>
          {(div.achieveRate * 100).toFixed(1)}
        </span>
        <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 14, fontWeight: 600, color: c.fg }}>%</span>
        <span style={{ fontSize: 10, color: '#6B7280', marginLeft: 4 }}>달성률</span>
      </div>
      <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 10, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6B7280' }}>매출</span>
          <span style={{ fontWeight: 700, color: '#1A1F2C' }}>{fmtMoney(div.salesAmount)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6B7280' }}>기준점</span>
          <span style={{ fontWeight: 600, color: '#6B7280' }}>{fmtMoney(div.baseAmount)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6B7280' }}>가동률</span>
          <span style={{ fontWeight: 700, color: '#1A1F2C' }}>{pctStr(div.activeRate)} <span style={{ fontSize: 10, color: '#9CA3AF' }}>({fmtNum(div.activeCount)}/{fmtNum(div.targetCount)})</span></span>
        </div>
      </div>
    </div>
  );
}

function OfficeRow({ idx, office, onClick }) {
  const c = gradeColor(office.grade);
  return (
    <tr style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }} className="hover:bg-[#F7F7F4]" onClick={() => onClick(office)}>
      <td style={{ padding: '10px 6px', color: '#9CA3AF', fontSize: 10.5, textAlign: 'center' }}>{idx + 1}</td>
      <td style={{ padding: '10px 6px', textAlign: 'center', background: c.bg }}><GradeBadge grade={office.grade} size="sm" /></td>
      <td style={{ padding: '10px 6px', fontSize: 11.5 }}>{office.division}</td>
      <td style={{ padding: '10px 6px', fontSize: 11.5 }}>
        <span style={{ color: '#3D5A8C', fontWeight: 700, borderBottom: '1px dashed #3D5A8C', paddingBottom: 1 }}>{office.office} ›</span>
      </td>
      <td style={{ padding: '10px 6px', fontSize: 11 }}>{office.manager}</td>
      <td style={{ padding: '10px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{fmtMoney(office.baseAmount)}</td>
      <td style={{ padding: '10px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11, fontWeight: 700 }}>{fmtMoney(office.salesAmount)}</td>
      <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 800, color: c.fg, fontSize: 12 }}>{pctStr(office.achieveRate)}</td>
      <td style={{ padding: '10px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{pctStr(office.activeRate)}</td>
      <td style={{ padding: '10px 6px', textAlign: 'center', color: '#9CA3AF', fontSize: 10 }}>{fmtNum(office.activeCount)}/{fmtNum(office.targetCount)}</td>
    </tr>
  );
}

// 사무소 → MR 드릴다운 모달
function MRModal({ office, mrs, onClose }) {
  if (!office) return null;
  const filtered = mrs.filter(m => m.office === office.office && m.division === office.division)
                     .sort((a, b) => {
                       const ga = GRADES.indexOf(a.grade), gb = GRADES.indexOf(b.grade);
                       if (ga !== gb) return ga - gb;
                       return (b.achieveRate || 0) - (a.achieveRate || 0);
                     });
  const c = gradeColor(office.grade);
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content animate-in" style={{ maxWidth: 1100 }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, borderRadius: 6, background: c.fg, color: '#fff' }}>
            {office.grade || '-'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: '.16em', color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
              사무소 → 담당자(MR) 직거래 평가
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 4 }}>{office.office}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>
              {office.division} · 소장 {office.manager || '-'} · MR {filtered.length}명 · 달성률 {pctStr(office.achieveRate)} · 가동률 {pctStr(office.activeRate)}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #E5E7EB', color: '#6B7280', width: 30, height: 30, borderRadius: 6, cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        <div style={{ padding: '16px 22px 20px', overflowY: 'auto', maxHeight: 'calc(88vh - 120px)' }}>
          {/* 사무소 KPI 3개 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
            <div style={{ padding: '10px 14px', background: '#F3F4F6', borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>기준점</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1A1F2C' }}>{fmtMoney(office.baseAmount)}</div>
            </div>
            <div style={{ padding: '10px 14px', background: '#EFF6FF', borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: '#1D4ED8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>매출</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1D4ED8' }}>{fmtMoney(office.salesAmount)}</div>
            </div>
            <div style={{ padding: '10px 14px', background: c.bg, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: c.fg, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>목표 달성률</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: c.fg }}>{pctStr(office.achieveRate)}</div>
            </div>
          </div>

          <div style={{ border: '1px solid #E5E7EB', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 820 }}>
                <thead>
                  <tr>
                    {['#', '최종', '담당자', '사번', '기준점', '매출', '성장금액', '달성률'].map((h, i) => (
                      <th key={i} style={{
                        background: i === 1 ? '#FEF3C7' : '#FAF8F1',
                        padding: '8px 8px', fontSize: i === 1 ? 11 : 10.5,
                        fontWeight: i === 1 ? 800 : 700, color: i === 1 ? '#1A1F2C' : '#6B7280',
                        textAlign: (i === 0 || i === 1) ? 'center' : (i === 2 || i === 3 ? 'left' : 'right'),
                        borderBottom: '1.5px solid #1A1F2C', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, i) => {
                    const mc = gradeColor(m.grade);
                    return (
                      <tr key={i} style={{ borderTop: '1px solid #F3F4F6' }} className="hover:bg-[#FCFAF3]">
                        <td style={{ padding: '8px 8px', textAlign: 'center', color: '#9CA3AF', fontSize: 11 }}>{i + 1}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'center', background: mc.bg }}><GradeBadge grade={m.grade} size="sm" /></td>
                        <td style={{ padding: '8px 8px', fontWeight: 600 }}>{m.name}</td>
                        <td style={{ padding: '8px 8px', color: '#9CA3AF', fontSize: 11 }}>{m.sano}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(m.baseAmount)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmtMoney(m.salesAmount)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: m.growthAmount >= 0 ? '#059669' : '#DC2626' }}>{fmtMoney(m.growthAmount)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 800, color: mc.fg, fontSize: 12 }}>{pctStr(m.achieveRate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#9CA3AF' }}>해당 사무소 MR 데이터 없음</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
export default function DashboardDirectTrade({ isAdmin, period }) {
  const [activeTab, setActiveTab] = useState('hospital');
  const [dataMap, setDataMap] = useState({ hospital: null, local: null });
  const [cloudLoading, setCloudLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [gradeFilter, setGradeFilter] = useState('전체');
  const [selectedOffice, setSelectedOffice] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [h, l] = await Promise.all([
        loadDashboard('direct_trade_hospital'),
        loadDashboard('direct_trade_local'),
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
      const parsed = await parseDirectTradeExcelFile(file);
      if (parsed.type !== activeTab) {
        throw new Error(`현재 ${tab.label} 탭이지만 업로드된 파일은 ${parsed.type === 'hospital' ? '병원' : '로컬'} 양식입니다`);
      }
      parsed.period = period;
      const existing = await loadDashboard(tab.storageKey);
      const merged = existing
        ? {
            ...existing,
            history: { ...(existing.history || {}), [period]: { total: parsed.total, divisions: parsed.divisions, offices: parsed.offices, mrs: parsed.mrs } },
            period, total: parsed.total, divisions: parsed.divisions, offices: parsed.offices, mrs: parsed.mrs, type: parsed.type,
          }
        : { ...parsed, history: { [period]: { total: parsed.total, divisions: parsed.divisions, offices: parsed.offices, mrs: parsed.mrs } } };
      await saveDashboard(tab.storageKey, merged);
      setDataMap(prev => ({ ...prev, [activeTab]: merged }));
    } catch (err) {
      setUploadError('업로드 오류: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, period, tab]);

  const handleDelete = async () => {
    if (!window.confirm(`${tab.label} ${period} 직거래 데이터를 삭제하시겠습니까?`)) return;
    setIsLoading(true);
    try {
      const stored = await loadDashboard(tab.storageKey);
      if (!stored) { setDataMap(prev => ({ ...prev, [activeTab]: null })); return; }
      const updated = { ...stored, history: { ...(stored.history || {}) } };
      delete updated.history[period];
      if (updated.period === period) {
        const rem = Object.keys(updated.history);
        if (rem.length > 0) {
          const prev = rem[rem.length - 1];
          const h = updated.history[prev];
          Object.assign(updated, { period: prev, ...h });
        } else {
          await saveDashboard(tab.storageKey, { period: null, history: {} });
          setDataMap(prev => ({ ...prev, [activeTab]: null })); return;
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

  const displayData = useMemo(() => {
    if (!data) return null;
    if (!period || period === data.period) return data;
    const hist = data.history?.[period];
    return hist ? { ...data, ...hist, period } : null;
  }, [data, period]);

  const { total, divisions = [], offices = [], mrs = [] } = displayData || {};

  // 프로트랙(병원)은 사업부 섹션에서 제외, 사무소 표는 그대로
  const isSpecialDiv = useCallback((name) => {
    if (activeTab === 'hospital') return name === '프로트랙' || name === '병원본부(프로트랙)';
    return false;
  }, [activeTab]);
  const mainDivisions = useMemo(() => divisions.filter(d => !isSpecialDiv(d.division)), [divisions, isSpecialDiv]);

  // 정렬: grade desc → achieveRate desc
  const gradeOrder = g => GRADES.indexOf(g) >= 0 ? GRADES.indexOf(g) : 99;

  const sortedDivisions = useMemo(() => [...mainDivisions].sort((a, b) => {
    const d = gradeOrder(a.grade) - gradeOrder(b.grade);
    if (d !== 0) return d;
    return (b.achieveRate || 0) - (a.achieveRate || 0);
  }), [mainDivisions]);

  const filteredOffices = useMemo(() => {
    const sorted = [...offices].sort((a, b) => {
      const d = gradeOrder(a.grade) - gradeOrder(b.grade);
      if (d !== 0) return d;
      return (b.achieveRate || 0) - (a.achieveRate || 0);
    });
    if (gradeFilter === '전체') return sorted;
    return sorted.filter(o => o.grade === gradeFilter);
  }, [offices, gradeFilter]);

  const gradeCounts = useMemo(() => {
    const c = { 전체: offices.length, S: 0, A: 0, B: 0, C: 0 };
    offices.forEach(o => { if (c[o.grade] != null) c[o.grade]++; });
    return c;
  }, [offices]);
  const sCount = gradeCounts.S;

  const TabButton = ({ id, label }) => (
    <button onClick={() => { setActiveTab(id); setGradeFilter('전체'); }}
      style={{
        padding: '8px 20px', fontSize: 13,
        fontWeight: activeTab === id ? 700 : 500,
        background: activeTab === id ? '#1A1F2C' : 'transparent',
        color: activeTab === id ? '#fff' : '#6B7280',
        border: `1px solid ${activeTab === id ? '#1A1F2C' : '#E5E7EB'}`,
        borderRadius: 6, cursor: 'pointer',
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
              <span className="text-xl">💼</span>
              <div>
                <div className="text-sm font-medium text-[#1A1F2C]">{isLoading?'처리 중...':`${tab.label} 직거래 평가 엑셀 업로드`}</div>
                <div className="text-xs text-[#9CA3AF]">{tab.label} 직거래_X월 마감_홍보.xlsx</div>
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

      <div style={{ background: '#fff', padding: '36px 28px 28px', boxShadow: '0 1px 30px rgba(0,0,0,0.04)', borderRadius: 6 }}>
        {/* 헤더 */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 18, borderBottom: '2px solid #1A1F2C', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '.18em', color: '#6B7280', fontWeight: 600, marginBottom: 8 }}>{tab.eyebrow}</div>
            <h1 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 30, fontWeight: 800, letterSpacing: '-.015em', lineHeight: 1.1 }}>
              {tab.title} <span style={{ fontWeight: 300, color: '#4B5563' }}>리포트</span>
            </h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 24, fontWeight: 700, letterSpacing: '-.01em' }}>{period}</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>달성률 S 100%↑ / A 75%↑ / B 50%↑ / C 50%↓</div>
          </div>
        </header>

        {(!displayData || !offices.length) ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">📭</div>
            <div className="text-base font-bold text-[#4B5563] mb-2">{period} 데이터가 없습니다</div>
            <div className="text-sm text-[#9CA3AF]">{isAdmin ? '위에서 엑셀 파일을 업로드해주세요.' : '관리자에게 문의해주세요.'}</div>
          </div>
        ) : (
          <>
            {/* 섹션 01: 본부 현황 */}
            <section style={{ marginBottom: 36 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, letterSpacing: '.05em' }}>01</span>
                  <h2 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 18, fontWeight: 700 }}>본부 현황</h2>
                </div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>
                  {tab.label} 전사 종합 / {mainDivisions.length}개 사업부 · {offices.length}개 사무소 · MR {mrs.length}명
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <KpiCard label="본부 최종 평가" core coreLabel="CORE KPI" note={`달성률 ${pctStr(total?.achieveRate)} · ${mainDivisions.length}개 사업부 종합`}>
                  <GradeBadge grade={total?.grade} size="lg" />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>등급</span>
                </KpiCard>
                <KpiCard label="3월 마감 매출" note={`기준점 ${fmtMoney(total?.baseAmount)} 대비`}>
                  <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 28, fontWeight: 800, color: '#1A1F2C', letterSpacing: '-.025em', lineHeight: 1 }}>
                    {fmtMoney(total?.salesAmount)}
                  </span>
                </KpiCard>
                <KpiCard label="목표 달성률" note={`성장금액 ${fmtMoney(total?.growthAmount)} / 목표 ${fmtMoney(total?.growthGoal)}`} valueColor={gradeColor(total?.grade).fg}>
                  <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 32, fontWeight: 800, color: gradeColor(total?.grade).fg, letterSpacing: '-.025em', lineHeight: 1 }}>
                    {pctStr(total?.achieveRate)}
                  </span>
                </KpiCard>
                <KpiCard label="가동률 (대상처/주문처)" note={`${fmtNum(total?.activeCount)} / ${fmtNum(total?.targetCount)} 거래처`}>
                  <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 32, fontWeight: 800, color: '#1A1F2C', letterSpacing: '-.025em', lineHeight: 1 }}>
                    {pctStr(total?.activeRate)}
                  </span>
                </KpiCard>
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: '#9CA3AF' }}>
                우수(S) 사무소: <strong style={{ color: '#059669' }}>{sCount}개 / {offices.length} ({((sCount/Math.max(1,offices.length))*100).toFixed(1)}%)</strong>
              </div>
            </section>

            {/* 섹션 02: 사업부 평가 */}
            <section style={{ marginBottom: 36 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, letterSpacing: '.05em' }}>02</span>
                  <h2 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 18, fontWeight: 700 }}>사업부 평가</h2>
                </div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>
                  {mainDivisions.length}개 사업부 · 최종등급 내림차순
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(5, sortedDivisions.length || 1)}, 1fr)`, gap: 12 }}>
                {sortedDivisions.map(d => <BizCard key={d.division} div={d} />)}
              </div>
            </section>

            {/* 섹션 03: 사무소 평가 */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, letterSpacing: '.05em' }}>03</span>
                  <h2 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 18, fontWeight: 700 }}>사무소 평가</h2>
                </div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>
                  {offices.length}개 사무소 · 최종등급 내림차순 · 사무소명 클릭 → MR 상세
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                {['전체', ...GRADES].map(g => {
                  const active = gradeFilter === g;
                  const c = g !== '전체' ? gradeColor(g) : null;
                  return (
                    <button key={g} onClick={() => setGradeFilter(g)}
                      style={{
                        padding: '6px 12px', fontSize: 11.5, fontWeight: 600,
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

              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: 32 }} />     {/* # */}
                    <col style={{ width: 44 }} />     {/* 최종 */}
                    <col style={{ width: 60 }} />     {/* 사업부 */}
                    <col style={{ width: 110 }} />    {/* 사무소 */}
                    <col style={{ width: 70 }} />     {/* 소장 */}
                    <col style={{ width: 85 }} />     {/* 기준점 */}
                    <col style={{ width: 85 }} />     {/* 매출 */}
                    <col style={{ width: 75 }} />     {/* 달성률 */}
                    <col style={{ width: 65 }} />     {/* 가동률 % */}
                    <col style={{ width: 85 }} />     {/* 가동률 카운트 */}
                  </colgroup>
                  <thead>
                    <tr>
                      {['#', '최종', '사업부', '사무소', '소장', '3월 기준점', '3월 매출', '달성률', '가동률', '대상/주문'].map((h, i) => (
                        <th key={i} style={{
                          textAlign: (i === 0 || i === 1) ? 'center' : (i <= 4 ? 'left' : 'right'),
                          padding: '10px 6px', fontWeight: i === 1 ? 800 : 500,
                          color: i === 1 ? '#1A1F2C' : '#6B7280', fontSize: i === 1 ? 11 : 10.5,
                          borderBottom: '1.5px solid #1A1F2C', borderTop: '1px solid #E5E7EB',
                          background: i === 1 ? '#FEF3C7' : '#FAF8F1', whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOffices.map((o, idx) => (
                      <OfficeRow key={o.office + idx} idx={idx} office={o} onClick={setSelectedOffice} />
                    ))}
                  </tbody>
                </table>
                {filteredOffices.length === 0 && (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: '#9CA3AF' }}>조건에 맞는 사무소가 없습니다</div>
                )}
              </div>
            </section>

            <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #E5E7EB', textAlign: 'center', fontSize: 10.5, color: '#9CA3AF' }}>
              ※ 자료 기준일: {period} · 직거래 평가 기준 S 100%↑ / A 75%↑ / B 50%↑ / C 50%↓
            </div>
          </>
        )}
      </div>

      {selectedOffice && (
        <MRModal office={selectedOffice} mrs={mrs} onClose={() => setSelectedOffice(null)} />
      )}
    </div>
  );
}
