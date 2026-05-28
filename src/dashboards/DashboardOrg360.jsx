import { useEffect, useMemo, useState } from 'react';
import { loadDashboard } from '../utils/firebase';
import { Sparkline, C } from '../components/InsightCharts';

// ─── 포맷터 ─────────────────────────────────────────────────────
const pct = (v, d = 1) => v == null || isNaN(v) ? '-' : (v * 100).toFixed(d) + '%';
const fnum = (v, d = 1) => v == null || isNaN(v) ? '-' : Number(v).toFixed(d);
const money = v => { if (v == null) return '-'; const a = Math.abs(v); if (a >= 1e8) return (v / 1e8).toFixed(1) + '억'; if (a >= 1e6) return (v / 1e6).toFixed(1) + '백만'; return Math.round(v).toLocaleString(); };
const periodShort = p => (p || '').replace(/26년\s*/, '').replace(/0(\d월)/, '$1');

const gradeColor = g => {
  if (!g) return '#9CA3AF';
  if (['S', 'Ap', 'A'].includes(g)) return '#059669';
  if (['Bp', 'B'].includes(g)) return '#0EA5E9';
  if (g === 'Cp') return '#F59E0B';
  return '#DC2626';
};

// ─── 과제별 핵심 지표 정의 ──────────────────────────────────────
// pct: 백분율 여부 / goodHigh: 높을수록 좋은지 / money: 금액 포맷
const METRICS = {
  mbo: { gradeKey: 'finalGrade', items: [
    { key: 'matchRate', label: '일치율', pct: true, goodHigh: true, primary: true },
    { key: 'errorRate', label: '오차율', pct: true, goodHigh: false },
    { key: 'mbo', label: 'MBO수립', unit: '억', goodHigh: true },
  ]},
  puldongdo: { gradeKey: 'finalGrade', items: [
    { key: 'confirmRate', label: '확인율', pct: true, goodHigh: true, primary: true },
    { key: 'matchRate', label: '일치율', pct: true, goodHigh: true },
    { key: 'commitPerHead', label: '인당약속', goodHigh: true },
  ]},
  h110: { gradeKey: 'grade_final', items: [
    { key: 'result_pass_rate', label: '통과율', pct: true, goodHigh: true, primary: true },
    { key: 'result_sangjeong_rate', label: '상정율', pct: true, goodHigh: true },
    { key: 'mbo_rate', label: 'MBO수립율', pct: true, goodHigh: true },
  ]},
  h2nd: { gradeKey: 'grade_final', items: [
    { key: 'trade_rate', label: '거래율', pct: true, goodHigh: true, primary: true },
    { key: 'growth_rate', label: '성장률', pct: true, goodHigh: true },
    { key: 'sales_mil', label: '매출', unit: '백만', goodHigh: true },
  ]},
  cs: { gradeKey: 'grade', items: [
    { key: 'curPer', label: '인당 4단계↑', goodHigh: true, primary: true },
    { key: 'curCount', label: '4단계↑ 수', goodHigh: true },
    { key: 'chgCount', label: '단계상승', goodHigh: true },
  ]},
  direct: { gradeKey: 'grade', items: [
    { key: 'achieveRate', label: '달성률', pct: true, goodHigh: true, primary: true },
    { key: 'activeRate', label: '가동률', pct: true, goodHigh: true },
    { key: 'salesAmount', label: '매출', money: true, goodHigh: true },
  ]},
  shinjepum: { gradeKey: 'grade', items: [
    { key: 'rate', label: '저변 달성률', pct: true, goodHigh: true, primary: true },
  ]},
  perf: { gradeKey: null, items: [
    { key: 'growthRate', label: '성장률', pct: true, goodHigh: true, primary: true },
    { key: 'growth', label: '성장금액', money: true, goodHigh: true },
    { key: 'sales', label: '매출', money: true, goodHigh: true },
  ]},
};

const fmtMetric = (m, v) => {
  if (v == null || isNaN(v)) return '-';
  if (m.money) return money(v);
  if (m.pct) return pct(v);
  return fnum(v, 1) + (m.unit ? m.unit : '');
};

const taskBucket = t => t.bucket || (['h110', 'h2nd'].includes(t.kind) ? 'hospital' : null);

// 사무소/사업부 이름 정규화: "병원경인사무소"=="병원경인", "서울1사업부"=="서울1"
// 표기 흔들림(접미사, 공백)을 흡수해 동일 조직으로 병합
const normUnit = s => (s || '').replace(/사무소$/, '').replace(/사업부$/, '').replace(/\s+/g, '').trim();

// 등급 표기: Ap→A+, Bp→B+, Cp→C+ (과제 목록과 동일하게)
const fmtGrade = g => g ? String(g).replace(/p$/i, '+') : g;

// 프로트랙(병원본부)·MS(로컬본부)는 사업부가 아니라 사무소로 취급.
// "병원본부(프로트랙)", "프로트랙사무소", "서울3(MS)", "MS" 등 모든 표기를 흡수.
function specialOfficeName(division, office) {
  const s = `${division || ''} ${office || ''}`;
  if (s.includes('프로트랙')) return '프로트랙';
  if (/MS/.test(s)) return 'MS';
  return null;
}
// 조직 단위 해석: 특수 사무소면 {division:'', office:특수명}, 아니면 정규화 div/off
function resolveUnit(division, office) {
  const sp = specialOfficeName(division, office);
  if (sp) return { division: '', office: sp };
  return { division: normUnit(division), office: normUnit(office) };
}

// 백분위 (0~1): bucket 내 같은 과제 사무소들의 "실제 지표값" 기준 상대 위치
// 동점은 공정하게 중간값 처리 (countBelow + 0.5*countEqual) / n
function percentileOf(value, allValues, goodHigh) {
  if (value == null) return null;
  const arr = allValues.filter(v => v != null);
  if (arr.length < 3) return null;
  const below = arr.filter(v => v < value).length;
  const equal = arr.filter(v => v === value).length;
  const rank = (below + 0.5 * equal) / arr.length; // 0~1
  const clamped = Math.max(0, Math.min(1, rank));
  return goodHigh ? clamped : 1 - clamped;
}

export default function DashboardOrg360() {
  const [facts, setFacts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bucketTab, setBucketTab] = useState('hospital'); // hospital | local
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null); // { division, office }

  useEffect(() => {
    (async () => {
      try {
        const f = await loadDashboard('insight_facts');
        setFacts(f);
      } catch (e) { setError(e.message); } finally { setLoading(false); }
    })();
  }, []);

  // 사무소 목록 (bucket별)
  const officeIndex = useMemo(() => {
    if (!facts?.tasks) return {};
    const map = {}; // key -> { division, office, bucket, manager }
    for (const t of facts.tasks) {
      if (t.kind === 'sop') continue;
      const bk = taskBucket(t);
      if (!bk) continue;
      for (const p of (t.periods || [])) {
        for (const o of (t.series?.[p]?.offices || [])) {
          if (!o.office) continue;
          const { division: nd, office: no } = resolveUnit(o.division, o.office);
          if (!no) continue;
          const key = `${bk}::${nd}::${no}`;
          if (!map[key]) map[key] = { division: nd, office: no, bucket: bk, manager: o.manager || '' };
          if (o.manager && !map[key].manager) map[key].manager = o.manager;
        }
      }
    }
    return map;
  }, [facts]);

  const officeList = useMemo(() => {
    return Object.values(officeIndex)
      .filter(o => o.bucket === bucketTab)
      .sort((a, b) => (a.division + a.office).localeCompare(b.division + b.office, 'ko'));
  }, [officeIndex, bucketTab]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return officeList;
    return officeList.filter(o => (o.office + o.division + (o.manager || '')).includes(q));
  }, [officeList, query]);

  // 선택된 사무소의 과제별 데이터 계산
  const orgData = useMemo(() => {
    if (!facts?.tasks || !selected) return null;
    const result = [];
    for (const t of facts.tasks) {
      if (t.kind === 'sop') continue;
      const bk = taskBucket(t);
      if (bk !== selected.bucket) continue;
      const def = METRICS[t.kind];
      if (!def) continue;
      const periods = t.periods || [];
      // 사무소의 기간별 데이터 (정규화·특수사무소 해석으로 표기 흔들림 흡수)
      const findOffice = p => (t.series?.[p]?.offices || []).find(o => {
        const r = resolveUnit(o.division, o.office);
        return r.division === selected.division && r.office === selected.office;
      });
      const latestP = periods[periods.length - 1];
      const latestO = latestP ? findOffice(latestP) : null;
      if (!latestO) continue; // 이 과제에 해당 사무소 데이터 없음

      const primary = def.items.find(m => m.primary) || def.items[0];
      // 백분위 풀: 특수 사무소(프로트랙/MS) 제외 (교차분석 방식과 동일)
      const allLatest = (t.series?.[latestP]?.offices || [])
        .filter(o => !specialOfficeName(o.division, o.office))
        .map(o => o[primary.key]);
      const primPct = percentileOf(latestO[primary.key], allLatest, primary.goodHigh);

      const metrics = def.items.map(m => ({
        ...m,
        value: latestO[m.key],
        trend: periods.map(p => findOffice(p)?.[m.key] ?? null),
      }));

      result.push({
        taskId: t.id, kind: t.kind, label: t.label,
        grade: def.gradeKey ? latestO[def.gradeKey] : null,
        latestP, periods,
        primary, primaryPct: primPct,
        metrics,
      });
    }
    return result;
  }, [facts, selected]);

  // 사업부별 종합 (현재 본부의 4개 사업부 × 과제 핵심지표 평균 추세)
  const divisionData = useMemo(() => {
    if (!facts?.tasks) return null;
    const divs = {}; // normDiv -> { division, tasks: { taskId: { label, kind, primary, byPeriod, periods } } }
    for (const t of facts.tasks) {
      if (t.kind === 'sop') continue;
      const bk = taskBucket(t);
      if (bk !== bucketTab) continue;
      const def = METRICS[t.kind]; if (!def) continue;
      const primary = def.items.find(m => m.primary) || def.items[0];
      const periods = t.periods || [];
      for (const p of periods) {
        const byDiv = {};
        for (const o of (t.series?.[p]?.offices || [])) {
          const { division: nd } = resolveUnit(o.division, o.office);
          if (!nd) continue; // 프로트랙/MS 등 특수 사무소는 사업부 집계에서 제외
          const v = o[primary.key];
          if (v == null) continue;
          (byDiv[nd] = byDiv[nd] || []).push(v);
        }
        for (const [nd, arr] of Object.entries(byDiv)) {
          divs[nd] = divs[nd] || { division: nd, tasks: {} };
          const tk = divs[nd].tasks[t.id] = divs[nd].tasks[t.id] || { label: t.label, kind: t.kind, primary, periods, byPeriod: {} };
          // 사업부 값 = 소속 사무소 핵심지표 평균 (비율형 지표 기준)
          tk.byPeriod[p] = arr.reduce((s, x) => s + x, 0) / arr.length;
        }
      }
    }
    // 정렬: 사업부명 / 각 과제 trend 배열 변환
    return Object.values(divs)
      .sort((a, b) => a.division.localeCompare(b.division, 'ko'))
      .map(d => ({
        division: d.division,
        tasks: Object.values(d.tasks).map(tk => ({
          ...tk,
          trend: tk.periods.map(p => tk.byPeriod[p] ?? null),
          latest: tk.byPeriod[tk.periods[tk.periods.length - 1]] ?? null,
        })),
      }));
  }, [facts, bucketTab]);

  // 전 사무소 교차분석 종합점수 (현재 본부, 모든 과제 핵심지표 백분위 평균)
  const officeScores = useMemo(() => {
    if (!facts?.tasks) return {};
    const acc = {}; // 'div::off' -> { division, office, sum, count }
    for (const t of facts.tasks) {
      if (t.kind === 'sop') continue;
      const bk = taskBucket(t);
      if (bk !== bucketTab) continue;
      const def = METRICS[t.kind]; if (!def) continue;
      const primary = def.items.find(m => m.primary) || def.items[0];
      const periods = t.periods || [];
      const latestP = periods[periods.length - 1];
      if (!latestP) continue;
      const offices = t.series?.[latestP]?.offices || [];
      // 풀: 특수 사무소 제외
      const pool = offices.filter(o => !specialOfficeName(o.division, o.office)).map(o => o[primary.key]);
      for (const o of offices) {
        const { division: nd, office: no } = resolveUnit(o.division, o.office);
        if (!no) continue;
        const pctl = percentileOf(o[primary.key], pool, primary.goodHigh);
        if (pctl == null) continue;
        const key = `${nd}::${no}`;
        acc[key] = acc[key] || { division: nd, office: no, sum: 0, count: 0 };
        acc[key].sum += pctl;
        acc[key].count += 1;
      }
    }
    const out = {};
    for (const [k, v] of Object.entries(acc)) out[k] = { ...v, score: v.count ? v.sum / v.count : null };
    return out;
  }, [facts, bucketTab]);

  // 사업부별 소속 사무소 (종합점수 내림차순)
  const officesByDivision = useMemo(() => {
    const m = {};
    for (const o of officeList) {
      if (!o.division) continue; // 특수 사무소(프로트랙/MS)는 사업부 없음 → 제외
      const sc = officeScores[`${o.division}::${o.office}`];
      (m[o.division] = m[o.division] || []).push({ ...o, score: sc?.score ?? null });
    }
    for (const div of Object.keys(m)) m[div].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    return m;
  }, [officeList, officeScores]);

  // 강점/약점
  const summary = useMemo(() => {
    if (!orgData) return null;
    const strengths = orgData.filter(d => d.primaryPct != null && d.primaryPct >= 0.7);
    const weaknesses = orgData.filter(d => d.primaryPct != null && d.primaryPct <= 0.3);
    const scored = orgData.filter(d => d.primaryPct != null);
    const avg = scored.length ? scored.reduce((s, d) => s + d.primaryPct, 0) / scored.length : null;
    return { strengths, weaknesses, avg, taskCount: orgData.length };
  }, [orgData]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>로딩 중...</div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>오류: {error}</div>;
  if (!facts) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#374151', marginBottom: 8 }}>데이터가 아직 없습니다</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>먼저 인사이트 캐시를 빌드하세요:</div>
        <code style={{ background: '#F3F4F6', padding: '8px 16px', borderRadius: 6, fontSize: 12 }}>node scripts/build-insights.mjs</code>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif" }}>
      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(135deg, #1A3A6B, #2D5A9A)', color: '#fff', padding: '22px 26px', borderRadius: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 10, letterSpacing: '.18em', color: '#FCD34D', fontWeight: 700 }}>ORG 360° · 영업기획팀</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>🔎 조직 360도 뷰</h1>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 6 }}>
          사무소 하나의 전 과제 성적을 한눈에 · 기준 {facts.latestPeriod} · 누적 {facts.startPeriod}~
        </div>
      </div>

      {/* 본부 탭 + 검색 */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {[{ id: 'hospital', label: '🏥 병원본부' }, { id: 'local', label: '🏪 로컬본부' }].map(b => (
            <button key={b.id} onClick={() => { setBucketTab(b.id); setSelected(null); setQuery(''); }}
              style={{ padding: '7px 16px', fontSize: 12, fontWeight: 700, borderRadius: 18, border: '1px solid #E5E7EB', background: bucketTab === b.id ? '#1A3A6B' : '#fff', color: bucketTab === b.id ? '#fff' : '#374151', cursor: 'pointer' }}>
              {b.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="사무소명 검색 (예: 병원강원, 소장명...)"
          style={{ width: '100%', fontSize: 14, padding: '10px 14px', border: '2px solid #E5E7EB', borderRadius: 10, outline: 'none' }}
          onFocus={e => e.target.style.borderColor = '#1A3A6B'}
          onBlur={e => e.target.style.borderColor = '#E5E7EB'}
        />
        {/* 사무소 선택 칩 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, maxHeight: 200, overflow: 'auto' }}>
          {filtered.map(o => {
            const key = `${o.division}::${o.office}`;
            const isSel = selected && selected.division === o.division && selected.office === o.office;
            return (
              <button key={key} onClick={() => setSelected(o)}
                style={{ padding: '6px 12px', fontSize: 12, borderRadius: 16, border: '1px solid #E5E7EB', background: isSel ? '#1A3A6B' : '#F9FAFB', color: isSel ? '#fff' : '#374151', cursor: 'pointer' }}>
                {o.office}{o.manager ? ` · ${o.manager}` : ''}
              </button>
            );
          })}
          {filtered.length === 0 && <div style={{ fontSize: 12, color: '#9CA3AF', padding: 8 }}>검색 결과 없음</div>}
        </div>
      </div>

      {/* 사업부별 종합 (4개 사업부) */}
      {divisionData && divisionData.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1A3A6B', marginBottom: 8 }}>
            🏢 {bucketTab === 'hospital' ? '병원본부' : '로컬본부'} 사업부별 종합 <span style={{ fontSize: 11, fontWeight: 500, color: '#9CA3AF' }}>· 소속 사무소 핵심지표 평균 (1~3월 추세)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {divisionData.map(d => (
              <div key={d.division} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111', marginBottom: 8, paddingBottom: 6, borderBottom: '2px solid #1A3A6B' }}>{d.division}</div>
                {d.tasks.map(tk => (
                  <div key={tk.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderTop: '1px solid #F3F4F6' }}>
                    <span style={{ fontSize: 11.5, color: '#6B7280' }}>{tk.label.split('(')[0].trim()} · {tk.primary.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Sparkline values={tk.trend} goodHigh={tk.primary.goodHigh} width={56} height={18} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1F2937', minWidth: 54, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtMetric(tk.primary, tk.latest)}</span>
                    </div>
                  </div>
                ))}

                {/* 소속 사무소 종합점수 랭킹 */}
                {officesByDivision[d.division]?.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: '2px dashed #E5E7EB' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', marginBottom: 6, letterSpacing: '.03em' }}>소속 사무소 · 교차분석 종합점수</div>
                    {officesByDivision[d.division].map((o, i) => {
                      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
                      const isSel = selected && selected.division === o.division && selected.office === o.office;
                      return (
                        <button key={o.office} onClick={() => setSelected(o)}
                          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                                   padding: '5px 8px', marginBottom: 2, border: 'none', borderRadius: 6, cursor: 'pointer',
                                   background: isSel ? '#1A3A6B' : (i < 3 ? '#FFFBEB' : '#F9FAFB'), color: isSel ? '#fff' : '#1F2937', textAlign: 'left' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, minWidth: 0 }}>
                            <span style={{ width: 18, textAlign: 'center', fontWeight: 700, fontSize: i < 3 ? 13 : 11, color: isSel ? '#fff' : '#9CA3AF' }}>{medal}</span>
                            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.office}{o.manager ? ` · ${o.manager}` : ''}</span>
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: isSel ? '#fff' : (o.score >= 0.6 ? C.good : o.score <= 0.4 ? C.bad : '#374151') }}>
                            {o.score != null ? (o.score * 100).toFixed(0) + '점' : '-'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 선택 안 됨 안내 */}
      {!selected && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#9CA3AF', fontSize: 13 }}>
          위에서 사무소를 선택하면 해당 사무소의 전 과제 종합 카드가 표시됩니다.
        </div>
      )}

      {/* 360도 카드 */}
      {selected && orgData && (
        <>
          {/* 조직 헤더 + 종합 요약 */}
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 18, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>{selected.bucket === 'hospital' ? '병원본부' : '로컬본부'}{selected.division ? ` · ${selected.division}` : ''}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#111' }}>{selected.office}</div>
                {selected.manager && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>소장 {selected.manager}</div>}
              </div>
              {summary?.avg != null && (
                <div style={{ textAlign: 'center', background: '#F9FAFB', borderRadius: 10, padding: '10px 18px' }}>
                  <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 700 }}>종합 점수 (백분위 평균)</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: summary.avg >= 0.6 ? C.good : summary.avg <= 0.4 ? C.bad : '#374151' }}>
                    {(summary.avg * 100).toFixed(0)}<span style={{ fontSize: 14, color: '#9CA3AF' }}>점</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>{summary.taskCount}개 과제 종합</div>
                </div>
              )}
            </div>

            {/* 강점 / 약점 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10, marginTop: 14 }}>
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.good, marginBottom: 6 }}>💪 강점 (본부 내 상위 30%)</div>
                {summary.strengths.length ? summary.strengths.map(d => (
                  <div key={d.taskId} style={{ fontSize: 12, marginBottom: 2 }}>
                    {d.label.split('(')[0].trim()} · {d.primary.label} <strong>{fmtMetric(d.primary, d.metrics.find(m => m.primary)?.value)}</strong> <span style={{ color: C.good }}>(상위 {(100 - d.primaryPct * 100).toFixed(0)}%)</span>
                  </div>
                )) : <div style={{ fontSize: 11, color: '#9CA3AF' }}>두드러진 강점 과제 없음</div>}
              </div>
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.bad, marginBottom: 6 }}>⚠️ 보완 필요 (본부 내 하위 30%)</div>
                {summary.weaknesses.length ? summary.weaknesses.map(d => (
                  <div key={d.taskId} style={{ fontSize: 12, marginBottom: 2 }}>
                    {d.label.split('(')[0].trim()} · {d.primary.label} <strong>{fmtMetric(d.primary, d.metrics.find(m => m.primary)?.value)}</strong> <span style={{ color: C.bad }}>(하위 {(d.primaryPct * 100).toFixed(0)}%)</span>
                  </div>
                )) : <div style={{ fontSize: 11, color: '#9CA3AF' }}>두드러진 약점 과제 없음</div>}
              </div>
            </div>
          </div>

          {/* 과제별 상세 카드 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {orgData.map(d => (
              <div key={d.taskId} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>{d.label.split('(')[0].trim()}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {d.primaryPct != null && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: d.primaryPct >= 0.7 ? C.good : d.primaryPct <= 0.3 ? C.bad : '#6B7280', background: d.primaryPct >= 0.7 ? '#F0FDF4' : d.primaryPct <= 0.3 ? '#FEF2F2' : '#F3F4F6', padding: '2px 8px', borderRadius: 10 }}>
                        {d.primaryPct >= 0.5 ? `상위 ${(100 - d.primaryPct * 100).toFixed(0)}%` : `하위 ${(d.primaryPct * 100).toFixed(0)}%`}
                      </span>
                    )}
                    {d.grade && (
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: gradeColor(d.grade), padding: '2px 9px', borderRadius: 10 }}>{fmtGrade(d.grade)}</span>
                    )}
                  </div>
                </div>
                {d.metrics.map(m => (
                  <div key={m.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderTop: '1px solid #F3F4F6' }}>
                    <span style={{ fontSize: 11.5, color: '#6B7280' }}>{m.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Sparkline values={m.trend} goodHigh={m.goodHigh} width={64} height={20} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1F2937', minWidth: 60, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtMetric(m, m.value)}</span>
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 9.5, color: '#9CA3AF', marginTop: 6, textAlign: 'right' }}>
                  추세: {d.periods.map(periodShort).join(' → ')}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, fontSize: 10, color: '#9CA3AF' }}>
            ※ 백분위는 같은 본부 내 사무소들 간 상대 순위입니다. 스파크라인은 1~3월 추세 (초록=개선, 빨강=악화). 데이터는 인사이트 캐시 기준이며 갱신은 build-insights 실행 시 반영됩니다.
          </div>
        </>
      )}
    </div>
  );
}
