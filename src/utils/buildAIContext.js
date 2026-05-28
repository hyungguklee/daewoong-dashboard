// AI 채팅용 컨텍스트 빌더 (v2)
// 캐시된 insight_facts(과제별 시계열) + insight_report(AI 제언)를 읽어 직렬화
import { loadDashboard } from './firebase';

const pct = (v, d=1) => v == null ? '-' : (v*100).toFixed(d)+'%';
const num = (v, d=1) => v == null ? '-' : Number(v).toFixed(d);
const money = v => { if (v == null) return '-'; const a = Math.abs(v); if (a >= 1e8) return (v/1e8).toFixed(1)+'억'; if (a >= 1e6) return (v/1e6).toFixed(1)+'백만'; return Math.round(v).toLocaleString(); };
const last = arr => arr.length ? arr[arr.length-1] : null;

function fmtMBO(t) {
  const latest = last(t.periods); const cur = t.series[latest]; if (!cur) return '';
  let s = `\n### ${t.label} (${latest})\n`;
  s += `[본부] 수립 ${num(cur.total.mbo,1)}억 · 약속 ${num(cur.total.commit,1)}억 · 약속율 ${pct(cur.total.mainRate)} · 일치율 ${pct(cur.total.matchRate)} · 오차율 ${pct(cur.total.errorRate)} · 등급 ${cur.total.finalGrade||'-'}\n`;
  if (cur.divisions?.length) {
    s += `[사업부] ` + cur.divisions.map(d => `${d.name}: 수립 ${num(d.mbo,1)}억/일치 ${pct(d.matchRate)}/오차 ${pct(d.errorRate)}/등급 ${d.finalGrade||'-'}`).join(' | ') + '\n';
  }
  if (cur.offices?.length) {
    s += `[사무소 전체 ${cur.offices.length}개]\n`;
    cur.offices.forEach(o => {
      s += `- ${o.division}/${o.office}(${o.manager||''}): 수립 ${num(o.mbo,1)}억 · 약속율 ${pct(o.mainRate)} · 일치율 ${pct(o.matchRate)} · 오차율 ${pct(o.errorRate)} · 등급 ${o.finalGrade||'-'}\n`;
    });
  }
  return s;
}

function fmtPuldongdo(t) {
  const latest = last(t.periods); const cur = t.series[latest]; if (!cur) return '';
  let s = `\n### ${t.label} (${latest})\n`;
  s += `[본부] 평가인원 ${cur.total.evalCount||'-'} · 인당약속 ${num(cur.total.commitPerHead,1)} · 확인율 ${pct(cur.total.confirmRate)} · 일치율 ${pct(cur.total.matchRate)} · 등급 ${cur.total.finalGrade||'-'}\n`;
  if (cur.offices?.length) {
    s += `[사무소]\n`;
    cur.offices.forEach(o => {
      s += `- ${o.division}/${o.office}: 인원 ${o.evalCount||'-'} · 인당약속 ${num(o.commitPerHead,1)} · 확인율 ${pct(o.confirmRate)} · 일치율 ${pct(o.matchRate)} · 등급 ${o.finalGrade||'-'}\n`;
    });
  }
  return s;
}

function fmt110(t) {
  const latest = last(t.periods); const cur = t.series[latest]; if (!cur) return '';
  let s = `\n### ${t.label} (${latest})\n`;
  s += `[본부] MBO수립율 ${pct(cur.total.mbo_rate)} · 상정율 ${pct(cur.total.result_sangjeong_rate)} · 통과율 ${pct(cur.total.result_pass_rate)} · 코딩완료율 ${pct(cur.total.result_coding_rate)} · 목표 ${cur.total.total_target||'-'}처 · 등급 ${cur.total.grade_final||'-'}\n`;
  if (cur.divisions?.length) {
    s += `[사업부]\n` + cur.divisions.map(d =>
      `- ${d.name}: 목표 ${d.total_target}처/MBO ${pct(d.mbo_rate)}/상정 ${pct(d.result_sangjeong_rate)}/통과 ${pct(d.result_pass_rate)}/등급 ${d.grade_final||'-'}`
    ).join('\n') + '\n';
  }
  if (cur.offices?.length) {
    s += `[사무소]\n`;
    cur.offices.forEach(o => {
      s += `- ${o.division}/${o.office}(${o.manager||''}): 병원 ${o.hosp_count||'-'}개 · 목표 ${o.total_target||'-'}처 · MBO ${pct(o.mbo_rate)} · 상정 ${pct(o.result_sangjeong_rate)} · 통과 ${pct(o.result_pass_rate)} · 코딩 ${pct(o.result_coding_rate)} · 등급 ${o.grade_final||'-'}\n`;
    });
  }
  s += `\n[참고] 110대병원 대시보드에는 사무소별 신약 실적금액(매출) 데이터가 없습니다. 처수·통과율로 답변하세요.\n`;
  return s;
}

function fmt2nd(t) {
  const latest = last(t.periods); const cur = t.series[latest]; if (!cur) return '';
  let s = `\n### ${t.label} (${latest})\n`;
  s += `[본부] 거래율 ${pct(cur.total.trade_rate)} · 거점율 ${pct(cur.total.gj_rate)} · 병원율 ${pct(cur.total.hosp_rate)} · 매출 ${num(cur.total.sales_mil,0)}백만 · 성장률 ${pct(cur.total.growth_rate)} · 등급 ${cur.total.grade_final||'-'}\n`;
  if (cur.divisions?.length) {
    s += `[사업부]\n` + cur.divisions.map(d =>
      `- ${d.name}: 거래율 ${pct(d.trade_rate)}/매출 ${num(d.sales_mil,0)}백만/성장률 ${pct(d.growth_rate)}/등급 ${d.grade_final||'-'}`
    ).join('\n') + '\n';
  }
  if (cur.offices?.length) {
    s += `[사무소]\n`;
    cur.offices.forEach(o => {
      s += `- ${o.division}/${o.office}(${o.manager||''}): 거래율 ${pct(o.trade_rate)} · 매출 ${num(o.sales_mil,0)}백만 · 성장률 ${pct(o.growth_rate)} · 등급 ${o.grade_final||'-'}\n`;
    });
  }
  return s;
}

function fmtCS(t) {
  const latest = last(t.periods); const cur = t.series[latest]; if (!cur) return '';
  let s = `\n### ${t.label} (${latest})\n`;
  s += `[본부] T.O ${cur.total.to||'-'} · 총고객 ${cur.total.custTotal||'-'} · 4단계↑ ${cur.total.curCount}명(인당 ${num(cur.total.curPer,1)}) · 단계상승 ${cur.total.chgCount}명 · 등급 ${cur.total.grade||'-'}\n`;
  if (cur.offices?.length) {
    s += `[사무소]\n`;
    cur.offices.forEach(o => {
      s += `- ${o.division}/${o.office}: T.O ${o.to||'-'} · 4단계↑ ${o.curCount||0}명 · 인당 ${num(o.curPer,1)} · 상승 ${o.chgCount||0}명 · 등급 ${o.grade||'-'}\n`;
    });
  }
  return s;
}

function fmtSOP(t) {
  let s = `\n### SOP 리더 (월별 성공자)\n`;
  t.periods.slice().reverse().forEach(p => {
    const cur = t.series[p];
    s += `\n[${p}] 전체 ${cur.total} · 성공 ${cur.successCount} · 미달성 ${cur.fail} · 재평가 ${cur.review}\n`;
    if (cur.successList?.length) {
      cur.successList.forEach(r => {
        s += `- ${r.gen} ${r.type} ${r.division}/${r.office} ${r.name}: ${r.topic}\n`;
      });
    }
  });
  return s;
}

function fmtDirect(t) {
  const latest = last(t.periods); const cur = t.series[latest]; if (!cur) return '';
  let s = `\n### ${t.label} (${latest})\n`;
  s += `[본부] 기준점 ${money(cur.total.baseAmount)} · 매출 ${money(cur.total.salesAmount)} · 달성률 ${pct(cur.total.achieveRate)} · 가동률 ${pct(cur.total.activeRate)} · 등급 ${cur.total.grade||'-'}\n`;

  // 월별 추이 (전체)
  if (t.periods.length >= 2) {
    s += `[월별 추이]\n`;
    t.periods.forEach(p => {
      const v = t.series[p]?.total; if (!v) return;
      s += `- ${p}: 달성률 ${pct(v.achieveRate)} · 가동률 ${pct(v.activeRate)} · 매출 ${money(v.salesAmount)}\n`;
    });
  }

  if (cur.offices?.length) {
    s += `[사무소]\n`;
    cur.offices.forEach(o => {
      s += `- ${o.division}/${o.office}(${o.manager||''}): 기준 ${money(o.baseAmount)} · 매출 ${money(o.salesAmount)} · 달성 ${pct(o.achieveRate)} · 가동 ${pct(o.activeRate)} · 등급 ${o.grade||'-'}\n`;
    });
  }
  return s;
}

function fmtShinjepum(t) {
  const latest = last(t.periods); const cur = t.series[latest]; if (!cur) return '';
  let s = `\n### ${t.label} (${latest})\n`;
  s += `[본부] 달성 ${cur.total.achieved}/${cur.total.target}처 · 달성률 ${pct(cur.total.rate)} · 등급 ${cur.total.grade||'-'}\n`;
  if (cur.offices?.length) {
    s += `[사무소]\n`;
    cur.offices.forEach(o => {
      s += `- ${o.division}/${o.office}: 달성 ${o.achieved||0}/${o.target||0}처 · 달성률 ${pct(o.rate)} · 등급 ${o.grade||'-'}\n`;
    });
  }
  return s;
}

function fmtPerf(t) {
  let s = `\n### ${t.label}\n`;
  // 월별 본부
  s += `[본부 월별]\n`;
  t.periods.forEach(p => {
    const v = t.series[p]?.total; if (!v) return;
    s += `- ${p}: 매출 ${money(v.sales)} · 기준점 ${money(v.base)} · 성장금액 ${money(v.growth)} · 성장률 ${pct(v.growthRate)}\n`;
  });

  // 사무소별 누적 평균 성장률
  const officeMap = {};
  for (const p of t.periods) {
    for (const o of (t.series[p]?.offices || [])) {
      const k = `${o.division}::${o.office}`;
      if (!officeMap[k]) officeMap[k] = { division: o.division, office: o.office, series: [] };
      if (o.growthRate != null) officeMap[k].series.push({ p, growthRate: o.growthRate, growth: o.growth, sales: o.sales });
    }
  }
  const offList = Object.values(officeMap).map(o => {
    const avg = o.series.length ? o.series.reduce((s,x) => s + x.growthRate, 0) / o.series.length : null;
    return { ...o, avg };
  }).filter(o => o.avg != null).sort((a,b) => b.avg - a.avg);

  s += `\n[사무소 누적 평균 성장률 순위]\n`;
  offList.forEach((o, i) => {
    const recent = o.series.slice(-3).map(x => `${x.p.replace(/26년\s*0?/,'')}=${pct(x.growthRate, 0)}`).join('/');
    s += `- ${i+1}. ${o.division}/${o.office}: 평균 ${pct(o.avg)} · 최근 [${recent}]\n`;
  });
  return s;
}

const FMT = {
  mbo: fmtMBO, puldongdo: fmtPuldongdo, h110: fmt110, h2nd: fmt2nd,
  cs: fmtCS, sop: fmtSOP, direct: fmtDirect, shinjepum: fmtShinjepum, perf: fmtPerf,
};

export async function buildAIContext(period) {
  const [facts, report] = await Promise.all([
    loadDashboard('insight_facts'),
    loadDashboard('insight_report'),
  ]);

  if (!facts) {
    return `⚠ 인사이트 캐시가 없습니다.\n관리자는 PC에서 \`node scripts/build-insights.mjs <ANTHROPIC_API_KEY>\`를 실행해 캐시를 생성해야 합니다.\n(사용자 선택 기간: ${period})`;
  }

  let ctx = '';
  ctx += `# 영업기획팀 평가 인사이트 캐시\n`;
  ctx += `- 빌드 시각: ${facts.updatedAt || '-'}\n`;
  ctx += `- 최신 기준월: ${facts.latestPeriod || '-'} (사용자 선택: ${period})\n`;
  ctx += `- 누적 시작: ${facts.startPeriod || '26년 01월'}\n`;
  ctx += `- 데이터 깊이: 본부·사업부·사무소 단위 (MR 개인/병원별 데이터는 미포함)\n`;

  for (const t of (facts.tasks || [])) {
    const fn = FMT[t.kind];
    if (fn) ctx += fn(t);
  }

  if (report?.text) {
    ctx += '\n## 사전 생성된 AI 지휘 제언\n' + report.text + '\n';
  }

  ctx += `\n---\n주의사항:
- 위 데이터는 사무소 단위까지의 캐시입니다. MR 개인별/병원별 상세 질문에는 "각 과제 대시보드를 직접 확인해 달라"고 안내하세요.
- 110대병원에는 사무소별 신약 실적금액 데이터가 없습니다.
- SOP는 월별 성공 리더 명단만 캐시되어 있습니다 (분신/KPI 등 상세는 SOP 대시보드 참조).
- 답변시 가능하면 구체적인 사무소명·수치를 인용하세요.`;
  return ctx;
}
