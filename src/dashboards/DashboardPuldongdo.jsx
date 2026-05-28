import { useState, useCallback, useMemo, useEffect } from 'react';
import { parsePuldongdoExcelFile } from '../utils/parsePuldongdoExcel';
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
    storageKey: 'puldongdo_hospital',
    title: 'ETC병원 풀동도 평가',
    eyebrow: 'PULDONGDO EVALUATION · HOSPITAL',
    itemLabel: '고객수',
  },
  local: {
    label: '로컬',
    storageKey: 'puldongdo_local',
    title: 'ETC로컬 풀동도 평가',
    eyebrow: 'PULDONGDO EVALUATION · LOCAL',
    itemLabel: '품목수',
  },
};

const pctStr = (v, dec = 1) => v != null && !isNaN(v) ? (v * 100).toFixed(dec) + '%' : '-';
const gradeColor = g => GRADE_COLORS[g] || { fg: '#6B7280', bg: '#F3F4F6' };
const fmtNum = (v, dec = 0) => v == null || v === 0 ? '-' : Number(v).toLocaleString(undefined, { maximumFractionDigits: dec });
const fmtMoney = v => v == null || v === 0 ? '-' : Math.round(v).toLocaleString();

// ─── 작은 컴포넌트들 ──────────────────────────────────────────────────────────
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

function OfficeRow({ idx, office, itemLabel }) {
  const fc = gradeColor(office.finalGrade);
  return (
    <tr style={{ borderBottom: '1px solid #F3F4F6' }} className="hover:bg-[#F7F7F4]">
      <td style={{ padding: '10px 4px', color: '#9CA3AF', fontSize: 10.5, textAlign: 'center' }}>{idx + 1}</td>
      <td style={{ padding: '10px 4px', textAlign: 'center', background: fc.bg }}><GradeBadge grade={office.finalGrade} size="sm" /></td>
      <td style={{ padding: '10px 5px', fontSize: 11.5 }}>{office.division}</td>
      <td style={{ padding: '10px 5px', fontWeight: 700, fontSize: 11.5 }}>{office.office}</td>
      <td style={{ padding: '10px 5px', fontSize: 11 }}>{office.manager}</td>
      <td style={{ padding: '10px 4px', textAlign: 'right', fontSize: 11 }}>{fmtNum(office.evalCount)}</td>
      <td style={{ padding: '10px 4px', textAlign: 'right', fontSize: 11 }}>{fmtNum(office.itemCount)}</td>
      <td style={{ padding: '10px 5px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{fmtMoney(office.mbo)}</td>
      <td style={{ padding: '10px 5px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{fmtMoney(office.commitPerHead)}</td>
      <td style={{ padding: '10px 5px', textAlign: 'right', fontSize: 11 }}>{pctStr(office.commitRate)}</td>
      <td style={{ padding: '10px 5px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{fmtMoney(office.confirmPerHead)}</td>
      <td style={{ padding: '10px 5px', textAlign: 'right', fontWeight: 700, color: gradeColor(office.confirmGrade).fg, fontSize: 11 }}>{pctStr(office.confirmRate)}</td>
      <td style={{ padding: '10px 4px', textAlign: 'center' }}><GradeBadge grade={office.confirmGrade} size="sm" /></td>
      <td style={{ padding: '10px 5px', textAlign: 'right', fontWeight: 700, color: gradeColor(office.matchGrade).fg, fontSize: 11 }}>{pctStr(office.matchRate)}</td>
      <td style={{ padding: '10px 4px', textAlign: 'center' }}><GradeBadge grade={office.matchGrade} size="sm" /></td>
    </tr>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
export default function DashboardPuldongdo({ isAdmin, period }) {
  const [activeTab, setActiveTab] = useState('hospital');
  const [dataMap, setDataMap] = useState({ hospital: null, local: null });
  const [cloudLoading, setCloudLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [gradeFilter, setGradeFilter] = useState('전체');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [h, l] = await Promise.all([
        loadDashboard('puldongdo_hospital'),
        loadDashboard('puldongdo_local'),
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
      const parsed = await parsePuldongdoExcelFile(file);
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
              [period]: { total: parsed.total, offices: parsed.offices },
            },
            period, total: parsed.total, offices: parsed.offices, type: parsed.type,
          }
        : { ...parsed, history: { [period]: { total: parsed.total, offices: parsed.offices } } };
      await saveDashboard(tab.storageKey, merged);
      setDataMap(prev => ({ ...prev, [activeTab]: merged }));
    } catch (err) {
      setUploadError('업로드 오류: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, period, tab]);

  const handleDelete = async () => {
    if (!window.confirm(`${tab.label} ${period} 풀동도 데이터를 삭제하시겠습니까?`)) return;
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

  const { total, offices = [] } = displayData || {};

  // 정렬: finalGrade desc → confirmRate desc
  const gradeOrder = g => GRADES.indexOf(g) >= 0 ? GRADES.indexOf(g) : 99;
  const filteredOffices = useMemo(() => {
    const sorted = [...offices].sort((a, b) => {
      const d = gradeOrder(a.finalGrade) - gradeOrder(b.finalGrade);
      if (d !== 0) return d;
      return (b.confirmRate || 0) - (a.confirmRate || 0);
    });
    if (gradeFilter === '전체') return sorted;
    return sorted.filter(o => o.finalGrade === gradeFilter);
  }, [offices, gradeFilter]);

  const gradeCounts = useMemo(() => {
    const c = { 전체: offices.length, S: 0, A: 0, B: 0, C: 0 };
    offices.forEach(o => { if (c[o.finalGrade] != null) c[o.finalGrade]++; });
    return c;
  }, [offices]);
  const sCount = gradeCounts.S;

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
                <div className="text-sm font-medium text-[#1A1F2C]">{isLoading?'처리 중...':`${tab.label} 풀동도 평가 엑셀 업로드`}</div>
                <div className="text-xs text-[#9CA3AF]">● 26.X월 풀동도 최종_{tab.label}(산출).xlsx</div>
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
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
              {tab.label === '병원' ? '확인율 S 80%↑ · 일치율 S 50%↑' : '확인율 S 80%↑ · 일치율 S 60%↑'}
            </div>
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
                  {tab.label} 전사 종합 / {offices.length}개 사무소 · 평가 {total?.evalCount}명 · {tab.itemLabel} {fmtNum(total?.itemCount)}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <KpiCard label="본부 풀동도 최종등급" core coreLabel="CORE KPI" note={`점수 ${total?.finalScore} · ${offices.length}개 사무소 종합`}>
                  <GradeBadge grade={total?.finalGrade} size="lg" />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>등급</span>
                </KpiCard>
                <KpiCard label="약속율" note={`약속 ${fmtMoney(total?.commitTotal)} / MBO ${fmtMoney(total?.mbo)}`}>
                  <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 32, fontWeight: 800, color: '#1A1F2C', letterSpacing: '-.025em', lineHeight: 1 }}>
                    {pctStr(total?.commitRate)}
                  </span>
                </KpiCard>
                <KpiCard label="확인율" note={`확인 ${fmtMoney(total?.confirmTotal)} · 등급 ${total?.confirmGrade || '-'}`}>
                  <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 32, fontWeight: 800, color: gradeColor(total?.confirmGrade).fg, letterSpacing: '-.025em', lineHeight: 1 }}>
                    {pctStr(total?.confirmRate)}
                  </span>
                </KpiCard>
                <KpiCard label="확인 일치율" note={`등급 ${total?.matchGrade || '-'}`}>
                  <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 32, fontWeight: 800, color: gradeColor(total?.matchGrade).fg, letterSpacing: '-.025em', lineHeight: 1 }}>
                    {pctStr(total?.matchRate)}
                  </span>
                </KpiCard>
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: '#9CA3AF' }}>
                우수(S) 사무소: <strong style={{ color: '#059669' }}>{sCount}개 / {offices.length} ({((sCount/Math.max(1,offices.length))*100).toFixed(1)}%)</strong>
              </div>
            </section>

            {/* 섹션 02: 사무소 평가 */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, letterSpacing: '.05em' }}>02</span>
                  <h2 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 18, fontWeight: 700 }}>사무소 평가</h2>
                </div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>
                  {offices.length}개 사무소 · 최종등급 내림차순
                </div>
              </div>

              {/* 등급 칩 필터 */}
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
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: 28 }} />     {/* # */}
                    <col style={{ width: 40 }} />     {/* 최종 */}
                    <col style={{ width: 50 }} />     {/* 사업부 */}
                    <col style={{ width: 80 }} />     {/* 사무소 */}
                    <col style={{ width: 55 }} />     {/* 소장 */}
                    <col style={{ width: 38 }} />     {/* 인원 */}
                    <col style={{ width: 50 }} />     {/* 고객수/품목수 */}
                    <col style={{ width: 70 }} />     {/* MBO */}
                    <col style={{ width: 70 }} />     {/* 약속 인당평균 */}
                    <col style={{ width: 50 }} />     {/* 약속 % */}
                    <col style={{ width: 70 }} />     {/* 확인 인당평균 */}
                    <col style={{ width: 50 }} />     {/* 확인 % */}
                    <col style={{ width: 40 }} />     {/* 확인 평가 */}
                    <col style={{ width: 55 }} />     {/* 일치율 % */}
                    <col style={{ width: 40 }} />     {/* 일치율 평가 */}
                  </colgroup>
                  <thead>
                    <tr>
                      <th rowSpan={2} style={thStyle(true)}>#</th>
                      <th rowSpan={2} style={{ ...thStyle(true), background: '#FEF3C7', color: '#1A1F2C', fontWeight: 800, fontSize: 11 }}>최종</th>
                      <th rowSpan={2} style={thStyle('left')}>사업부</th>
                      <th rowSpan={2} style={thStyle('left')}>사무소</th>
                      <th rowSpan={2} style={thStyle('left')}>소장</th>
                      <th rowSpan={2} style={thStyle('right')}>인원</th>
                      <th rowSpan={2} style={thStyle('right')}>{tab.itemLabel}</th>
                      <th rowSpan={2} style={thStyle('right')}>MBO</th>
                      <th colSpan={2} style={thStyle('center')}>약속</th>
                      <th colSpan={3} style={thStyle('center')}>확인</th>
                      <th colSpan={2} style={thStyle('center')}>일치율</th>
                    </tr>
                    <tr>
                      <th style={thStyle('right', true)}>인당평균</th>
                      <th style={thStyle('right', true)}>%</th>
                      <th style={thStyle('right', true)}>인당평균</th>
                      <th style={thStyle('right', true)}>%</th>
                      <th style={thStyle('center', true)}>평가</th>
                      <th style={thStyle('right', true)}>%</th>
                      <th style={thStyle('center', true)}>평가</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOffices.map((o, idx) => (
                      <OfficeRow key={o.office + idx} idx={idx} office={o} itemLabel={tab.itemLabel} />
                    ))}
                  </tbody>
                </table>
                {filteredOffices.length === 0 && (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: '#9CA3AF' }}>조건에 맞는 사무소가 없습니다</div>
                )}
              </div>
            </section>

            <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #E5E7EB', textAlign: 'center', fontSize: 10.5, color: '#9CA3AF' }}>
              ※ 자료 기준일: {period} · 풀동도 확인율 평가 S 80%↑ / A 64%↑ / B 48%↑ / C 48%↓
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function thStyle(align, sub = false) {
  const a = align === true ? 'center' : align;
  return {
    padding: '8px 4px',
    fontWeight: 500,
    color: '#6B7280',
    fontSize: sub ? 9.5 : 10,
    letterSpacing: '.02em',
    borderBottom: '1.5px solid #1A1F2C',
    borderTop: '1px solid #E5E7EB',
    background: sub ? '#FAFAF8' : '#FAF8F1',
    whiteSpace: 'nowrap',
    textAlign: typeof a === 'string' ? a : 'center',
  };
}
