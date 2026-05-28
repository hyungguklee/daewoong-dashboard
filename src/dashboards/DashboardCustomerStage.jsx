import { useState, useCallback, useMemo, useEffect } from 'react';
import { parseCustomerStageExcelFile } from '../utils/parseCustomerStageExcel';
import { loadDashboard, saveDashboard } from '../utils/firebase';

// ─── 색상 (HTML과 동일) ───────────────────────────────────────────────────────
const GRADE_COLORS = {
  S: { main: '#1A3A6B', bg: '#DDE5F0' },
  A: { main: '#3D5A8C', bg: '#E0E7F2' },
  B: { main: '#111111', bg: '#E5E5E5' },
  C: { main: '#B83838', bg: '#F5DDDD' },
};
const STAGE_COLORS = ['#E8A87C', '#E5C39A', '#D4D193', '#A0C5A8', '#7AA5BD', '#5D6BAA'];
const STAGE_BG = ['#FCF3ED', '#FBF7F1', '#F9F9F0', '#F2F7F3', '#ECF2F6', '#E8EAF3'];
const GRADES = ['S', 'A', 'B', 'C'];

const TAB_INFO = {
  hospital: {
    label: '병원',
    storageKey: 'customer_stage_hospital',
    title: 'ETC병원 고객단계 평가',
    eyebrow: 'ETC HOSPITAL · CUSTOMER STAGE EVALUATION',
    excludeNote: '프로트랙',
    excludeFn: (name) => name === '프로트랙',
  },
  local: {
    label: '로컬',
    storageKey: 'customer_stage_local',
    title: 'ETC로컬 고객단계 평가',
    eyebrow: 'ETC LOCAL · CUSTOMER STAGE EVALUATION',
    excludeNote: '서울3(MS)',
    excludeFn: (name) => name === '서울3(MS)' || name === 'MS',
  },
};

const fmtNum = v => v == null || isNaN(v) ? '-' : Math.round(v).toLocaleString();
const fmtFloat = (v, d = 2) => v == null || isNaN(v) ? '-' : Number(v).toFixed(d);
const signed = v => v > 0 ? '+' + fmtNum(v) : fmtNum(v);
const gradeColor = g => GRADE_COLORS[g] || { main: '#6B6B6B', bg: '#F3F3F3' };

// ─── 작은 컴포넌트들 ──────────────────────────────────────────────────────────
function GradePill({ grade, size = 'md' }) {
  if (!grade) return <span style={{ color: '#9A9A9A' }}>-</span>;
  const c = gradeColor(grade);
  const dim = size === 'lg' ? { width: 50, height: 50, fontSize: 30 }
            : size === 'sm' ? { width: 28, height: 22, fontSize: 12 }
            : { width: 36, height: 28, fontSize: 14 };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      ...dim, borderRadius: 6, fontWeight: 800, color: '#fff', background: c.main, letterSpacing: '-.02em',
    }}>{grade}</span>
  );
}

function KpiCard({ label, valueColor, feature = false, corner, children, delta }) {
  return (
    <div style={{
      background: feature ? '#111111' : '#FFFFFF',
      color: feature ? '#fff' : 'inherit',
      border: `1px solid ${feature ? '#111111' : '#E6E2D8'}`,
      borderRadius: 6, padding: '18px 18px 16px',
      position: 'relative', overflow: 'hidden', minHeight: 140,
    }}>
      {corner && (
        <div style={{
          position: 'absolute', top: 14, right: 14,
          fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
          color: feature ? 'rgba(255,255,255,.4)' : '#9A9A9A',
        }}>{corner}</div>
      )}
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '.08em',
        textTransform: 'uppercase', marginBottom: 10,
        color: feature ? 'rgba(255,255,255,.65)' : '#6B6B6B',
      }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-.025em', lineHeight: 1, color: feature ? '#fff' : (valueColor || '#111') }}>
        {children}
      </div>
      {delta && (
        <div style={{ marginTop: 8, fontSize: 12, color: feature ? 'rgba(255,255,255,.65)' : '#6B6B6B' }}>
          {delta}
        </div>
      )}
    </div>
  );
}

function DivCard({ div }) {
  const c = gradeColor(div.grade);
  const deltaPer = (div.curPer || 0) - (div.prevPer || 0);
  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #E6E2D8', borderRadius: 6,
      padding: '16px 16px 14px', position: 'relative', minHeight: 180,
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
        borderRadius: '6px 0 0 6px', background: c.main,
      }} />
      <div style={{
        position: 'absolute', top: 12, right: 12, width: 50, height: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 30, fontWeight: 800, borderRadius: 6, color: '#fff',
        letterSpacing: '-.02em', lineHeight: 1, background: c.main,
      }}>{div.grade}</div>

      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 1, letterSpacing: '-.01em', paddingLeft: 6, paddingRight: 60 }}>
        {div.name}
      </div>
      <div style={{ fontSize: 11, color: '#6B6B6B', marginBottom: 14, paddingLeft: 6, paddingRight: 60 }}>
        {div.manager || ''} · T.O {fmtNum(div.to)}명
      </div>

      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.025em', lineHeight: 1, paddingLeft: 6 }}>
        {fmtFloat(div.curPer)}<span style={{ fontSize: 12, fontWeight: 500, color: '#6B6B6B', marginLeft: 2 }}>명/인</span>
      </div>
      <div style={{ fontSize: 11, color: '#6B6B6B', marginTop: 4, paddingLeft: 6 }}>4단계↑ {fmtNum(div.curCount)}명</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, paddingLeft: 6, borderTop: '1px solid #EFECE3', fontSize: 11 }}>
        <span style={{ color: '#6B6B6B' }}>25년 대비 인당</span>
        <span style={{ fontWeight: 600, color: deltaPer >= 0 ? '#1B6B3D' : '#A03333' }}>
          {deltaPer >= 0 ? '+' : ''}{fmtFloat(deltaPer)}명
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingLeft: 6, fontSize: 11 }}>
        <span style={{ color: '#6B6B6B' }}>신규 4단계↑</span>
        <span style={{ fontWeight: 600, color: div.chgCount >= 0 ? '#1B6B3D' : '#A03333' }}>
          {div.chgCount >= 0 ? '+' : ''}{fmtNum(div.chgCount)}명
        </span>
      </div>
    </div>
  );
}

function OfficeRow({ idx, office, onClick }) {
  const c = gradeColor(office.grade);
  const deltaPer = (office.curPer || 0) - (office.prevPer || 0);
  return (
    <tr style={{ borderBottom: '1px solid #EFECE3', cursor: 'pointer' }} className="hover:bg-[#FCFAF3]" onClick={() => onClick(office)}>
      <td style={{ padding: '10px 8px', color: '#9A9A9A', fontSize: 11, textAlign: 'center' }}>{idx + 1}</td>
      <td style={{ padding: '10px 8px', fontSize: 12 }}>{office.division}</td>
      <td style={{ padding: '10px 8px' }}>
        <span style={{ color: '#3D5A8C', fontWeight: 700, borderBottom: '1px dashed #3D5A8C', paddingBottom: 1 }}>{office.office} ›</span>
      </td>
      <td style={{ padding: '10px 8px', color: '#6B6B6B', fontSize: 11 }}>{office.manager}</td>
      <td style={{ padding: '10px 8px', textAlign: 'right' }}>{fmtNum(office.to)}</td>
      <td style={{ padding: '10px 8px', textAlign: 'right' }}>{fmtNum(office.custTotal)}</td>
      <td style={{ padding: '10px 8px', textAlign: 'right', color: '#9A9A9A' }}>{fmtFloat(office.prevPer, 1)}</td>
      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700 }}>{fmtNum(office.curCount)}</td>
      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700 }}>{fmtFloat(office.curPer)}</td>
      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: deltaPer >= 0 ? '#1B6B3D' : '#A03333' }}>
        {deltaPer >= 0 ? '+' : ''}{fmtFloat(deltaPer)}
      </td>
      <td style={{ padding: '10px 8px', textAlign: 'center' }}><GradePill grade={office.grade} size="sm" /></td>
    </tr>
  );
}

// 사무소 → MR 드릴다운 모달
function MRModal({ office, mrs, type, onClose }) {
  if (!office) return null;
  const tab = TAB_INFO[type];
  const filtered = mrs.filter(m => m.office === office.office && m.division === office.division)
                     .sort((a, b) => {
                       const ga = GRADES.indexOf(a.grade), gb = GRADES.indexOf(b.grade);
                       if (ga !== gb) return ga - gb;
                       return (b.curPer || 0) - (a.curPer || 0);
                     });
  const c = gradeColor(office.grade);
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content animate-in" style={{ maxWidth: 1000 }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #E6E2D8', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, borderRadius: 6, background: c.main, color: '#fff' }}>
            {office.grade}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: '.16em', color: '#9A9A9A', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
              사무소 → 담당자(MR) 평가
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 4 }}>{office.office}</div>
            <div style={{ fontSize: 12, color: '#6B6B6B' }}>
              {office.division} · 소장 {office.manager || '-'} · T.O {fmtNum(office.to)}명 · 4단계↑ {fmtNum(office.curCount)}명 · 인당 {fmtFloat(office.curPer)}명
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #E6E2D8', color: '#6B6B6B', width: 30, height: 30, borderRadius: 6, cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        <div style={{ padding: '16px 22px 20px', overflowY: 'auto', maxHeight: 'calc(88vh - 120px)' }}>
          <div style={{ border: '1px solid #E6E2D8', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 760 }}>
                <thead>
                  <tr>
                    {['#', '담당자', '사번', '총 고객', "4↑ ('25.12)", "4↑ ('26.3)", '인당', '변화', '평가'].map((h, i) => (
                      <th key={i} style={{
                        background: '#FCFAF3', padding: '8px 8px', fontSize: 10.5, fontWeight: 700,
                        color: '#6B6B6B', textAlign: i === 0 || i === 8 ? 'center' : (i === 1 || i === 2 ? 'left' : 'right'),
                        borderBottom: '1.5px solid #111', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, i) => {
                    const deltaPer = (m.curPer || 0) - ((m.prevCount && m.custTotal) ? (m.prevCount / Math.max(1, m.custTotal)) : 0);
                    const delta = (m.curCount || 0) - (m.prevCount || 0);
                    return (
                      <tr key={i} style={{ borderTop: '1px solid #EFECE3' }} className="hover:bg-[#FCFAF3]">
                        <td style={{ padding: '8px 8px', textAlign: 'center', color: '#9A9A9A', fontSize: 11 }}>{i + 1}</td>
                        <td style={{ padding: '8px 8px', fontWeight: 600 }}>{m.name}</td>
                        <td style={{ padding: '8px 8px', color: '#9A9A9A', fontSize: 11 }}>{m.sano}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmtNum(m.custTotal)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right', color: '#9A9A9A' }}>{fmtNum(m.prevCount)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700 }}>{fmtNum(m.curCount)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700 }}>{fmtFloat(m.curPer)}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, color: delta >= 0 ? '#1B6B3D' : '#A03333' }}>
                          {delta >= 0 ? '+' : ''}{fmtNum(delta)}
                        </td>
                        <td style={{ padding: '8px 8px', textAlign: 'center' }}><GradePill grade={m.grade} size="sm" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#9A9A9A' }}>해당 사무소 MR 데이터 없음</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
export default function DashboardCustomerStage({ isAdmin, period }) {
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
        loadDashboard('customer_stage_hospital'),
        loadDashboard('customer_stage_local'),
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
      const parsed = await parseCustomerStageExcelFile(file);
      if (parsed.type !== activeTab) {
        throw new Error(`현재 ${tab.label} 탭이지만 업로드된 파일은 ${parsed.type === 'hospital' ? '병원' : '로컬'} 양식입니다`);
      }
      parsed.period = period;
      const existing = await loadDashboard(tab.storageKey);
      const merged = existing
        ? {
            ...existing,
            history: { ...(existing.history || {}), [period]: { total: parsed.total, divisions: parsed.divisions, offices: parsed.offices, mrs: parsed.mrs, stageBreakdown: parsed.stageBreakdown, prevBreakdown: parsed.prevBreakdown } },
            period, total: parsed.total, divisions: parsed.divisions, offices: parsed.offices, mrs: parsed.mrs, stageBreakdown: parsed.stageBreakdown, prevBreakdown: parsed.prevBreakdown, type: parsed.type,
          }
        : { ...parsed, history: { [period]: { total: parsed.total, divisions: parsed.divisions, offices: parsed.offices, mrs: parsed.mrs, stageBreakdown: parsed.stageBreakdown, prevBreakdown: parsed.prevBreakdown } } };
      await saveDashboard(tab.storageKey, merged);
      setDataMap(prev => ({ ...prev, [activeTab]: merged }));
    } catch (err) {
      setUploadError('업로드 오류: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, period, tab]);

  const handleDelete = async () => {
    if (!window.confirm(`${tab.label} ${period} 고객단계 데이터를 삭제하시겠습니까?`)) return;
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

  const { total, divisions = [], offices = [], mrs = [], stageBreakdown = { stage4: 0, stage5: 0, stage6: 0 }, prevBreakdown = { stage4: 0, stage5: 0 } } = displayData || {};

  // 프로트랙(병원) / 서울3(MS)(로컬) 사업부 제외
  const mainDivisions = useMemo(() => divisions.filter(d => !tab.excludeFn(d.name)), [divisions, tab]);

  // 정렬: grade(S>A>B>C) → curPer desc
  const gradeOrder = g => GRADES.indexOf(g) >= 0 ? GRADES.indexOf(g) : 99;

  const filteredOffices = useMemo(() => {
    const sorted = [...offices].sort((a, b) => {
      const d = gradeOrder(a.grade) - gradeOrder(b.grade);
      if (d !== 0) return d;
      return (b.curPer || 0) - (a.curPer || 0);
    });
    if (gradeFilter === '전체') return sorted;
    return sorted.filter(o => o.grade === gradeFilter);
  }, [offices, gradeFilter]);

  const gradeCounts = useMemo(() => {
    const c = { 전체: offices.length, S: 0, A: 0, B: 0, C: 0 };
    offices.forEach(o => { if (c[o.grade] != null) c[o.grade]++; });
    return c;
  }, [offices]);

  // 단계별 분포 (1~6단계)
  const stageDist = useMemo(() => {
    if (!total) return null;
    return {
      1: total.stage1 || 0,
      2: total.stage2 || 0,
      3: total.stage3 || 0,
      4: stageBreakdown.stage4 || 0,
      5: stageBreakdown.stage5 || 0,
      6: stageBreakdown.stage6 || 0,
    };
  }, [total, stageBreakdown]);

  const totalCust = total?.custTotal || 0;

  // 탭 버튼
  const TabButton = ({ id, label }) => (
    <button onClick={() => { setActiveTab(id); setGradeFilter('전체'); }}
      style={{
        padding: '8px 20px', fontSize: 13,
        fontWeight: activeTab === id ? 700 : 500,
        background: activeTab === id ? '#111111' : 'transparent',
        color: activeTab === id ? '#fff' : '#6B6B6B',
        border: `1px solid ${activeTab === id ? '#111111' : '#E6E2D8'}`,
        borderRadius: 6, cursor: 'pointer',
      }}
    >{label}</button>
  );

  return (
    <div style={{ fontFamily: "'Pretendard', 'Pretendard Variable', -apple-system, sans-serif" }}>
      {/* 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <TabButton id="hospital" label="병원" />
        <TabButton id="local" label="로컬" />
      </div>

      {/* Admin 업로드 / 삭제 */}
      {isAdmin && (
        <div className="mb-6">
          <div className="flex gap-2 items-stretch">
            <label className={`flex-1 flex items-center justify-center gap-3 p-5 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isLoading?'opacity-60':'hover:border-[#111111] hover:bg-[#F7F5F0]'} border-[#E6E2D8]`}>
              <span className="text-xl">👥</span>
              <div>
                <div className="text-sm font-medium text-[#111]">{isLoading?'처리 중...':`${tab.label} 고객단계 평가 엑셀 업로드`}</div>
                <div className="text-xs text-[#9A9A9A]">●26.X월 ETC{tab.label} 고객단계 평가_홍보.xlsx</div>
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

      <div style={{ background: '#F7F5F0', padding: '24px 24px 32px', borderRadius: 6 }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #111', paddingBottom: 18, marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '.18em', fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', marginBottom: 6 }}>
              {tab.eyebrow}
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.1 }}>
              {tab.title}<span style={{ color: '#6B6B6B', fontWeight: 500 }}> 리포트</span>
            </h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#111', letterSpacing: '-.015em', lineHeight: 1, marginBottom: 6 }}>{period}</div>
            <div style={{ fontSize: 13, color: '#3A3A3A', fontWeight: 600 }}>vs 25년 기준</div>
          </div>
        </div>

        {(!displayData || !offices.length) ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#9A9A9A' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#3A3A3A', marginBottom: 6 }}>{period} 데이터가 없습니다</div>
            <div style={{ fontSize: 13 }}>{isAdmin ? '위에서 엑셀 파일을 업로드해주세요.' : '관리자에게 문의해주세요.'}</div>
          </div>
        ) : (
          <>
            {/* 섹션 01: 본부 현황 */}
            <section style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14, borderBottom: '1px solid #E6E2D8', paddingBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#9A9A9A', letterSpacing: '.12em' }}>01</span>
                <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.01em' }}>본부 현황</span>
                <span style={{ fontSize: 12, color: '#6B6B6B', marginLeft: 'auto' }}>
                  {tab.label} 전사 종합 / T.O {fmtNum(total?.to)}명 · 총 고객 {fmtNum(totalCust)}명
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <KpiCard feature corner="CORE KPI" label="4단계↑ 인당 고객"
                  delta={<><b style={{ color: '#FFD27D' }}>↑ {((total?.curPer || 0) - (total?.prevPer || 0)).toFixed(2)}명</b> · 25년 인당 {fmtFloat(total?.prevPer)}명 대비</>}>
                  {fmtFloat(total?.curPer)}<span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,.65)', marginLeft: 4 }}>명</span>
                </KpiCard>
                <KpiCard label={`${tab.label} 종합 평가`} valueColor={gradeColor(total?.grade).main}
                  delta={<>1Q 기준<br/>4단계↑ 전체 {fmtNum(total?.curCount)}명<br/>4단계↑ 변화 {fmtNum(total?.chgCount)}명</>}>
                  {total?.grade || '-'}<span style={{ fontSize: 14, fontWeight: 500, color: '#6B6B6B', marginLeft: 4 }}>등급</span>
                </KpiCard>
                <KpiCard label="4단계↑ 고객수"
                  delta={<><b style={{ color: '#1B6B3D' }}>{(total?.curCount - total?.prevCount) >= 0 ? '↑ +' : '↓ '}{fmtNum(total?.curCount - total?.prevCount)}명</b> · 전체 {totalCust ? ((total?.curCount/totalCust)*100).toFixed(1) : '-'}%</>}>
                  {fmtNum(total?.curCount)}<span style={{ fontSize: 14, fontWeight: 500, color: '#6B6B6B', marginLeft: 4 }}>명</span>
                </KpiCard>
                <KpiCard label="고객단계 3단계 이하 → 4단계 이상 변화"
                  delta="25년 대비 단계 상승 고객">
                  {fmtNum(total?.chgCount)}<span style={{ fontSize: 14, fontWeight: 500, color: '#6B6B6B', marginLeft: 4 }}>명</span>
                </KpiCard>
              </div>
            </section>

            {/* 섹션 02: 사업부 평가 */}
            <section style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14, borderBottom: '1px solid #E6E2D8', paddingBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#9A9A9A', letterSpacing: '.12em' }}>02</span>
                <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.01em' }}>사업부 평가</span>
                <span style={{ fontSize: 12, color: '#6B6B6B', marginLeft: 'auto' }}>{mainDivisions.length}개 사업부</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, Math.min(4, mainDivisions.length))}, 1fr)`, gap: 14 }}>
                {mainDivisions.map(d => <DivCard key={d.name} div={d} />)}
              </div>
            </section>

            {/* 섹션 03: 사무소 평가 */}
            <section style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14, borderBottom: '1px solid #E6E2D8', paddingBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#9A9A9A', letterSpacing: '.12em' }}>03</span>
                <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.01em' }}>사무소 평가</span>
                <span style={{ fontSize: 12, color: '#6B6B6B', marginLeft: 'auto' }}>{offices.length}개 사무소 · 사무소명 클릭 → MR 상세</span>
              </div>

              {/* 등급 칩 */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                {['전체', ...GRADES].map(g => {
                  const active = gradeFilter === g;
                  const c = g !== '전체' ? gradeColor(g) : null;
                  return (
                    <button key={g} onClick={() => setGradeFilter(g)}
                      style={{
                        padding: '6px 14px', fontSize: 12, fontWeight: 600,
                        background: active ? '#111' : '#fff',
                        color: active ? '#fff' : '#3A3A3A',
                        border: `1px solid ${active ? '#111' : '#E6E2D8'}`,
                        borderRadius: 16, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}>
                      {c && <span style={{ width: 8, height: 8, borderRadius: 4, background: c.main }} />}
                      {g === '전체' ? '전체' : `${g}등급`}
                      <span style={{ fontSize: 10, opacity: .7, marginLeft: 2 }}>{gradeCounts[g] ?? 0}</span>
                    </button>
                  );
                })}
              </div>

              {/* 테이블 */}
              <div style={{ background: '#fff', border: '1px solid #E6E2D8', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
                    <thead>
                      <tr>
                        {['#', '사업부', '사무소', '소장', 'T.O', '총고객', "4↑ (25')", "4↑ (26'3)", '인당', '변화', '평가'].map((h, i) => (
                          <th key={i} style={{
                            background: '#FCFAF3', padding: '10px 8px', fontSize: 10.5, fontWeight: 700,
                            color: '#6B6B6B', textAlign: i === 0 || i === 10 ? 'center' : (i === 1 || i === 2 || i === 3 ? 'left' : 'right'),
                            borderBottom: '1.5px solid #111', whiteSpace: 'nowrap',
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
                    <div style={{ padding: 40, textAlign: 'center', color: '#9A9A9A' }}>조건에 맞는 사무소가 없습니다</div>
                  )}
                </div>
              </div>
            </section>

            {/* 섹션 04: 고객단계 분포 */}
            <section style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14, borderBottom: '1px solid #E6E2D8', paddingBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#9A9A9A', letterSpacing: '.12em' }}>04</span>
                <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.01em' }}>고객단계 분포</span>
                <span style={{ fontSize: 12, color: '#6B6B6B', marginLeft: 'auto' }}>전체 고객 1~6단계 분포 (25년 대비 변화 포함)</span>
              </div>

              <div style={{ background: '#fff', border: '1px solid #E6E2D8', borderRadius: 6, padding: '22px 24px' }}>
                {/* Stacked bar */}
                <div style={{ display: 'flex', height: 54, borderRadius: 4, overflow: 'hidden', margin: '14px 0 18px', gap: 1 }}>
                  {[1, 2, 3, 4, 5, 6].map(n => {
                    const v = stageDist?.[n] || 0;
                    const ratio = totalCust > 0 ? v / totalCust : 0;
                    if (ratio === 0) return null;
                    return (
                      <div key={n} style={{
                        flex: ratio,
                        background: STAGE_COLORS[n - 1],
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        color: n <= 3 ? '#5a4a2a' : '#fff', fontWeight: 700, minWidth: 32,
                      }}>
                        <span style={{ fontSize: 11, opacity: .9, fontWeight: 600 }}>{n}단계</span>
                        <span style={{ fontSize: 13, fontWeight: 800 }}>{(ratio * 100).toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>

                {/* 6 cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
                  {[1, 2, 3, 4, 5, 6].map(n => {
                    const v = stageDist?.[n] || 0;
                    const ratio = totalCust > 0 ? (v / totalCust) * 100 : 0;
                    return (
                      <div key={n} style={{
                        padding: '10px 12px', borderRadius: 4, border: '1px solid transparent',
                        background: STAGE_BG[n - 1],
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#3A3A3A', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 2, background: STAGE_COLORS[n - 1] }} />
                          {n}단계
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1 }}>
                          {fmtNum(v)}<span style={{ fontSize: 11, fontWeight: 500, color: '#6B6B6B', marginLeft: 2 }}>명</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#6B6B6B', marginTop: 2 }}>{ratio.toFixed(1)}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <div style={{ marginTop: 24, fontSize: 10.5, color: '#9A9A9A', textAlign: 'center', letterSpacing: '.04em' }}>
              ※ {tab.excludeNote} 제외 · 자료 기준일 {period}
            </div>
          </>
        )}
      </div>

      {selectedOffice && (
        <MRModal office={selectedOffice} mrs={mrs} type={activeTab} onClose={() => setSelectedOffice(null)} />
      )}
    </div>
  );
}
