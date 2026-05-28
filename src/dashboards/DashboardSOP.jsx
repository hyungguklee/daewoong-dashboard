import { useState, useCallback, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { parseSOPExcelFile } from '../utils/parseSOPExcel';
import { loadDashboard, saveDashboard } from '../utils/firebase';

const STORAGE_KEY = 'sop';

// ─── 색상 토큰 (HTML과 동일) ──────────────────────────────────────────────────
const C = {
  total: '#1a1a18', success: '#0F6E56', fail: '#A32D2D', review: '#185FA5', drop: '#D85A30',
  successSoft: '#E1F5EE', failSoft: '#FCEBEB', reviewSoft: '#EFF6FF', dropSoft: '#FEF3C7',
  finalPill: '#FCEBEB', finalText: '#791F1F',
  earlyPill: '#E1F5EE', earlyText: '#085041',
  beforePill: '#F1EFE8', beforeText: '#5F5E5A',
  hospPill: '#EFF6FF', hospText: '#1e40af',
  localPill: '#ECFDF5', localText: '#065f46',
  border: '#e0dfd8',
};

const fmtK = v => {
  if (v == null || isNaN(v)) return '0';
  const a = Math.abs(v);
  if (a >= 1e8) return (v / 1e8).toFixed(1) + '억';
  if (a >= 1e4) return (v / 1e4).toFixed(0) + '만';
  return Math.round(v).toLocaleString();
};

// ─── 작은 컴포넌트 ────────────────────────────────────────────────────────────
function Metric({ label, val, color = C.total, sub }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: sub ? 17 : 28, fontWeight: 700, lineHeight: 1, color }}>{val}</div>
    </div>
  );
}

function StageBadge({ stage }) {
  const map = {
    '최종평가':   { bg: C.finalPill,  fg: C.finalText },
    '조기성공':   { bg: C.earlyPill,  fg: C.earlyText },
    '평가전':     { bg: C.beforePill, fg: C.beforeText },
  };
  const c = map[stage] || map['평가전'];
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: c.bg, color: c.fg }}>{stage}</span>
  );
}

function TypePill({ type }) {
  const isHosp = (type || '').includes('병원');
  return (
    <span style={{
      display: 'inline-block', padding: '2px 7px', borderRadius: 3, fontSize: 10, fontWeight: 700,
      background: isHosp ? C.hospPill : C.localPill, color: isHosp ? C.hospText : C.localText,
    }}>{isHosp ? '병원' : '로컬'}</span>
  );
}

function ResultBadge({ result }) {
  if (!result) return null;
  if (result.includes('성공')) return <span style={pillStyle(C.successSoft, '#085041')}>🎉 SOP 성공</span>;
  if (result.includes('미달성')) return <span style={pillStyle(C.failSoft, C.finalText)}>SOP 미달성</span>;
  return <span style={pillStyle(C.reviewSoft, '#1e40af')}>익월 재평가</span>;
}
function DropBadge() {
  return <span style={{ ...pillStyle(C.dropSoft, '#92400e'), fontSize: 9, padding: '1px 6px' }}>⚠ Drop위험</span>;
}
function pillStyle(bg, fg) {
  return { display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: bg, color: fg };
}

// 가로 막대 (평가 단계별 차트용)
function HBar({ label, value, max, color, textColor = '#fff' }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: '#666', width: 92, textAlign: 'right', flexShrink: 0, lineHeight: 1.3 }}>{label}</div>
      <div style={{ flex: 1, background: '#f0efe8', borderRadius: 3, height: 17, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 3, display: 'flex', alignItems: 'center', padding: '0 7px', minWidth: 22, width: pct + '%', background: color }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: textColor }}>{value}</span>
        </div>
      </div>
    </div>
  );
}

// 상태 stacked bar (병원/로컬 종별 현황용)
function StatusBar({ items }) {
  const total = items.reduce((s, x) => s + x.v, 0);
  if (total === 0) return <div style={{ flex: 1, height: 21, background: '#eee', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#aaa' }}>데이터 없음</div>;
  return (
    <div style={{ display: 'flex', height: 21, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
      {items.map((it, i) => it.v > 0 && (
        <div key={i} style={{ flex: it.v, background: it.bg, color: it.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
          {it.label} {it.v}
        </div>
      ))}
    </div>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
export default function DashboardSOP({ isAdmin, period }) {
  const [activeTab, setActiveTab] = useState('tab1');
  const [data, setData] = useState(null);
  const [cloudLoading, setCloudLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [sopFilter, setSopFilter] = useState('전체'); // 전체/최종평가/조기성공/평가전/drop
  const [bunsinFilter, setBunsinFilter] = useState('전체'); // 전체/성공/달성/미달성
  const [searchLeader, setSearchLeader] = useState('');
  const [selectedLeader, setSelectedLeader] = useState(null);

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
      const parsed = await parseSOPExcelFile(file);
      parsed.period = period;
      const existing = await loadDashboard(STORAGE_KEY);
      const merged = existing
        ? {
            ...existing,
            history: {
              ...(existing.history || {}),
              [period]: { sopRows: parsed.sopRows, bunsinRows: parsed.bunsinRows, monthHeaders: parsed.monthHeaders },
            },
            period, sopRows: parsed.sopRows, bunsinRows: parsed.bunsinRows, monthHeaders: parsed.monthHeaders,
          }
        : { ...parsed, history: { [period]: { sopRows: parsed.sopRows, bunsinRows: parsed.bunsinRows, monthHeaders: parsed.monthHeaders } } };
      await saveDashboard(STORAGE_KEY, merged);
      setData(merged);
    } catch (err) {
      setUploadError('업로드 오류: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  const handleDelete = async () => {
    if (!window.confirm(`${period} SOP 데이터를 삭제하시겠습니까?`)) return;
    setIsLoading(true);
    try {
      const stored = await loadDashboard(STORAGE_KEY);
      if (!stored) { setData(null); return; }
      const updated = { ...stored, history: { ...(stored.history || {}) } };
      delete updated.history[period];
      if (updated.period === period) {
        const rem = Object.keys(updated.history);
        if (rem.length > 0) {
          const prev = rem[rem.length - 1];
          const h = updated.history[prev];
          Object.assign(updated, { period: prev, ...h });
        } else {
          await saveDashboard(STORAGE_KEY, { period: null, history: {} });
          setData(null); return;
        }
      }
      await saveDashboard(STORAGE_KEY, updated);
      setData(updated);
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

  const sopRows = displayData?.sopRows || [];
  const bunsinRows = displayData?.bunsinRows || [];
  const monthHeaders = displayData?.monthHeaders || { quality: [], sop: [] };

  // ── 통계 계산 ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const success = sopRows.filter(r => r.result.includes('성공')).length;
    const fail    = sopRows.filter(r => r.result.includes('미달성')).length;
    const review  = sopRows.filter(r => r.result.includes('재평가')).length;
    const drops   = sopRows.filter(r => r.isDrop).length;

    const stageCnt = { '최종평가': 0, '조기성공': 0, '평가전': 0 };
    sopRows.forEach(r => { stageCnt[r.stage] = (stageCnt[r.stage] || 0) + 1; });

    const hosp = sopRows.filter(r => r.type.includes('병원'));
    const local = sopRows.filter(r => r.type.includes('로컬'));
    const summarize = arr => ({
      total: arr.length,
      success: arr.filter(r => r.result.includes('성공')).length,
      fail: arr.filter(r => r.result.includes('미달성')).length,
      review: arr.filter(r => r.result.includes('재평가')).length,
    });
    return {
      total: sopRows.length, success, fail, review, drops,
      stageCnt,
      hosp: summarize(hosp),
      local: summarize(local),
      successRows: sopRows.filter(r => r.result.includes('성공')),
    };
  }, [sopRows]);

  const bunsinStats = useMemo(() => {
    const total = bunsinRows.length;
    const succ  = bunsinRows.filter(r => r.sopResult.includes('성공') || (r.kpiAchieve === '달성' && r.top30 === '달성')).length;
    const kpiOk = bunsinRows.filter(r => r.kpiAchieve === '달성').length;
    const top30Ok = bunsinRows.filter(r => r.top30 === '달성').length;
    const growths = bunsinRows.map(r => r.growth || 0).filter(v => v !== 0);
    const avgGrowth = growths.length ? growths.reduce((s, x) => s + x, 0) / growths.length : 0;
    return { total, succ, kpiOk, top30Ok, avgGrowth };
  }, [bunsinRows]);

  // SOP 필터링
  const filteredSOP = useMemo(() => {
    if (sopFilter === '전체') return sopRows;
    if (sopFilter === 'drop') return sopRows.filter(r => r.isDrop);
    return sopRows.filter(r => r.stage === sopFilter);
  }, [sopRows, sopFilter]);

  // 분신 필터링 + 검색
  const filteredBunsin = useMemo(() => {
    let list = bunsinRows;
    if (searchLeader) list = list.filter(r => r.leader.includes(searchLeader));
    if (bunsinFilter === '성공') list = list.filter(r => r.sopResult === '달성' || r.sopResult.includes('성공'));
    else if (bunsinFilter === '달성') list = list.filter(r => r.kpiAchieve === '달성');
    else if (bunsinFilter === '미달성') list = list.filter(r => r.kpiAchieve !== '달성');
    return list;
  }, [bunsinRows, searchLeader, bunsinFilter]);

  // 선택된 리더의 분신 데이터 (트렌드용)
  const selectedLeaderRows = useMemo(() => {
    if (!selectedLeader) return [];
    return bunsinRows.filter(r => r.leader === selectedLeader);
  }, [bunsinRows, selectedLeader]);

  const trendData = useMemo(() => {
    if (!selectedLeaderRows.length || !monthHeaders.sop?.length) return [];
    return monthHeaders.sop.map((mh, i) => {
      const row = { month: mh };
      selectedLeaderRows.forEach((r, idx) => {
        row[r.bunsin || `분신${idx+1}`] = r.sopMonthly[i] || 0;
      });
      return row;
    });
  }, [selectedLeaderRows, monthHeaders.sop]);

  // ── 렌더 ─────────────────────────────────────────────────────────────────────
  const TabBtn = ({ id, label }) => (
    <button onClick={() => setActiveTab(id)}
      style={{
        fontSize: 13, fontWeight: 700, padding: '9px 22px',
        border: 'none', background: 'transparent',
        color: activeTab === id ? '#1a1a18' : '#888',
        borderBottom: activeTab === id ? '2.5px solid #1a1a18' : '2.5px solid transparent',
        marginBottom: -1.5, cursor: 'pointer',
      }}>{label}</button>
  );

  const FilterChip = ({ value, label, current, onClick }) => (
    <button onClick={() => onClick(value)}
      style={{
        fontSize: 11, padding: '4px 12px', borderRadius: 20,
        border: `1px solid ${current === value ? '#1a1a18' : '#ccc'}`,
        background: current === value ? '#1a1a18' : '#f6f5f0',
        color: current === value ? '#fff' : '#666',
        cursor: 'pointer', fontWeight: 700,
      }}>{label}</button>
  );

  if (cloudLoading) {
    return <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>데이터 불러오는 중...</div>;
  }

  return (
    <div style={{ fontFamily: "'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif", color: '#1a1a18', fontSize: 14 }}>
      {/* Topbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '2px solid #1a1a18', paddingBottom: 13, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.4px' }}>SOP 리더 현황 대시보드</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
            {displayData ? `전체 ${stats.total}건 (병원 ${stats.hosp.total}명 / 로컬 ${stats.local.total}명) · 기준: ${period}` : '데이터를 업로드해주세요'}
          </div>
        </div>
        <span style={{ background: '#1a1a18', color: '#EDEDEA', fontSize: 11, fontWeight: 700, padding: '5px 13px', borderRadius: 4 }}>{period}</span>
      </div>

      {/* Admin 업로드 / 삭제 */}
      {isAdmin && (
        <div style={{ marginBottom: 18 }}>
          <div className="flex gap-2 items-stretch">
            <label className={`flex-1 flex items-center justify-center gap-3 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isLoading?'opacity-60':'hover:border-[#1a1a18] hover:bg-[#fafaf8]'} border-[#bbb]`}>
              <span className="text-xl">📂</span>
              <div>
                <div className="text-sm font-bold text-[#444]">{isLoading?'처리 중...':'SOP 엑셀 데이터 연동'}</div>
                <div className="text-xs text-[#999]">(홍보) SOP현황_26.X월 마감기준.xlsx</div>
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
            <div style={{ marginTop: 8, fontSize: 11, color: C.fail, background: C.failSoft, border: '1px solid #f5c5c5', borderRadius: 8, padding: '8px 14px' }}>{uploadError}</div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1.5px solid #ddd' }}>
        <TabBtn id="tab1" label="📋 SOP 평가 현황" />
        <TabBtn id="tab2" label="👥 분신별 현황" />
      </div>

      {!displayData || !sopRows.length ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
          <div>{period} SOP 데이터가 없습니다.{isAdmin ? ' 위에서 엑셀을 업로드해주세요.' : ' 관리자에게 문의해주세요.'}</div>
        </div>
      ) : (
        <>
          {/* ─── Tab1: SOP 평가 현황 ────────────────────────────────────────── */}
          {activeTab === 'tab1' && (
            <>
              {/* 종별 현황 */}
              <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 18px', marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 13 }}>종별 현황 및 최종 결과</div>
                <div style={{ marginBottom: 13 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 5 }}>병원 ({stats.hosp.total}명)</div>
                  <StatusBar items={[
                    { v: stats.hosp.success, label: '성공', bg: '#5DCAA5', fg: '#04342C' },
                    { v: stats.hosp.fail, label: '미달', bg: '#F09595', fg: C.finalText },
                    { v: stats.hosp.review, label: '재평가', bg: '#85B7EB', fg: '#042C53' },
                  ]} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 5 }}>로컬 ({stats.local.total}명)</div>
                  <StatusBar items={[
                    { v: stats.local.success, label: '성공', bg: '#5DCAA5', fg: '#04342C' },
                    { v: stats.local.fail, label: '미달', bg: '#F09595', fg: C.finalText },
                    { v: stats.local.review, label: '재평가', bg: '#85B7EB', fg: '#042C53' },
                  ]} />
                </div>
                {/* 이번 달 성공자 */}
                {stats.successRows.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0efe8' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>이번 달 SOP 성공자</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {stats.successRows.map((r, i) => (
                        <div key={i} style={{ background: C.successSoft, borderRadius: 7, padding: '8px 12px' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#085041' }}>🎉 {r.name}</div>
                          <div style={{ fontSize: 10, color: C.success, marginTop: 2 }}>{r.gen} · {r.division} {r.office} · {r.topic}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 요약 지표 */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>요약 지표</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                  <Metric label="전체 리더" val={stats.total} color={C.total} />
                  <Metric label="SOP 성공 🎉" val={stats.success} color={C.success} />
                  <Metric label="SOP 미달성" val={stats.fail} color={C.fail} />
                  <Metric label="익월 재평가" val={stats.review} color={C.review} />
                  <Metric label="Drop 위험 ⚠" val={stats.drops} color={C.drop} />
                </div>
              </div>

              {/* 평가 단계별 차트 */}
              <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 18px', marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 13 }}>평가 단계별 리더 현황</div>
                <HBar label="최종평가" value={stats.stageCnt['최종평가']} max={stats.total} color={C.fail} textColor="#fff" />
                <HBar label="조기성공" value={stats.stageCnt['조기성공']} max={stats.total} color={C.success} textColor="#fff" />
                <HBar label="평가전"   value={stats.stageCnt['평가전']}   max={stats.total} color="#9CA3AF" textColor="#fff" />
              </div>

              {/* 리더 상세 테이블 */}
              <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 18px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>리더별 상세 현황</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                  <FilterChip value="전체" label="전체" current={sopFilter} onClick={setSopFilter} />
                  <FilterChip value="최종평가" label="최종평가" current={sopFilter} onClick={setSopFilter} />
                  <FilterChip value="조기성공" label="조기성공평가" current={sopFilter} onClick={setSopFilter} />
                  <FilterChip value="평가전" label="평가전" current={sopFilter} onClick={setSopFilter} />
                  <FilterChip value="drop" label="⚠ Drop 위험" current={sopFilter} onClick={setSopFilter} />
                </div>
                <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                    <thead>
                      <tr>
                        {['No', '평가', '기수', '종별', '사업부', '사무소', '담당자', 'SOP과제', '분신', '성공분신', 'KPI달성', 'Drop위험', '최종결과'].map((h, i) => (
                          <th key={i} style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.3px', padding: '7px 10px', textAlign: 'left', borderBottom: `1px solid ${C.border}`, background: '#fafaf8', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSOP.map((r, idx) => (
                        <tr key={idx} className="hover:bg-[#fafaf8]" style={{ borderBottom: '1px solid #f0efe8' }}>
                          <td style={{ padding: '6px 10px' }}>{r.no}</td>
                          <td style={{ padding: '6px 10px' }}><StageBadge stage={r.stage} /></td>
                          <td style={{ padding: '6px 10px' }}>{r.gen}</td>
                          <td style={{ padding: '6px 10px' }}><TypePill type={r.type} /></td>
                          <td style={{ padding: '6px 10px' }}>{r.division}</td>
                          <td style={{ padding: '6px 10px' }}>{r.office}</td>
                          <td style={{ padding: '6px 10px', fontWeight: 600 }}>{r.name}</td>
                          <td style={{ padding: '6px 10px' }}>{r.topic}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>{r.bunsin}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: r.successBunsin > 0 ? C.success : '#ccc', fontWeight: 700 }}>{r.successBunsin}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: r.kpiAchieve > 0 ? C.success : '#ccc', fontWeight: 700 }}>{r.kpiAchieve}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>{r.isDrop ? <DropBadge /> : ''}</td>
                          <td style={{ padding: '6px 10px' }}><ResultBadge result={r.result} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredSOP.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: '#ccc' }}>조건에 맞는 데이터 없음</div>}
                </div>
              </div>
            </>
          )}

          {/* ─── Tab2: 분신별 현황 ──────────────────────────────────────────── */}
          {activeTab === 'tab2' && (
            <>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>분신 요약</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                  <Metric label="전체 분신" val={bunsinStats.total} color={C.total} />
                  <Metric label="성공 분신" val={bunsinStats.succ} color={C.success} />
                  <Metric label="KPI 달성" val={bunsinStats.kpiOk} color={C.review} />
                  <Metric label="상위 30% 달성" val={bunsinStats.top30Ok} color="#854F0B" />
                  <Metric label="성장금액 평균" val={fmtK(bunsinStats.avgGrowth)} color="#185FA5" sub />
                </div>
              </div>

              {/* 리더 검색 */}
              <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 18px', marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>리더 검색 & 월별 추이</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                  <input type="text" value={searchLeader} onChange={e => setSearchLeader(e.target.value)}
                    placeholder="리더 이름 검색 (예: 이인규)"
                    style={{ fontSize: 12, padding: '6px 12px', border: '1.5px solid #ddd', borderRadius: 7, outline: 'none', minWidth: 180 }} />
                  <FilterChip value="전체" label="전체" current={bunsinFilter} onClick={setBunsinFilter} />
                  <FilterChip value="성공" label="SOP 성공" current={bunsinFilter} onClick={setBunsinFilter} />
                  <FilterChip value="달성" label="KPI 달성" current={bunsinFilter} onClick={setBunsinFilter} />
                  <FilterChip value="미달성" label="KPI 미달성" current={bunsinFilter} onClick={setBunsinFilter} />
                </div>

                {/* 선택된 리더 패널 */}
                {selectedLeader && selectedLeaderRows.length > 0 && (
                  <div style={{ background: '#fff', border: '1px solid #378ADD', borderRadius: 10, padding: '18px 20px', marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 700 }}>{selectedLeader}</h3>
                        <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
                          {selectedLeaderRows[0].leaderDiv} {selectedLeaderRows[0].leaderOffice} · {selectedLeaderRows[0].topic} · 분신 {selectedLeaderRows.length}명
                        </div>
                      </div>
                      <button onClick={() => setSelectedLeader(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#bbb', padding: '2px 6px' }}>✕</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div style={{ height: 240 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#999', marginBottom: 8 }}>분신별 월별 실적 추이</div>
                        <ResponsiveContainer width="100%" height="90%">
                          <LineChart data={trendData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtK} />
                            <Tooltip formatter={v => fmtK(v)} />
                            {selectedLeaderRows.map((r, i) => (
                              <Line key={i} type="monotone" dataKey={r.bunsin} stroke={['#185FA5', '#0F6E56', '#A32D2D', '#D85A30', '#7C3AED'][i % 5]} strokeWidth={2} dot={{ r: 3 }} />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#999', marginBottom: 8 }}>분신별 KPI / 성장</div>
                        <div style={{ overflowX: 'auto', maxHeight: 220, overflowY: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                            <thead><tr>
                              {['분신', '사업부', 'KPI', '기준', '평가', '성장', 'KPI달성', '상위30%'].map((h, i) => (
                                <th key={i} style={{ background: '#fafaf8', fontSize: 9, padding: '5px 8px', borderBottom: `1px solid ${C.border}`, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {selectedLeaderRows.map((r, i) => (
                                <tr key={i}>
                                  <td style={{ padding: '5px 8px', fontWeight: 700, color: '#333' }}>{r.bunsin}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{r.bunsinDiv}/{r.bunsinOffice}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{fmtK(r.kpi)}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{fmtK(r.ref3mo)}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{fmtK(r.eval3mo)}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right', color: r.growth > 0 ? C.success : r.growth < 0 ? C.fail : '#ccc', fontWeight: 700 }}>{r.growth > 0 ? '+' : ''}{fmtK(r.growth)}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'center', color: r.kpiAchieve === '달성' ? C.success : '#ccc', fontWeight: 700 }}>{r.kpiAchieve === '달성' ? '✓' : '·'}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'center', color: r.top30 === '달성' ? '#854F0B' : '#ccc', fontWeight: 700 }}>{r.top30 === '달성' ? '✓' : '·'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 분신 전체 테이블 */}
                <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                    <thead>
                      <tr>
                        {['기수', '본부', '리더', 'SOP과제', '분신 사무소', '분신', 'KPI', '성장', 'KPI달성', '상위30%', 'SOP'].map((h, i) => (
                          <th key={i} style={{ fontSize: 10, fontWeight: 700, color: '#999', padding: '7px 10px', textAlign: 'left', borderBottom: `1px solid ${C.border}`, background: '#fafaf8', whiteSpace: 'nowrap', position: 'sticky', top: 0 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBunsin.map((r, idx) => (
                        <tr key={idx} className="hover:bg-[#fafaf8]" style={{ borderBottom: '1px solid #f0efe8', cursor: 'pointer' }}
                          onClick={() => setSelectedLeader(r.leader)}>
                          <td style={{ padding: '6px 10px' }}>{r.gen}</td>
                          <td style={{ padding: '6px 10px' }}>{r.hq}</td>
                          <td style={{ padding: '6px 10px', fontWeight: 700, color: '#185FA5' }}>{r.leader}</td>
                          <td style={{ padding: '6px 10px' }}>{r.topic}</td>
                          <td style={{ padding: '6px 10px' }}>{r.bunsinDiv} {r.bunsinOffice}</td>
                          <td style={{ padding: '6px 10px', fontWeight: 600 }}>{r.bunsin}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmtK(r.kpi)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: r.growth > 0 ? C.success : r.growth < 0 ? C.fail : '#ccc', fontWeight: 700 }}>{r.growth > 0 ? '+' : ''}{fmtK(r.growth)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: r.kpiAchieve === '달성' ? C.success : '#ccc', fontWeight: 700 }}>{r.kpiAchieve === '달성' ? '✓ 달성' : '·'}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>{r.top30 === '달성' ? <span style={{ background: C.successSoft, color: '#085041', borderRadius: 3, padding: '1px 5px', fontSize: 10, fontWeight: 700 }}>달성</span> : <span style={{ color: '#ccc' }}>·</span>}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>{r.sopResult === '달성' ? <span style={{ background: '#5DCAA5', color: '#fff', borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>SOP</span> : <span style={{ color: '#ccc' }}>·</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredBunsin.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: '#ccc' }}>조건에 맞는 분신 없음</div>}
                </div>
                <div style={{ marginTop: 8, fontSize: 10, color: '#888', textAlign: 'center' }}>
                  💡 표의 행을 클릭하면 해당 리더의 월별 추이가 위쪽에 표시됩니다
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
