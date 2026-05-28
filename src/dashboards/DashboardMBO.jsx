import { useState, useCallback, useMemo, useEffect } from 'react';
import { parseMBOExcelFile } from '../utils/parseMBOExcel';
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
    storageKey: 'mbo_hospital',
    title: 'ETC병원 MBO시스템 평가',
    eyebrow: 'MBO SYSTEM EVALUATION · HOSPITAL',
    mainLabel: 'MBO수립율',
    mainShort: 'MBO',
  },
  local: {
    label: '로컬',
    storageKey: 'mbo_local',
    title: 'ETC로컬 MBO시스템 평가',
    eyebrow: 'MBO SYSTEM EVALUATION · LOCAL',
    mainLabel: '약속율',
    mainShort: '약속',
  },
};

const pctStr = (v, dec = 1) => v != null && !isNaN(v) ? (v * 100).toFixed(dec) + '%' : '-';
const gradeColor = (g) => GRADE_COLORS[g] || { fg: '#6B7280', bg: '#F3F4F6', bar: '#9CA3AF' };
const fmtNum = (v, dec = 1) => v == null || v === 0 ? '-' : Number(v).toFixed(dec);

// ─── 작은 컴포넌트 ────────────────────────────────────────────────────────────
function GradeBadge({ grade, size = 'md' }) {
  if (!grade) return <span style={{ color: '#9CA3AF' }}>-</span>;
  const c = gradeColor(grade);
  const dim = size === 'lg' ? { width: 38, height: 38, fontSize: 18 }
            : size === 'sm' ? { width: 22, height: 22, fontSize: 11 }
            : { width: 28, height: 28, fontSize: 13 };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      ...dim, borderRadius: 6, fontWeight: 800, color: '#fff', background: c.fg,
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
        <div style={{ position: 'absolute', top: 18, right: 18, fontSize: 9, letterSpacing: '.18em', color: 'rgba(255,255,255,.5)', fontWeight: 700 }}>
          {coreLabel}
        </div>
      )}
      <div style={{ fontSize: 12, color: core ? 'rgba(255,255,255,.6)' : '#6B7280', marginBottom: 14, fontWeight: 500 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10, flex: 1 }}>
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

function BizCard({ div, mainLabel }) {
  const c = gradeColor(div.finalGrade);
  return (
    <div style={{
      border: '1px solid #E5E7EB', borderLeft: `3px solid ${c.fg}`,
      borderRadius: 4, padding: '18px 18px 16px',
      background: '#fff', position: 'relative',
    }}>
      <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 700, letterSpacing: '.05em' }}>최종</span>
        <GradeBadge grade={div.finalGrade} size="lg" />
      </div>
      <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 22, fontWeight: 800, letterSpacing: '-.015em', marginBottom: 2 }}>
        {div.name}
      </div>
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 14 }}>
        {div.manager || '-'} · MBO {fmtNum(div.mbo)}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
        <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 28, fontWeight: 800, color: gradeColor(div.mainGrade).fg, letterSpacing: '-.025em', lineHeight: 1 }}>
          {(div.mainRate * 100).toFixed(1)}
        </span>
        <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 14, fontWeight: 600, color: gradeColor(div.mainGrade).fg }}>%</span>
        <span style={{ fontSize: 10, color: '#6B7280', marginLeft: 4 }}>{mainLabel}</span>
        <GradeBadge grade={div.mainGrade} size="sm" />
      </div>
      <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 10, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: '#6B7280' }}>확인율</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 700, color: gradeColor(div.confirmGrade).fg }}>{pctStr(div.confirmRate)}</span>
            <GradeBadge grade={div.confirmGrade} size="sm" />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: '#6B7280' }}>일치율</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 700, color: gradeColor(div.matchGrade).fg }}>{pctStr(div.matchRate)}</span>
            <GradeBadge grade={div.matchGrade} size="sm" />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: '#6B7280' }}>오차율</span>
          <span style={{ fontWeight: 700, color: '#6B7280' }}>{pctStr(div.errorRate)}</span>
        </div>
      </div>
    </div>
  );
}

function OfficeRow({ idx, office, mainLabel, onClick }) {
  const fc = gradeColor(office.finalGrade);
  return (
    <tr style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}
        className="hover:bg-[#F7F7F4]" onClick={() => onClick(office)}>
      <td style={{ padding: '12px 10px', color: '#9CA3AF', fontSize: 10.5, width: 32, textAlign: 'center' }}>{idx + 1}</td>
      <td style={{ padding: '12px 10px', textAlign: 'center', background: fc.bg }}><GradeBadge grade={office.finalGrade} /></td>
      <td style={{ padding: '12px 10px' }}>{office.division}</td>
      <td style={{ padding: '12px 10px' }}>
        <span style={{ color: '#3D5A8C', fontWeight: 700, borderBottom: '1px dashed #3D5A8C', paddingBottom: 1 }}>{office.office}</span>
      </td>
      <td style={{ padding: '12px 10px' }}>{office.manager}</td>
      <td style={{ padding: '12px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(office.mbo)}</td>
      <td style={{ padding: '12px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: gradeColor(office.mainGrade).fg }}>
        {(office.mainRate * 100).toFixed(1)}%
      </td>
      <td style={{ padding: '12px 10px', textAlign: 'center' }}><GradeBadge grade={office.mainGrade} size="sm" /></td>
      <td style={{ padding: '12px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: gradeColor(office.confirmGrade).fg, fontWeight: 600 }}>{pctStr(office.confirmRate)}</td>
      <td style={{ padding: '12px 10px', textAlign: 'center' }}><GradeBadge grade={office.confirmGrade} size="sm" /></td>
      <td style={{ padding: '12px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: gradeColor(office.matchGrade).fg, fontWeight: 600 }}>{pctStr(office.matchRate)}</td>
      <td style={{ padding: '12px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#6B7280' }}>{pctStr(office.errorRate)}</td>
      <td style={{ padding: '12px 10px', textAlign: 'center' }}><GradeBadge grade={office.matchGrade} size="sm" /></td>
    </tr>
  );
}

// ── 사무소 클릭 모달: 소속 MR 표 ────────────────────────────────────────────
function MRModal({ office, mrs, type, onClose }) {
  if (!office) return null;
  const tab = TAB_INFO[type];
  const gradeOrd = (g) => ['S','A','B','C'].indexOf(g) >= 0 ? ['S','A','B','C'].indexOf(g) : 99;
  const filtered = mrs.filter(m => m.office === office.office && m.division === office.division)
                      .sort((a, b) => {
                        const d = gradeOrd(a.finalGrade) - gradeOrd(b.finalGrade);
                        if (d !== 0) return d;
                        return (b.mainRate || 0) - (a.mainRate || 0);
                      });

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content animate-in" style={{ maxWidth: 1100 }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: '.16em', color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
              {office.division} 사업부 · MR 상세
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.02em' }}>{office.office}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700 }}>최종</span>
                <GradeBadge grade={office.finalGrade} size="lg" />
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>
              소장 {office.manager} · {filtered.length}명 MR · MBO {fmtNum(office.mbo)}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #E5E7EB', color: '#6B7280', width: 30, height: 30, borderRadius: 6, cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        <div style={{ padding: '16px 22px 20px', overflowY: 'auto', maxHeight: 'calc(88vh - 120px)' }}>
          {/* 사무소 KPI 3개 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
            <div style={{ padding: '10px 14px', background: gradeColor(office.mainGrade).bg, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: gradeColor(office.mainGrade).fg, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{tab.mainLabel}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: gradeColor(office.mainGrade).fg }}>{pctStr(office.mainRate)}</div>
            </div>
            <div style={{ padding: '10px 14px', background: gradeColor(office.confirmGrade).bg, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: gradeColor(office.confirmGrade).fg, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>확인율</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: gradeColor(office.confirmGrade).fg }}>{pctStr(office.confirmRate)}</div>
            </div>
            <div style={{ padding: '10px 14px', background: gradeColor(office.matchGrade).bg, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: gradeColor(office.matchGrade).fg, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>일치율 / 오차율</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: gradeColor(office.matchGrade).fg }}>{pctStr(office.matchRate)} / {pctStr(office.errorRate)}</div>
            </div>
          </div>

          <div style={{ border: '1px solid #E5E7EB', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 950 }}>
                <thead>
                  <tr>
                    {['#', '최종', '담당자', '사번', `${tab.mainShort} 금액`, `${tab.mainLabel}`, '평가', '확인율', '평가', '일치율', '오차율', '평가'].map((h, i) => (
                      <th key={i} style={{
                        background: i === 1 ? '#FEF3C7' : '#FAF8F1',
                        padding: '7px 10px', fontSize: i === 1 ? 11 : 10,
                        fontWeight: i === 1 ? 800 : 700,
                        color: i === 1 ? '#1A1F2C' : '#6B7280',
                        textAlign: (i === 0 || i === 1) ? 'center' : (i === 2 || i === 3 ? 'left' : 'right'),
                        borderBottom: '1.5px solid #1A1F2C', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, i) => {
                    const fc = gradeColor(m.finalGrade);
                    return (
                      <tr key={i} style={{ borderTop: '1px solid #F3F4F6' }} className="hover:bg-[#FCFAF3]">
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#9CA3AF', fontSize: 11 }}>{i + 1}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', background: fc.bg }}><GradeBadge grade={m.finalGrade} /></td>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{m.manager}</td>
                        <td style={{ padding: '8px 10px', color: '#9CA3AF', fontSize: 11 }}>{m.sano}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(m.mbo, 0)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: gradeColor(m.mainGrade).fg, fontVariantNumeric: 'tabular-nums' }}>{pctStr(m.mainRate)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}><GradeBadge grade={m.mainGrade} size="sm" /></td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: gradeColor(m.confirmGrade).fg, fontWeight: 600 }}>{pctStr(m.confirmRate)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}><GradeBadge grade={m.confirmGrade} size="sm" /></td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: gradeColor(m.matchGrade).fg, fontWeight: 600 }}>{pctStr(m.matchRate)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#6B7280' }}>{pctStr(m.errorRate)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}><GradeBadge grade={m.matchGrade} size="sm" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && <div style={{ padding: '40px 0', textAlign: 'center', color: '#9CA3AF' }}>해당 사무소 MR 데이터 없음</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
export default function DashboardMBO({ isAdmin, period }) {
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
        loadDashboard('mbo_hospital'),
        loadDashboard('mbo_local'),
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
      const parsed = await parseMBOExcelFile(file);
      // 업로드 시 탭과 파일 타입 일치 확인
      if (parsed.type !== activeTab) {
        throw new Error(`현재 ${tab.label} 탭이지만 업로드된 파일은 ${parsed.type === 'hospital' ? '병원' : '로컬'} 양식입니다`);
      }
      parsed.period = period;
      const existing = await loadDashboard(tab.storageKey);
      const merged = existing
        ? {
            ...existing,
            history: {
              ...(existing.history || {}),
              [period]: { total: parsed.total, divisions: parsed.divisions, offices: parsed.offices, mrs: parsed.mrs },
            },
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
    if (!window.confirm(`${tab.label} ${period} MBO 데이터를 삭제하시겠습니까?`)) return;
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

  // 선택 기간 데이터
  const displayData = useMemo(() => {
    if (!data) return null;
    if (!period || period === data.period) return data;
    const hist = data.history?.[period];
    return hist ? { ...data, ...hist, period } : null;
  }, [data, period]);

  const { total, divisions = [], offices = [], mrs = [] } = displayData || {};

  // 프로트랙(병원) / MS(로컬) 분리
  const isSpecial = useCallback((name) => {
    if (activeTab === 'hospital') return name === '병원본부(프로트랙)' || name === '프로트랙';
    return name === 'MS';
  }, [activeTab]);

  const mainDivisions = useMemo(() => divisions.filter(d => !isSpecial(d.name)), [divisions, isSpecial]);
  const mainOffices = useMemo(() => offices.filter(o => !isSpecial(o.office) && !isSpecial(o.division)), [offices, isSpecial]);

  // 정렬: finalGrade(S>A>B>C) → mainRate desc
  const gradeOrder = (g) => ['S','A','B','C'].indexOf(g) >= 0 ? ['S','A','B','C'].indexOf(g) : 99;
  const sortByGradeAndRate = (a, b) => {
    const d = gradeOrder(a.finalGrade) - gradeOrder(b.finalGrade);
    if (d !== 0) return d;
    return (b.mainRate || 0) - (a.mainRate || 0);
  };

  const sortedDivisions = useMemo(() => [...mainDivisions].sort(sortByGradeAndRate), [mainDivisions]);

  const filteredOffices = useMemo(() => {
    const sorted = [...mainOffices].sort(sortByGradeAndRate);
    if (gradeFilter === '전체') return sorted;
    return sorted.filter(o => o.finalGrade === gradeFilter);
  }, [mainOffices, gradeFilter]);

  const gradeCounts = useMemo(() => {
    const counts = { 전체: mainOffices.length, S: 0, A: 0, B: 0, C: 0 };
    mainOffices.forEach(o => { if (counts[o.finalGrade] != null) counts[o.finalGrade]++; });
    return counts;
  }, [mainOffices]);

  const sCount = gradeCounts.S;

  // 탭 버튼
  const TabButton = ({ id, label }) => (
    <button
      onClick={() => { setActiveTab(id); setGradeFilter('전체'); }}
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
              <span className="text-xl">📋</span>
              <div>
                <div className="text-sm font-medium text-[#1A1F2C]">{isLoading?'처리 중...':`${tab.label} MBO시스템 엑셀 업로드`}</div>
                <div className="text-xs text-[#9CA3AF]">● X월 MBO시스템평가양식_{tab.label}.xlsx</div>
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
      <div style={{ background: '#fff', padding: '40px 48px 32px', boxShadow: '0 1px 30px rgba(0,0,0,0.04)', borderRadius: 6 }}>
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
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>※ S 50%↑ / A 35%↑ / B 20%↑ / C 20%↓</div>
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
            <section style={{ marginBottom: 40 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, letterSpacing: '.05em' }}>01</span>
                  <h2 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 18, fontWeight: 700 }}>본부 현황</h2>
                </div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>
                  {tab.label} 전사 종합 / {mainDivisions.length}개 사업부 · {mainOffices.length}개 사무소 · MR {mrs.length}명
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <KpiCard label={`전체 ${tab.mainLabel}`} core coreLabel="CORE KPI" note={`MBO ${fmtNum(total?.mbo)}억 · ${tab.mainShort} ${fmtNum(total?.commit)}억`}>
                  <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 32, fontWeight: 800, color: '#34D399', letterSpacing: '-.025em', lineHeight: 1 }}>
                    {pctStr(total?.mainRate)}
                  </span>
                </KpiCard>
                <KpiCard label="본부 최종 평가" note={`${mainDivisions.length}개 사업부 종합 최종등급`}>
                  <GradeBadge grade={total?.finalGrade} size="lg" />
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>등급</span>
                </KpiCard>
                <KpiCard label="확인율" note={`확인 ${fmtNum(total?.confirm)}억 · 등급 ${total?.confirmGrade || '-'}`}>
                  <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 32, fontWeight: 800, color: gradeColor(total?.confirmGrade).fg, letterSpacing: '-.025em', lineHeight: 1 }}>
                    {pctStr(total?.confirmRate)}
                  </span>
                </KpiCard>
                <KpiCard label="일치율 / 오차율" note={`일치 등급 ${total?.matchGrade || '-'}`}>
                  <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 28, fontWeight: 800, color: gradeColor(total?.matchGrade).fg, letterSpacing: '-.025em', lineHeight: 1 }}>
                    {pctStr(total?.matchRate)}
                  </span>
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>/ {pctStr(total?.errorRate)}</span>
                </KpiCard>
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: '#9CA3AF' }}>
                우수(S) 사무소: <strong style={{ color: '#059669' }}>{sCount}개 / {mainOffices.length} ({((sCount/Math.max(1,mainOffices.length))*100).toFixed(1)}%)</strong>
              </div>
            </section>

            {/* 섹션 02: 사업부 평가 */}
            <section style={{ marginBottom: 40 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, letterSpacing: '.05em' }}>02</span>
                  <h2 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 18, fontWeight: 700 }}>사업부 평가</h2>
                </div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>
                  {mainDivisions.length}개 사업부 · 최종등급 내림차순
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, sortedDivisions.length || 1)}, 1fr)`, gap: 12 }}>
                {sortedDivisions.map(d => (
                  <BizCard key={d.name} div={d} mainLabel={tab.mainLabel} />
                ))}
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
                  {mainOffices.length}개 사무소 · 최종등급 내림차순 · 사무소명 클릭 → MR 상세
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

              {/* 테이블 */}
              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1150 }}>
                  <thead>
                    <tr>
                      {['#', '최종', '사업부', '사무소', '소장', 'MBO', tab.mainLabel, '평가', '확인율', '평가', '일치율', '오차율', '평가'].map((h, i) => (
                        <th key={i} style={{
                          textAlign: (i === 0 || i === 1) ? 'center' : (i <= 4 ? 'left' : 'right'),
                          padding: '11px 10px', fontWeight: i === 1 ? 700 : 500,
                          color: i === 1 ? '#1A1F2C' : '#6B7280', fontSize: i === 1 ? 11 : 10.5,
                          letterSpacing: '.02em', borderBottom: '1.5px solid #1A1F2C', borderTop: '1px solid #E5E7EB',
                          background: i === 1 ? '#FEF3C7' : '#FAF8F1', whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOffices.map((o, idx) => (
                      <OfficeRow key={o.office + idx} idx={idx} office={o} mainLabel={tab.mainLabel} onClick={setSelectedOffice} />
                    ))}
                  </tbody>
                </table>
                {filteredOffices.length === 0 && (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: '#9CA3AF' }}>조건에 맞는 사무소가 없습니다</div>
                )}
              </div>

            </section>

            <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #E5E7EB', textAlign: 'center', fontSize: 10.5, color: '#9CA3AF' }}>
              ※ 자료 기준일: {period} · MBO시스템 평가기준 S 50%↑ / A 35%↑ / B 20%↑ / C 20%↓
            </div>
          </>
        )}
      </div>

      {/* MR 모달 */}
      {selectedOffice && (
        <MRModal office={selectedOffice} mrs={mrs} type={activeTab} onClose={() => setSelectedOffice(null)} />
      )}
    </div>
  );
}
