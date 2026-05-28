import { useEffect, useState, useMemo } from 'react';
import { loadDashboard } from '../utils/firebase';
import { HBar, Donut, Heatmap, LineChart, Sparkline, KpiCard, C, heatColor } from '../components/InsightCharts';

// ─── 포맷터 ─────────────────────────────────────────────────────
const pct = (v, d=1) => v == null ? '-' : (v * 100).toFixed(d) + '%';
const money = v => { if (v == null) return '-'; const a = Math.abs(v); if (a >= 1e8) return (v/1e8).toFixed(1)+'억'; if (a >= 1e6) return (v/1e6).toFixed(1)+'백만'; return Math.round(v).toLocaleString(); };
const fnum = (v, d=1) => v == null ? '-' : Number(v).toFixed(d);
const periodShort = p => (p || '').replace(/26년\s*/, '').replace(/0(\d월)/, '$1');

const gradeColor = g => {
  if (!g) return '#9CA3AF';
  if (['S','Ap','A'].includes(g)) return '#059669';
  if (['Bp','B'].includes(g)) return '#0EA5E9';
  if (g === 'Cp') return '#F59E0B';
  return '#DC2626';
};

// ─── 섹션 컨테이너 ──────────────────────────────────────────────
function Section({ title, subtitle, icon, children, defaultOpen = true, accent }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, marginBottom: 14, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                 padding: '14px 18px', background: open ? '#FAFAF8' : '#fff', border: 'none', borderBottom: open ? '1px solid #F3F4F6' : 'none', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: accent || '#1A3A6B' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{subtitle}</div>}
          </div>
        </div>
        <span style={{ color: '#9CA3AF', fontSize: 14 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && <div style={{ padding: '16px 18px' }}>{children}</div>}
    </div>
  );
}

// ─── 사무소 라벨 ────────────────────────────────────────────────
const officeLabel = o => o.office || '-';

// ─── 추세 화살표 ───────────────────────────────────────────────
function TrendArrow({ delta, isPercent }) {
  if (delta == null || isNaN(delta)) return null;
  const v = isPercent ? delta * 100 : delta;
  if (Math.abs(v) < 0.01) return <span style={{ color: '#9CA3AF', fontSize: 10 }}> →</span>;
  const up = delta > 0;
  return <span style={{ color: up ? '#059669' : '#DC2626', fontWeight: 700, fontSize: 11, marginLeft: 4 }}>
    {up ? '▲' : '▼'} {Math.abs(v).toFixed(1)}{isPercent ? '%p' : ''}
  </span>;
}

// 본부/사무소 전월대비 계산
function getDelta(task, key, periodIdx = -1) {
  const periods = task.periods;
  if (periods.length < 2) return null;
  const cur = task.series[periods[periods.length - 1]]?.total?.[key];
  const prev = task.series[periods[periods.length - 2]]?.total?.[key];
  if (cur == null || prev == null) return null;
  return cur - prev;
}

// ═══════════════════════════════════════════════════════════════
// 1) MBO 섹션 (일치율/오차율 중심)
// ═══════════════════════════════════════════════════════════════
function MBOSection({ task }) {
  const latest = task.periods[task.periods.length - 1];
  const cur = task.series[latest];
  if (!cur) return null;
  const t = cur.total;

  // 사무소 일치율 상/하위
  const offTop = [...(cur.offices || [])].filter(o => o.matchRate != null).sort((a,b) => b.matchRate - a.matchRate).slice(0, 8);
  const offBot = [...(cur.offices || [])].filter(o => o.matchRate != null).sort((a,b) => a.matchRate - b.matchRate).slice(0, 8);
  const offByError = [...(cur.offices || [])].filter(o => o.errorRate != null).sort((a,b) => b.errorRate - a.errorRate).slice(0, 8);

  // 사업부별 일치율
  const divBars = (cur.divisions || []).filter(d => d.matchRate != null)
    .map(d => ({ label: d.name, value: d.matchRate, color: heatColor(d.matchRate * 1.2) }))
    .sort((a,b) => b.value - a.value);

  return (
    <Section title={task.label} icon="🎯" subtitle={`핵심: 일치율·오차율 / 기준 ${latest}`} accent={C.primary}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
        <KpiCard label="MBO 수립금액" value={fnum(t.mbo, 1)} unit="억" sub={`약속 ${fnum(t.commit, 1)}억`} icon="💰" color={C.primary} />
        <KpiCard label="약속율" value={pct(t.mainRate)} sub={<>본부 평균<TrendArrow delta={getDelta(task, 'mainRate')} isPercent /></>} icon="🤝" color={C.primary} />
        <KpiCard label="일치율" value={pct(t.matchRate)} sub={<>등급 {t.matchGrade || '-'}<TrendArrow delta={getDelta(task, 'matchRate')} isPercent /></>} icon="✅" color={C.good} />
        <KpiCard label="오차율" value={pct(t.errorRate)} sub={<>낮을수록 좋음<TrendArrow delta={getDelta(task, 'errorRate')} isPercent /></>} icon="⚠️" color={C.bad} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {divBars.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>사업부별 일치율</div>
            <HBar data={divBars} valueFmt={v => pct(v)} />
          </div>
        )}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.good, marginBottom: 6 }}>🏆 일치율 상위 사무소 TOP 8</div>
          <HBar data={offTop.map(o => ({ label: officeLabel(o), value: o.matchRate }))} valueFmt={v => pct(v)} color={C.good} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.bad, marginBottom: 6 }}>⚠️ 일치율 하위 사무소 (집중관리)</div>
          <HBar data={offBot.map(o => ({ label: officeLabel(o), value: o.matchRate }))} valueFmt={v => pct(v)} color={C.bad} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.warn, marginBottom: 6 }}>📊 오차율 높은 사무소</div>
          <HBar data={offByError.map(o => ({ label: officeLabel(o), value: o.errorRate }))} valueFmt={v => pct(v)} color={C.warn} />
        </div>
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════
// 2) 풀동도 (인당 약속·확인율·일치율)
// ═══════════════════════════════════════════════════════════════
function PuldongdoSection({ task }) {
  const latest = task.periods[task.periods.length - 1];
  const cur = task.series[latest];
  if (!cur) return null;
  const t = cur.total;

  const offByCommit = [...(cur.offices || [])].filter(o => o.commitPerHead != null).sort((a,b) => b.commitPerHead - a.commitPerHead).slice(0, 8);
  const offByConfirm = [...(cur.offices || [])].filter(o => o.confirmRate != null).sort((a,b) => b.confirmRate - a.confirmRate).slice(0, 8);
  const offByMatch = [...(cur.offices || [])].filter(o => o.matchRate != null).sort((a,b) => a.matchRate - b.matchRate).slice(0, 8);

  return (
    <Section title={task.label} icon="🌊" subtitle={`핵심: 약속 인당평균·확인율·일치율 / 기준 ${latest}`} accent={C.primary}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        <KpiCard label="약속 인당평균" value={fnum(t.commitPerHead, 1)} icon="📋" color={C.primary} />
        <KpiCard label="확인율" value={pct(t.confirmRate)} sub={<TrendArrow delta={getDelta(task,'confirmRate')} isPercent />} icon="✓" color={C.good} />
        <KpiCard label="일치율" value={pct(t.matchRate)} sub={<TrendArrow delta={getDelta(task,'matchRate')} isPercent />} icon="🎯" color={C.primary} />
        <KpiCard label="평가인원" value={t.evalCount || '-'} unit="명" sub={`약속율 ${pct(t.commitRate)}`} icon="👥" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, marginBottom: 6 }}>약속 인당평균 TOP 8</div>
          <HBar data={offByCommit.map(o => ({ label: officeLabel(o), value: o.commitPerHead }))} valueFmt={v => fnum(v, 1)} color={C.primary} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.good, marginBottom: 6 }}>확인율 TOP 8</div>
          <HBar data={offByConfirm.map(o => ({ label: officeLabel(o), value: o.confirmRate }))} valueFmt={v => pct(v)} color={C.good} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.bad, marginBottom: 6 }}>일치율 낮은 사무소 (집중관리)</div>
          <HBar data={offByMatch.map(o => ({ label: officeLabel(o), value: o.matchRate }))} valueFmt={v => pct(v)} color={C.bad} />
        </div>
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════
// 3) 110대병원 (MBO수립율·통과율·상정율)
// ═══════════════════════════════════════════════════════════════
function H110Section({ task }) {
  const latest = task.periods[task.periods.length - 1];
  const cur = task.series[latest];
  if (!cur) return null;
  const t = cur.total;

  const totTargetSum = (cur.offices || []).reduce((s,o) => s + (o.total_target || 0), 0);

  // 사무소 통과율 + 상정율
  const offByPass = [...(cur.offices || [])].filter(o => o.result_pass_rate != null).sort((a,b) => b.result_pass_rate - a.result_pass_rate).slice(0, 10);
  const offBySang = [...(cur.offices || [])].filter(o => o.result_sangjeong_rate != null).sort((a,b) => b.result_sangjeong_rate - a.result_sangjeong_rate).slice(0, 10);

  // 사업부별 통과율
  const divBars = (cur.divisions || []).filter(d => d.result_pass_rate != null)
    .map(d => ({ label: d.name, value: d.result_pass_rate, color: heatColor(d.result_pass_rate) }))
    .sort((a,b) => b.value - a.value);

  // 등급 분포
  const gradeDist = {};
  (cur.offices || []).forEach(o => { const g = o.grade_final || '-'; gradeDist[g] = (gradeDist[g] || 0) + 1; });
  const donutData = Object.entries(gradeDist).map(([g, n]) => ({ label: g, value: n, color: gradeColor(g) })).sort((a,b)=> b.value - a.value);

  return (
    <Section title={task.label} icon="🏥" subtitle={`핵심: MBO수립율·통과율·상정율 / 기준 ${latest}`} accent={C.primary}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        <KpiCard label="MBO 수립율" value={pct(t.mbo_rate)} sub={`총 ${totTargetSum.toLocaleString()}처 목표`} icon="💼" color={C.primary} />
        <KpiCard label="상정 완료율" value={pct(t.result_sangjeong_rate)} sub={<TrendArrow delta={getDelta(task,'result_sangjeong_rate')} isPercent />} icon="📤" color={C.primary} />
        <KpiCard label="통과율" value={pct(t.result_pass_rate)} sub={<TrendArrow delta={getDelta(task,'result_pass_rate')} isPercent />} icon="✅" color={C.good} />
        <KpiCard label="코딩 완료율" value={pct(t.result_coding_rate)} sub={<TrendArrow delta={getDelta(task,'result_coding_rate')} isPercent />} icon="💻" color={C.primary} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {divBars.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>사업부별 통과율</div>
            <HBar data={divBars} valueFmt={v => pct(v)} />
          </div>
        )}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.good, marginBottom: 6 }}>🏆 통과율 TOP 10 사무소</div>
          <HBar data={offByPass.map(o => ({ label: officeLabel(o), value: o.result_pass_rate }))} valueFmt={v => pct(v)} color={C.good} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, marginBottom: 6 }}>📤 상정 완료율 TOP 10</div>
          <HBar data={offBySang.map(o => ({ label: officeLabel(o), value: o.result_sangjeong_rate }))} valueFmt={v => pct(v)} color={C.primary} />
        </div>
        {donutData.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>사무소 최종등급 분포</div>
            <Donut data={donutData} centerValue={cur.offices?.length || 0} centerLabel="사무소" />
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, fontSize: 10, color: '#9CA3AF' }}>
        ※ 110대병원 대시보드에는 사무소별 신약 실적금액(매출) 데이터가 없어 목표처수·통과율·상정율로 대체 표시합니다.
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════
// 4) 2차병원 (거래율·성장률·매출)
// ═══════════════════════════════════════════════════════════════
function H2ndSection({ task }) {
  const latest = task.periods[task.periods.length - 1];
  const cur = task.series[latest];
  if (!cur) return null;
  const t = cur.total;

  const offByTrade = [...(cur.offices || [])].filter(o => o.trade_rate != null).sort((a,b) => b.trade_rate - a.trade_rate).slice(0, 10);
  const offByGrowth = [...(cur.offices || [])].filter(o => o.growth_rate != null).sort((a,b) => b.growth_rate - a.growth_rate).slice(0, 10);
  const offBySales = [...(cur.offices || [])].filter(o => o.sales_mil != null).sort((a,b) => b.sales_mil - a.sales_mil).slice(0, 10);

  const divBars = (cur.divisions || []).filter(d => d.growth_rate != null)
    .map(d => ({ label: d.name, value: d.growth_rate, color: d.growth_rate >= 0 ? C.good : C.bad }))
    .sort((a,b) => b.value - a.value);

  return (
    <Section title={task.label} icon="🏪" subtitle={`핵심: 거래율·성장률·매출 / 기준 ${latest}`} accent={C.primary}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        <KpiCard label="거래율" value={pct(t.trade_rate)} sub={<TrendArrow delta={getDelta(task,'trade_rate')} isPercent />} icon="🤝" color={C.primary} />
        <KpiCard label="성장률" value={pct(t.growth_rate)} sub={<TrendArrow delta={getDelta(task,'growth_rate')} isPercent />} icon="📈" color={t.growth_rate >= 0 ? C.good : C.bad} />
        <KpiCard label="매출" value={fnum(t.sales_mil, 0)} unit="백만" icon="💰" color={C.primary} />
        <KpiCard label="거점율" value={pct(t.gj_rate)} sub={`병원율 ${pct(t.hosp_rate)}`} icon="📍" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {divBars.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>사업부별 성장률</div>
            <HBar data={divBars} valueFmt={v => pct(v)} />
          </div>
        )}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.good, marginBottom: 6 }}>📈 성장률 TOP 10 사무소</div>
          <HBar data={offByGrowth.map(o => ({ label: officeLabel(o), value: o.growth_rate, color: o.growth_rate >= 0 ? C.good : C.bad }))} valueFmt={v => pct(v)} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, marginBottom: 6 }}>🤝 거래율 TOP 10 사무소</div>
          <HBar data={offByTrade.map(o => ({ label: officeLabel(o), value: o.trade_rate }))} valueFmt={v => pct(v)} color={C.primary} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>💰 매출 TOP 10 사무소 (백만)</div>
          <HBar data={offBySales.map(o => ({ label: officeLabel(o), value: o.sales_mil }))} valueFmt={v => fnum(v, 0)} color={C.accent} />
        </div>
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════
// 5) 고객단계 (4단계↑·인당·변화)
// ═══════════════════════════════════════════════════════════════
function CSSection({ task }) {
  const latest = task.periods[task.periods.length - 1];
  const cur = task.series[latest];
  if (!cur) return null;
  const t = cur.total;

  const offByCur = [...(cur.offices || [])].filter(o => o.curCount != null).sort((a,b) => b.curCount - a.curCount).slice(0, 10);
  const offByPer = [...(cur.offices || [])].filter(o => o.curPer != null).sort((a,b) => b.curPer - a.curPer).slice(0, 10);
  const offByChg = [...(cur.offices || [])].filter(o => o.chgCount != null).sort((a,b) => b.chgCount - a.chgCount).slice(0, 10);

  return (
    <Section title={task.label} icon="👤" subtitle={`핵심: 4단계↑ 고객 수·인당·변화 / 기준 ${latest}`} accent={C.primary}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        <KpiCard label="4단계↑ 고객수" value={(t.curCount || 0).toLocaleString()} unit="명" icon="⭐" color={C.primary} />
        <KpiCard label="인당 평균" value={fnum(t.curPer, 1)} unit="명/MR" sub={<TrendArrow delta={getDelta(task,'curPer')} />} icon="👥" color={C.primary} />
        <KpiCard label="이달 단계상승" value={(t.chgCount || 0).toLocaleString()} unit="명" sub="변화" icon="📈" color={C.good} />
        <KpiCard label="T.O / 총고객" value={`${t.to || '-'} / ${(t.custTotal||0).toLocaleString()}`} icon="🗂" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, marginBottom: 6 }}>⭐ 4단계↑ 고객수 TOP 10</div>
          <HBar data={offByCur.map(o => ({ label: officeLabel(o), value: o.curCount }))} valueFmt={v => v.toLocaleString()} color={C.primary} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, marginBottom: 6 }}>👥 인당 평균 TOP 10</div>
          <HBar data={offByPer.map(o => ({ label: officeLabel(o), value: o.curPer }))} valueFmt={v => fnum(v, 1)} color={C.primary} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.good, marginBottom: 6 }}>📈 단계상승 변화량 TOP 10</div>
          <HBar data={offByChg.map(o => ({ label: officeLabel(o), value: o.chgCount }))} valueFmt={v => `+${v}`} color={C.good} />
        </div>
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════
// 6) SOP (월별 성공자 명단)
// ═══════════════════════════════════════════════════════════════
function SOPSection({ task }) {
  const periods = task.periods;
  return (
    <Section title={task.label} icon="🏅" subtitle="월별 성공 리더 명단" accent={C.accent}>
      {periods.length === 0 && <div style={{ fontSize: 11, color: '#9CA3AF' }}>데이터 없음</div>}
      {periods.slice().reverse().map(p => {
        const s = task.series[p];
        return (
          <div key={p} style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px dashed #E5E7EB' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: C.primary }}>{p}</span>
              <span style={{ fontSize: 11, color: '#6B7280' }}>전체 {s.total}건 · 성공 {s.successCount} · 미달성 {s.fail} · 재평가 {s.review}</span>
            </div>
            {s.successList.length === 0 ? (
              <div style={{ fontSize: 11, color: '#9CA3AF', paddingLeft: 8 }}>성공 리더 없음</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
                {s.successList.map((r, i) => (
                  <div key={i} style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 6, padding: '6px 10px', fontSize: 11 }}>
                    <div style={{ fontWeight: 700, color: '#92400E' }}>🏅 {r.name} <span style={{ fontSize: 10, color: '#A16207', fontWeight: 500 }}>({r.gen}, {r.type})</span></div>
                    <div style={{ color: '#78350F', marginTop: 1 }}>{r.office} · {r.topic}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════
// 7) 직거래 (기준점·매출·달성률·가동률, 월별 추이)
// ═══════════════════════════════════════════════════════════════
function DirectSection({ task }) {
  const latest = task.periods[task.periods.length - 1];
  const cur = task.series[latest];
  if (!cur) return null;
  const t = cur.total;

  // 본부 달성률·가동률 시계열
  const hqSeries = [
    { name: '달성률', values: task.periods.map(p => task.series[p]?.total?.achieveRate ?? null) },
    { name: '가동률', values: task.periods.map(p => task.series[p]?.total?.activeRate ?? null) },
  ];

  // 사무소별 달성률 상위
  const offByAchieve = [...(cur.offices || [])].filter(o => o.achieveRate != null).sort((a,b) => b.achieveRate - a.achieveRate).slice(0, 10);
  const offByActive = [...(cur.offices || [])].filter(o => o.activeRate != null).sort((a,b) => b.activeRate - a.activeRate).slice(0, 10);
  const offBySales = [...(cur.offices || [])].filter(o => o.salesAmount != null).sort((a,b) => b.salesAmount - a.salesAmount).slice(0, 10);

  return (
    <Section title={task.label} icon="💵" subtitle={`핵심: 기준점·매출·달성률·가동률 월별추이 / 기준 ${latest}`} accent={C.primary}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        <KpiCard label="기준점" value={money(t.baseAmount)} icon="🎯" color={C.primary} />
        <KpiCard label="매출액" value={money(t.salesAmount)} icon="💰" color={C.primary} />
        <KpiCard label="달성률" value={pct(t.achieveRate)} sub={<TrendArrow delta={getDelta(task,'achieveRate')} isPercent />} icon="📊" color={C.good} />
        <KpiCard label="가동률" value={pct(t.activeRate)} sub={<TrendArrow delta={getDelta(task,'activeRate')} isPercent />} icon="⚙️" color={C.good} />
      </div>

      {task.periods.length >= 2 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>본부 달성률·가동률 월별 추이</div>
          <LineChart series={hqSeries} periods={task.periods} valueFmt={v => pct(v, 0)} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.good, marginBottom: 6 }}>📊 달성률 TOP 10 사무소</div>
          <HBar data={offByAchieve.map(o => ({ label: officeLabel(o), value: o.achieveRate }))} valueFmt={v => pct(v)} color={C.good} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, marginBottom: 6 }}>⚙️ 가동률 TOP 10 사무소</div>
          <HBar data={offByActive.map(o => ({ label: officeLabel(o), value: o.activeRate }))} valueFmt={v => pct(v)} color={C.primary} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 6 }}>💰 매출 TOP 10 사무소</div>
          <HBar data={offBySales.map(o => ({ label: officeLabel(o), value: o.salesAmount }))} valueFmt={v => money(v)} color={C.accent} />
        </div>
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════
// 8) 신제품 (사무소별 종합 달성률)
// ═══════════════════════════════════════════════════════════════
function ShinjepumSection({ task }) {
  const latest = task.periods[task.periods.length - 1];
  const cur = task.series[latest];
  if (!cur) return null;
  const t = cur.total;

  const offByRate = [...(cur.offices || [])].filter(o => o.rate != null).sort((a,b) => b.rate - a.rate);
  const top = offByRate.slice(0, 10);
  const bot = offByRate.slice(-8).reverse();

  // 등급 분포
  const gradeDist = {};
  (cur.offices || []).forEach(o => { const g = o.grade || '-'; gradeDist[g] = (gradeDist[g] || 0) + 1; });
  const donut = Object.entries(gradeDist).map(([g,n]) => ({ label: g, value: n, color: gradeColor(g) })).sort((a,b)=>b.value-a.value);

  return (
    <Section title={task.label} icon="💊" subtitle={`핵심: 사무소별 종합 달성률 / 기준 ${latest}`} accent={C.primary}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        <KpiCard label="저변 달성률" value={pct(t.rate)} sub={<TrendArrow delta={getDelta(task,'rate')} isPercent />} icon="🎯" color={C.good} />
        <KpiCard label="달성 처수" value={(t.achieved||0).toLocaleString()} unit="처" icon="✅" color={C.primary} />
        <KpiCard label="목표 처수" value={(t.target||0).toLocaleString()} unit="처" icon="📋" color={C.primary} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.good, marginBottom: 6 }}>🏆 달성률 TOP 10 사무소</div>
          <HBar data={top.map(o => ({ label: officeLabel(o), value: o.rate }))} valueFmt={v => pct(v)} color={C.good} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.bad, marginBottom: 6 }}>⚠️ 달성률 BOTTOM 8 사무소</div>
          <HBar data={bot.map(o => ({ label: officeLabel(o), value: o.rate }))} valueFmt={v => pct(v)} color={C.bad} />
        </div>
        {donut.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>등급 분포</div>
            <Donut data={donut} centerValue={cur.offices?.length || 0} centerLabel="사무소" />
          </div>
        )}
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════
// 9) 실적 (히트맵 + TOP 라인차트)
// ═══════════════════════════════════════════════════════════════
function PerfSection({ task }) {
  const periods = task.periods;
  if (!periods.length) return null;
  const latest = periods[periods.length - 1];
  const cur = task.series[latest];
  const t = cur?.total;

  // 사무소별 시계열 데이터 (성장률)
  const officeMap = {};
  for (const p of periods) {
    for (const o of task.series[p]?.offices || []) {
      const k = `${o.division}::${o.office}`;
      if (!officeMap[k]) officeMap[k] = { division: o.division, office: o.office, growthByPeriod: {} };
      officeMap[k].growthByPeriod[p] = o.growthRate;
    }
  }
  const officeList = Object.values(officeMap);

  // 누적 평균 성장률 기준 정렬 (TOP/BOTTOM)
  const officeWithAvg = officeList.map(o => {
    const vals = periods.map(p => o.growthByPeriod[p]).filter(v => v != null);
    const avg = vals.length ? vals.reduce((s,v) => s+v, 0) / vals.length : null;
    return { ...o, avgGrowth: avg };
  }).filter(o => o.avgGrowth != null);

  const top15 = [...officeWithAvg].sort((a,b) => b.avgGrowth - a.avgGrowth).slice(0, 15);
  const top5ForLine = top15.slice(0, 5);

  // 히트맵 데이터 (사무소 × 월 = 성장률)
  const heatRows = top15.map(o => ({
    label: o.office,
    division: o.division,
  }));
  const heatGet = (row, col) => officeMap[`${row.division}::${row.label}`]?.growthByPeriod?.[col];

  // 라인차트 데이터 (TOP 5)
  const lineSeries = top5ForLine.map(o => ({
    name: o.office,
    values: periods.map(p => o.growthByPeriod[p] ?? null),
  }));

  return (
    <Section title={task.label} icon={task.bucket === 'hospital' ? '🏥' : '🏪'} subtitle={`핵심: 사업부·사무소 성장률·성장금액 (월별 지속 상승이 중요)`} accent={C.accent}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        <KpiCard label={`${latest} 최종 매출`} value={money(t?.sales)} icon="💰" color={C.primary} />
        <KpiCard label="기준점" value={money(t?.base)} icon="🎯" />
        <KpiCard label="성장금액" value={money(t?.growth)} sub={<TrendArrow delta={(t?.growth ?? 0) - (task.series[periods[periods.length-2]]?.total?.growth ?? 0) || null} />} icon="📈" color={t?.growth >= 0 ? C.good : C.bad} />
        <KpiCard label="성장률" value={pct(t?.growthRate)} sub={<TrendArrow delta={getDelta(task,'growthRate')} isPercent />} icon="📊" color={t?.growthRate >= 0 ? C.good : C.bad} />
      </div>

      {periods.length >= 2 && top5ForLine.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>🏆 누적 평균 성장률 TOP 5 사무소 — 월별 추이</div>
          <LineChart series={lineSeries} periods={periods} valueFmt={v => pct(v, 0)} height={200} />
          <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>※ 라인이 우상향이면 지속 성장 중 · 2월은 영업일수 적어 통상 하락</div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>🔥 사무소 × 월 성장률 히트맵 (TOP 15)</div>
        <Heatmap rows={heatRows} cols={periods} getValue={heatGet} valueFmt={v => v == null ? '-' : (v*100).toFixed(0)+'%'} label="성장률" goodHigh={true} cellSize={42} />
        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>※ 진한 초록 = 성장률 높음 · 진한 빨강 = 성장률 낮음 · 셀에 마우스 올리면 상세 표시</div>
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════
// 교차분석 시각화 (TOP5 + BOTTOM5 × 과제 히트맵)
// ═══════════════════════════════════════════════════════════════
function CrossAnalysisChart({ cross }) {
  if (!cross?.hospital && !cross?.local) return null;

  const renderBucket = (bucketKey, label, color) => {
    const c = cross[bucketKey];
    if (!c || (!c.top5?.length && !c.bot5?.length)) return null;

    // 과제 목록 (전체 contribs에서 추출)
    const taskSet = new Set();
    [...(c.top5 || []), ...(c.bot5 || [])].forEach(o => (o.contribs || []).forEach(c2 => taskSet.add(c2.task)));
    const tasks = Array.from(taskSet);

    // 사업부 점수 막대
    const divBars = (c.divisions || []).map(d => ({ label: d.name, value: d.avg, color: heatColor(d.avg) }));

    // 사무소 종합 점수 막대 (TOP5 + BOTTOM5)
    const top5Bars = (c.top5 || []).map(o => ({ label: o.office || `${o.division}/${o.office}`, value: o.avg, color: C.good }));
    const bot5Bars = (c.bot5 || []).map(o => ({ label: o.office || `${o.division}/${o.office}`, value: o.avg, color: C.bad }));

    // 히트맵 데이터 (TOP5 + BOTTOM5 × 과제)
    const heatOffices = [
      ...(c.top5 || []).map(o => ({ ...o, group: 'TOP' })),
      ...(c.bot5 || []).map(o => ({ ...o, group: 'BOTTOM' })),
    ];
    const heatRows = heatOffices.map(o => ({ label: `${o.group === 'TOP' ? '🏆' : '⚠️'} ${o.office || o.division}` , o }));
    const heatGet = (row, col) => {
      const contrib = (row.o.contribs || []).find(c2 => c2.task === col);
      return contrib ? contrib.pct : null;
    };

    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color, marginBottom: 10 }}>{label}</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 14 }}>
          {divBars.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>사업부 종합 점수</div>
              <HBar data={divBars} valueFmt={v => (v*100).toFixed(0) + '점'} />
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.good, marginBottom: 6 }}>🏆 사무소 TOP 5</div>
            <HBar data={top5Bars} valueFmt={v => (v*100).toFixed(0) + '점'} color={C.good} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.bad, marginBottom: 6 }}>⚠️ 사무소 BOTTOM 5</div>
            <HBar data={bot5Bars} valueFmt={v => (v*100).toFixed(0) + '점'} color={C.bad} />
          </div>
        </div>

        {tasks.length > 0 && heatRows.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>📊 과제별 강약 히트맵 (TOP5 + BOTTOM5)</div>
            <Heatmap
              rows={heatRows}
              cols={tasks}
              getValue={heatGet}
              valueFmt={v => v == null ? '-' : (v*100).toFixed(0)}
              label="백분위 점수"
              goodHigh={true}
              cellSize={50}
            />
            <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>※ 100에 가까울수록 그 과제에서 상대적으로 우수 · 0에 가까울수록 저조</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Section title="교차분석 시각화 근거" icon="🔍" subtitle="AI 제언 교차분석의 점수 근거 — TOP5/BOTTOM5 사무소 × 과제 히트맵" accent={C.primary}>
      {renderBucket('hospital', '🏥 병원본부', C.primary)}
      {renderBucket('local', '🏪 로컬본부', C.primary)}
    </Section>
  );
}

// AI 본문 inline 버전 (Section 래퍼 없이 흰 박스로)
function CrossAnalysisInline({ cross }) {
  if (!cross?.hospital && !cross?.local) return null;

  const renderBucket = (bucketKey, label) => {
    const c = cross[bucketKey];
    if (!c || (!c.top5?.length && !c.bot5?.length)) return null;

    const taskSet = new Set();
    [...(c.top5 || []), ...(c.bot5 || [])].forEach(o => (o.contribs || []).forEach(c2 => taskSet.add(c2.task)));
    const tasks = Array.from(taskSet);

    const divBars = (c.divisions || []).map(d => ({ label: d.name?.replace(/사업부$/,''), value: d.avg, color: heatColor(d.avg) }));
    const top5Bars = (c.top5 || []).map(o => ({ label: (o.office || o.division).replace(/사무소$/,''), value: o.avg, color: C.good }));
    const bot5Bars = (c.bot5 || []).map(o => ({ label: (o.office || o.division).replace(/사무소$/,''), value: o.avg, color: C.bad }));

    const heatOffices = [
      ...(c.top5 || []).map(o => ({ ...o, group: 'TOP' })),
      ...(c.bot5 || []).map(o => ({ ...o, group: 'BOTTOM' })),
    ];
    const heatRows = heatOffices.map(o => ({ label: `${o.group === 'TOP' ? '🏆' : '⚠️'} ${(o.office || o.division).replace(/사무소$/,'')}`, o }));
    const heatGet = (row, col) => {
      const contrib = (row.o.contribs || []).find(c2 => c2.task === col);
      return contrib ? contrib.pct : null;
    };

    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#92400E', marginBottom: 8, paddingLeft: 4 }}>📊 {label} — 시각 근거</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 10 }}>
          {divBars.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', marginBottom: 4 }}>사업부 종합 점수</div>
              <HBar data={divBars} valueFmt={v => (v*100).toFixed(0) + '점'} />
            </div>
          )}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.good, marginBottom: 4 }}>🏆 사무소 TOP 5</div>
            <HBar data={top5Bars} valueFmt={v => (v*100).toFixed(0) + '점'} color={C.good} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.bad, marginBottom: 4 }}>⚠️ 사무소 BOTTOM 5</div>
            <HBar data={bot5Bars} valueFmt={v => (v*100).toFixed(0) + '점'} color={C.bad} />
          </div>
        </div>
        {tasks.length > 0 && heatRows.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', marginBottom: 4 }}>과제별 강약 히트맵 (TOP5 + BOTTOM5)</div>
            <Heatmap rows={heatRows} cols={tasks} getValue={heatGet}
              valueFmt={v => v == null ? '-' : (v*100).toFixed(0)} label="백분위" goodHigh={true} cellSize={46} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #FCD34D', borderRadius: 8, padding: 14, marginTop: 12, marginBottom: 8 }}>
      {renderBucket('hospital', '병원본부')}
      {renderBucket('local', '로컬본부')}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 실적 트렌드 시각화 (병원/로컬 각각 TOP/BOTTOM 사무소)
// ═══════════════════════════════════════════════════════════════
function PerfTrendChart({ facts }) {
  const perfs = (facts.tasks || []).filter(t => t.kind === 'perf');
  if (!perfs.length) return null;

  const renderBucket = (task) => {
    if (!task || !task.periods?.length) return null;
    const periods = task.periods;

    // 사무소별 누적 평균 성장률
    const officeMap = {};
    for (const p of periods) {
      for (const o of task.series[p]?.offices || []) {
        const k = `${o.division}::${o.office}`;
        if (!officeMap[k]) officeMap[k] = { division: o.division, office: o.office, byP: {} };
        officeMap[k].byP[p] = o;
      }
    }
    const officeList = Object.values(officeMap).map(o => {
      const vals = periods.map(p => o.byP[p]?.growthRate).filter(v => v != null);
      const avg = vals.length ? vals.reduce((s,v)=>s+v,0)/vals.length : null;
      return { ...o, avg };
    }).filter(o => o.avg != null);

    const top5 = [...officeList].sort((a,b) => b.avg - a.avg).slice(0, 5);
    const bot5 = [...officeList].sort((a,b) => a.avg - b.avg).slice(0, 5);

    const topBars = top5.map(o => ({ label: o.office || o.division, value: o.avg, color: C.good }));
    const botBars = bot5.map(o => ({ label: o.office || o.division, value: o.avg, color: C.bad }));

    const bucketLabel = task.bucket === 'hospital' ? '🏥 병원본부' : '🏪 로컬본부';

    return (
      <div key={task.id} style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.primary, marginBottom: 10 }}>{bucketLabel} 실적 사무소 진단</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.good, marginBottom: 6 }}>🏆 누적 평균 성장률 TOP 5 (상대적 우수)</div>
            <HBar data={topBars} valueFmt={v => (v*100).toFixed(1) + '%'} color={C.good} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.bad, marginBottom: 6 }}>⚠️ 누적 평균 성장률 BOTTOM 5 (보완 필요)</div>
            <HBar data={botBars} valueFmt={v => (v*100).toFixed(1) + '%'} color={C.bad} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <Section title="실적 트렌드 시각화 근거" icon="📈" subtitle="AI 제언 실적트렌드의 누적 평균 성장률 사무소 순위" accent={C.accent}>
      {perfs.map(renderBucket)}
    </Section>
  );
}

// AI 본문 inline 버전 — 프로트랙/MS 제외, 사무소 이름 정리
function PerfTrendInline({ facts }) {
  const perfs = (facts.tasks || []).filter(t => t.kind === 'perf');
  if (!perfs.length) return null;
  const SPECIAL = ['프로트랙', 'MS'];
  const stripOff = s => (s || '').replace(/사무소$/,'');

  const renderBucket = (task) => {
    if (!task || !task.periods?.length) return null;
    const periods = task.periods;
    const officeMap = {};
    for (const p of periods) {
      for (const o of task.series[p]?.offices || []) {
        if (SPECIAL.includes((o.office||'').trim()) || SPECIAL.includes((o.division||'').trim())) continue;
        const k = `${o.division}::${o.office}`;
        if (!officeMap[k]) officeMap[k] = { division: o.division, office: o.office, byP: {} };
        officeMap[k].byP[p] = o;
      }
    }
    const officeList = Object.values(officeMap).map(o => {
      const vals = periods.map(p => o.byP[p]?.growthRate).filter(v => v != null);
      const avg = vals.length ? vals.reduce((s,v)=>s+v,0)/vals.length : null;
      return { ...o, avg };
    }).filter(o => o.avg != null);

    const top5 = [...officeList].sort((a,b) => b.avg - a.avg).slice(0, 5);
    const bot5 = [...officeList].sort((a,b) => a.avg - b.avg).slice(0, 5);
    const topBars = top5.map(o => ({ label: stripOff(o.office) || stripOff(o.division), value: o.avg, color: C.good }));
    const botBars = bot5.map(o => ({ label: stripOff(o.office) || stripOff(o.division), value: o.avg, color: C.bad }));
    const bucketLabel = task.bucket === 'hospital' ? '병원본부' : '로컬본부';

    return (
      <div key={task.id} style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#92400E', marginBottom: 8, paddingLeft: 4 }}>📈 {bucketLabel} 실적 — 시각 근거</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.good, marginBottom: 4 }}>🏆 누적 평균 성장률 TOP 5</div>
            <HBar data={topBars} valueFmt={v => (v*100).toFixed(1) + '%'} color={C.good} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.bad, marginBottom: 4 }}>⚠️ 누적 평균 성장률 BOTTOM 5</div>
            <HBar data={botBars} valueFmt={v => (v*100).toFixed(1) + '%'} color={C.bad} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #FCD34D', borderRadius: 8, padding: 14, marginTop: 12, marginBottom: 8 }}>
      {perfs.map(renderBucket)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AI 제언 본문 렌더러 — 섹션 1 끝에 교차분석 차트, 섹션 2 끝에 실적 차트 inline 삽입
// ═══════════════════════════════════════════════════════════════
function AIReportBody({ text, facts }) {
  // 라인을 섹션으로 나눔. 섹션 키 = "## N." 의 N
  const lines = text.split('\n');
  const blocks = []; // { sectionNum: number|null, lines: [] }
  let currentNum = null;
  let buf = [];
  const flush = () => {
    if (buf.length) blocks.push({ sectionNum: currentNum, lines: buf });
    buf = [];
  };
  for (const line of lines) {
    const m = line.match(/^##\s*(\d+)\./);
    if (m) {
      flush();
      currentNum = parseInt(m[1], 10);
      buf.push(line);
    } else {
      buf.push(line);
    }
  }
  flush();

  const renderLine = (line, i) => {
    if (/^#\s+(이번\s*달\s*영업전략|AI\s*지휘\s*제언|영업전략\s*보고)/.test(line)) return null;
    if (line.startsWith('## ')) return <div key={i} style={{ fontSize: 15, fontWeight: 800, color: '#92400E', marginTop: 18, marginBottom: 6, paddingBottom: 4, borderBottom: '2px solid #FCD34D' }}>{line.slice(3)}</div>;
    if (line.startsWith('### ')) return <div key={i} style={{ fontSize: 12.5, fontWeight: 700, marginTop: 10, marginBottom: 2, color: '#78350F' }}>{line.slice(4)}</div>;
    if (line.startsWith('# ')) return null;
    if (line.startsWith('- ')) return <div key={i} style={{ marginLeft: 10 }}>• {line.slice(2)}</div>;
    return <div key={i}>{line}</div>;
  };

  return (
    <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: 16, fontSize: 13, lineHeight: 1.8, color: '#1F2937', whiteSpace: 'pre-wrap' }}>
      {blocks.map((b, bi) => (
        <div key={bi}>
          {b.lines.map(renderLine)}
          {b.sectionNum === 1 && facts.crossAnalysis && <CrossAnalysisInline cross={facts.crossAnalysis} />}
          {b.sectionNum === 2 && <PerfTrendInline facts={facts} />}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 메인 화면
// ═══════════════════════════════════════════════════════════════
const TASK_RENDERER = {
  mbo: MBOSection, puldongdo: PuldongdoSection, h110: H110Section, h2nd: H2ndSection,
  cs: CSSection, sop: SOPSection, direct: DirectSection, shinjepum: ShinjepumSection, perf: PerfSection,
};

export default function DashboardInsights() {
  const [facts, setFacts] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all'); // all | hospital | local

  useEffect(() => {
    (async () => {
      try {
        const [f, r] = await Promise.all([loadDashboard('insight_facts'), loadDashboard('insight_report')]);
        setFacts(f); setReport(r);
      } catch (e) { setError(e.message); } finally { setLoading(false); }
    })();
  }, []);

  const filteredTasks = useMemo(() => {
    if (!facts?.tasks) return [];
    return facts.tasks.filter(t => {
      if (tab === 'all') return true;
      if (!t.bucket) return true; // 110/2차/SOP는 공통
      return t.bucket === tab;
    });
  }, [facts, tab]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>로딩 중...</div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#DC2626' }}>오류: {error}</div>;
  if (!facts) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#374151', marginBottom: 8 }}>인사이트 리포트가 아직 없습니다</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>PC에서 아래 명령으로 빌드하세요:</div>
        <code style={{ display: 'inline-block', background: '#F3F4F6', padding: '8px 16px', borderRadius: 6, fontSize: 12 }}>
          node scripts/build-insights.mjs &lt;ANTHROPIC_API_KEY&gt;
        </code>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif" }}>
      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(135deg, #1A3A6B, #2D5A9A)', color: '#fff', padding: '22px 26px', borderRadius: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 10, letterSpacing: '.18em', color: '#FCD34D', fontWeight: 700 }}>INSIGHT REPORT · 영업기획팀</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>📊 인사이트 리포트</h1>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 6 }}>
          기준: <strong>{facts.latestPeriod || '-'}</strong> · 누적 시작: {facts.startPeriod || '26년 01월'} · 과제 {facts.tasks?.length || 0}개 · 갱신 {facts.updatedAt ? new Date(facts.updatedAt).toLocaleString('ko-KR') : '-'}
        </div>
      </div>

      {/* 본부 필터 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[
          { id: 'all', label: '🌐 전체' },
          { id: 'hospital', label: '🏥 병원본부' },
          { id: 'local', label: '🏪 로컬본부' },
        ].map(b => (
          <button key={b.id} onClick={() => setTab(b.id)}
            style={{ padding: '7px 16px', fontSize: 12, fontWeight: 700, borderRadius: 18, border: '1px solid #E5E7EB',
                     background: tab === b.id ? '#1A3A6B' : '#fff', color: tab === b.id ? '#fff' : '#374151', cursor: 'pointer' }}>
            {b.label}
          </button>
        ))}
      </div>

      {/* AI 제언 — 섹션 1·2 뒤에 시각화 inline 삽입 */}
      {report?.text && (
        <Section title="AI 제언" icon="🤖" subtitle={report.updatedAt ? `갱신 ${new Date(report.updatedAt).toLocaleString('ko-KR')}` : null} accent={C.accent}>
          <AIReportBody text={report.text} facts={facts} />
        </Section>
      )}

      {/* 과제별 섹션 */}
      {filteredTasks.map((t, i) => {
        const R = TASK_RENDERER[t.kind];
        if (!R) return null;
        return <R key={t.id} task={t} />;
      })}

      <div style={{ marginTop: 16, padding: 12, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 11, color: '#6B7280' }}>
        ℹ 이 리포트는 PC 스크립트로 미리 계산한 캐시입니다. 갱신: <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>node scripts/build-insights.mjs &lt;ANTHROPIC_API_KEY&gt;</code>
      </div>
    </div>
  );
}
