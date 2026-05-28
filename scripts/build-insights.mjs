// 인사이트 리포트 빌드 스크립트 (PC에서 실행)
// 사용법:
//   node scripts/build-insights.mjs                           — 팩트만 갱신
//   node scripts/build-insights.mjs <ANTHROPIC_API_KEY>       — 팩트 + AI 제언 갱신
//
// 동작: Firestore 대시보드 데이터를 과제별 핵심 지표 위주로 정리 → 캐시 저장
// 산출물: dashboards/insight_facts, dashboards/insight_report

const ANTHROPIC_KEY = process.argv[2] || '';
const FB_PROJECT = 'etc-dashboard-4937f';
const FB_APIKEY = 'AIzaSyD-RVnR3HbEioQ1kBkQOXSIohkyKzBpWHE';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';
const START_PNUM = 2601; // 26년 01월부터 누적

// ============= Firestore REST =============
function fsVal(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsVal) } };
  if (typeof v === 'object') return { mapValue: { fields: fsFields(v) } };
  return { stringValue: String(v) };
}
function fsFields(o) { const f = {}; for (const k of Object.keys(o)) f[k] = fsVal(o[k]); return f; }
function fsToVal(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if (v.arrayValue) return (v.arrayValue.values || []).map(fsToVal);
  if (v.mapValue) { const o = {}; const f = v.mapValue.fields || {}; for (const k in f) o[k] = fsToVal(f[k]); return o; }
  return null;
}
function fsDoc(doc) { if (!doc?.fields) return null; const o = {}; for (const k in doc.fields) o[k] = fsToVal(doc.fields[k]); return o; }

async function loadDoc(docId) {
  const url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/dashboards/${docId}?key=${FB_APIKEY}`;
  const r = await fetch(url);
  if (r.status === 404) return null;
  if (!r.ok) { const t = await r.text(); throw new Error(`GET ${docId} 실패 (${r.status}): ${t.slice(0,200)}`); }
  return fsDoc(await r.json());
}
async function saveDoc(docId, obj) {
  const url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/dashboards/${docId}?key=${FB_APIKEY}`;
  const r = await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fields: fsFields(obj) }) });
  if (!r.ok) { const t = await r.text(); throw new Error(`PATCH ${docId} 실패 (${r.status}): ${t.slice(0,200)}`); }
}

// ============= 공통 =============
const periodNum = p => { const m = String(p).match(/(\d{2})년\s*0?(\d{1,2})월/); return m ? Number(m[1])*100 + Number(m[2]) : 0; };
const round = (n, d=4) => n == null || isNaN(n) ? null : Math.round(n*Math.pow(10,d))/Math.pow(10,d);
const num = v => v == null || isNaN(v) ? null : Number(v);
const last = arr => arr.length ? arr[arr.length-1] : null;
const pctTxt = v => v == null ? '-' : (v*100).toFixed(1)+'%';
const moneyTxt = v => { if (v == null) return '-'; const a = Math.abs(v); if (a >= 1e8) return (v/1e8).toFixed(1)+'억'; if (a >= 1e6) return (v/1e6).toFixed(1)+'백만'; return Math.round(v).toLocaleString(); };

function recentPeriods(history) {
  return Object.keys(history || {}).filter(p => periodNum(p) >= START_PNUM).sort((a,b) => periodNum(a) - periodNum(b));
}

// ============= 과제별 추출 =============

// MBO: 일치율/오차율 핵심 + 수립금액/약속율 보조
function extractMBO(doc, bucket) {
  if (!doc) return null;
  const periods = recentPeriods(doc.history);
  const series = {};
  for (const p of periods) {
    const h = doc.history[p]; if (!h) continue;
    series[p] = {
      total: {
        mbo: round(h.total?.mbo, 2), commit: round(h.total?.commit, 2),
        mainRate: round(h.total?.mainRate, 4), confirmRate: round(h.total?.confirmRate, 4),
        matchRate: round(h.total?.matchRate, 4), errorRate: round(h.total?.errorRate, 4),
        finalGrade: h.total?.finalGrade || null, matchGrade: h.total?.matchGrade || null,
      },
      divisions: (h.divisions || []).map(d => ({
        name: d.name || '', manager: d.manager || '',
        mbo: round(d.mbo, 2), commit: round(d.commit, 2),
        mainRate: round(d.mainRate, 4), matchRate: round(d.matchRate, 4), errorRate: round(d.errorRate, 4),
        finalGrade: d.finalGrade || null,
      })),
      offices: (h.offices || []).map(o => ({
        division: o.division || '', office: o.office || '', manager: o.manager || '',
        mbo: round(o.mbo, 2), commit: round(o.commit, 2),
        mainRate: round(o.mainRate, 4), matchRate: round(o.matchRate, 4), errorRate: round(o.errorRate, 4),
        finalGrade: o.finalGrade || null, matchGrade: o.matchGrade || null,
      })),
    };
  }
  return { id:`mbo_${bucket}`, kind:'mbo', bucket, label:`MBO시스템 (${bucket==='hospital'?'병원':'로컬'})`, periods, series };
}

// 풀동도: 약속 인당 평균, 확인율, 일치율
function extractPuldongdo(doc, bucket) {
  if (!doc) return null;
  const periods = recentPeriods(doc.history);
  const series = {};
  for (const p of periods) {
    const h = doc.history[p]; if (!h) continue;
    series[p] = {
      total: {
        evalCount: num(h.total?.evalCount),
        commitRate: round(h.total?.commitRate, 4),
        confirmRate: round(h.total?.confirmRate, 4),
        matchRate: round(h.total?.matchRate, 4),
        commitPerHead: round(h.total?.commitPerHead ?? h.total?.commit_per_head, 2),
        finalGrade: h.total?.finalGrade || null,
      },
      offices: (h.offices || []).map(o => ({
        division: o.division || '', office: o.office || '', manager: o.manager || '',
        evalCount: num(o.evalCount),
        commitRate: round(o.commitRate, 4),
        confirmRate: round(o.confirmRate, 4),
        matchRate: round(o.matchRate, 4),
        commitPerHead: round(o.commitPerHead ?? o.commit_per_head, 2),
        finalGrade: o.finalGrade || null,
      })),
    };
  }
  return { id:`puldongdo_${bucket}`, kind:'puldongdo', bucket, label:`풀동도 (${bucket==='hospital'?'병원':'로컬'})`, periods, series };
}

// 110대병원
function extract110(doc) {
  if (!doc) return null;
  const periods = recentPeriods(doc.history);
  const series = {};
  for (const p of periods) {
    const h = doc.history[p]; if (!h) continue;
    series[p] = {
      total: {
        total_target: num(h.total?.total_target),
        mbo_rate: round(h.total?.mbo_rate, 4),
        result_sangjeong_rate: round(h.total?.result_sangjeong_rate, 4),
        result_pass_rate: round(h.total?.result_pass_rate, 4),
        result_coding_rate: round(h.total?.result_coding_rate, 4),
        grade_final: h.total?.grade_final || null,
      },
      divisions: (h.divisions || []).map(d => ({
        name: d.name || '', manager: d.manager || '',
        total_target: num(d.total_target),
        mbo_rate: round(d.mbo_rate, 4),
        result_sangjeong_rate: round(d.result_sangjeong_rate, 4),
        result_pass_rate: round(d.result_pass_rate, 4),
        result_coding_rate: round(d.result_coding_rate, 4),
        grade_final: d.grade_final || null,
      })),
      offices: (h.offices || []).map(o => ({
        division: o.division || '', office: o.office || '', manager: o.manager || '',
        hosp_count: num(o.hosp_count),
        total_target: num(o.total_target),
        mbo_rate: round(o.mbo_rate, 4),
        result_sangjeong_rate: round(o.result_sangjeong_rate, 4),
        result_pass_rate: round(o.result_pass_rate, 4),
        result_coding_rate: round(o.result_coding_rate, 4),
        grade_final: o.grade_final || null,
      })),
    };
  }
  return { id:'hospital110', kind:'h110', label:'110대병원 신규품목', periods, series };
}

// 2차병원
function extract2nd(doc) {
  if (!doc) return null;
  const periods = recentPeriods(doc.history);
  const series = {};
  for (const p of periods) {
    const h = doc.history[p]; if (!h) continue;
    series[p] = {
      total: {
        trade_rate: round(h.total?.trade_rate, 4),
        gj_rate: round(h.total?.gj_rate, 4),
        hosp_rate: round(h.total?.hosp_rate, 4),
        sales_mil: round(h.total?.sales_mil, 2),
        growth_rate: round(h.total?.growth_rate, 4),
        grade_final: h.total?.grade_final || null,
      },
      divisions: (h.divisions || []).map(d => ({
        name: d.name || '', manager: d.manager || '',
        trade_rate: round(d.trade_rate, 4), sales_mil: round(d.sales_mil, 2),
        growth_rate: round(d.growth_rate, 4), grade_final: d.grade_final || null,
      })),
      offices: (h.offices || []).map(o => ({
        division: o.division || '', office: o.office || '', manager: o.manager || '',
        trade_rate: round(o.trade_rate, 4), sales_mil: round(o.sales_mil, 2),
        growth_rate: round(o.growth_rate, 4), grade_final: o.grade_final || null,
      })),
    };
  }
  return { id:'hospital2nd', kind:'h2nd', label:'2차병원 관리', periods, series };
}

// 고객단계
function extractCustomerStage(doc, bucket) {
  if (!doc) return null;
  const periods = recentPeriods(doc.history);
  const series = {};
  for (const p of periods) {
    const h = doc.history[p]; if (!h) continue;
    series[p] = {
      total: {
        to: num(h.total?.to), custTotal: num(h.total?.custTotal),
        curCount: num(h.total?.curCount), curPer: round(h.total?.curPer, 2),
        chgCount: num(h.total?.chgCount), grade: h.total?.grade || null,
      },
      offices: (h.offices || []).map(o => ({
        division: o.division || '', office: o.office || '', manager: o.manager || '',
        to: num(o.to), curCount: num(o.curCount), curPer: round(o.curPer, 2),
        chgCount: num(o.chgCount), grade: o.grade || null,
      })),
    };
  }
  return { id:`customer_stage_${bucket}`, kind:'cs', bucket, label:`고객단계 (${bucket==='hospital'?'병원':'로컬'})`, periods, series };
}

// SOP — 월별 성공자 명단만
function extractSOP(doc) {
  if (!doc) return null;
  const periods = recentPeriods(doc.history);
  const series = {};
  for (const p of periods) {
    const h = doc.history[p]; if (!h) continue;
    const sops = h.sopRows || [];
    const success = sops.filter(r => (r.result||'').includes('성공')).map(r => ({
      gen: r.gen || '', type: r.type || '', division: r.division || '', office: r.office || '',
      name: r.name || '', topic: r.topic || '',
    }));
    series[p] = {
      total: sops.length,
      successCount: success.length,
      successList: success,
      fail: sops.filter(r => (r.result||'').includes('미달성')).length,
      review: sops.filter(r => (r.result||'').includes('재평가')).length,
    };
  }
  return { id:'sop', kind:'sop', label:'SOP 리더', periods, series };
}

// 직거래
function extractDirectTrade(doc, bucket) {
  if (!doc) return null;
  const periods = recentPeriods(doc.history);
  const series = {};
  for (const p of periods) {
    const h = doc.history[p]; if (!h) continue;
    series[p] = {
      total: {
        baseAmount: num(h.total?.baseAmount), salesAmount: num(h.total?.salesAmount),
        achieveRate: round(h.total?.achieveRate, 4), activeRate: round(h.total?.activeRate, 4),
        grade: h.total?.grade || null,
      },
      divisions: (h.divisions || []).map(d => ({
        name: d.division || d.name || '', manager: d.manager || '',
        baseAmount: num(d.baseAmount), salesAmount: num(d.salesAmount),
        achieveRate: round(d.achieveRate, 4), activeRate: round(d.activeRate, 4),
        grade: d.grade || null,
      })),
      offices: (h.offices || []).map(o => ({
        division: o.division || '', office: o.office || '', manager: o.manager || '',
        baseAmount: num(o.baseAmount), salesAmount: num(o.salesAmount),
        achieveRate: round(o.achieveRate, 4), activeRate: round(o.activeRate, 4),
        grade: o.grade || null,
      })),
    };
  }
  return { id:`direct_trade_${bucket}`, kind:'direct', bucket, label:`직거래 (${bucket==='hospital'?'병원':'로컬'})`, periods, series };
}

// 신제품 — 사무소별 종합 달성률
function extractShinjepum(doc, bucket) {
  if (!doc) return null;
  const periods = recentPeriods(doc.history);
  const series = {};
  for (const p of periods) {
    const h = doc.history[p]; if (!h) continue;
    series[p] = {
      total: { achieved: num(h.total?.achieved), target: num(h.total?.target), rate: round(h.total?.rate, 4), grade: h.total?.grade || null },
      offices: (h.offices || []).map(o => ({
        division: o.division || '', office: o.office || '', manager: o.manager || '',
        achieved: num(o.achieved), target: num(o.target), rate: round(o.rate, 4), grade: o.grade || null,
      })),
    };
  }
  return { id:`shinjepum_${bucket}`, kind:'shinjepum', bucket, label:`신제품 (${bucket==='hospital'?'병원':'로컬'})`, periods, series };
}

// 실적 — 두 가지 저장 형태 모두 지원
//  (A) 슬림 인덱스 + 월별 분리 문서:  doc.periods=[], 별도 `{taskId}__{period}` 문서
//  (B) 구형 단일 문서:               doc.history = { '26년 01월': {total, offices, divisions, ...}, ... }
async function extractPerformance(taskId, bucket) {
  const idx = await loadDoc(taskId);
  if (!idx) return null;

  // 형태 B: history 직접 사용
  const useHistory = !idx.periods && idx.history;
  // periods 결정: 인덱스의 periods 또는 history 키 (START_PNUM 이상)
  const allPeriods = (idx.periods?.length ? idx.periods : Object.keys(idx.history || {}))
    .filter(p => periodNum(p) >= START_PNUM)
    .sort((a,b) => periodNum(a) - periodNum(b));

  const series = {};
  for (const p of allPeriods) {
    let heavy = null;
    if (useHistory) {
      heavy = idx.history[p];
    } else {
      heavy = await loadDoc(`${taskId}__${p.replace(/\s/g,'')}`);
    }
    if (!heavy) continue;
    series[p] = {
      total: {
        sales: round(heavy.total?.sales, 0), base: round(heavy.total?.base, 0),
        growth: round(heavy.total?.growth, 0), growthRate: round(heavy.total?.growthRate, 4),
      },
      divisions: (heavy.divisions || []).map(d => ({
        name: d.name || '',
        sales: round(d.sales, 0), base: round(d.base, 0),
        growth: round(d.growth, 0), growthRate: round(d.growthRate, 4),
      })),
      offices: (heavy.offices || []).map(o => ({
        division: o.division || '', office: o.office || '',
        sales: round(o.sales, 0), base: round(o.base, 0),
        growth: round(o.growth, 0), growthRate: round(o.growthRate, 4),
      })),
    };
  }
  return { id: taskId, kind:'perf', bucket, label:`실적 (${bucket==='hospital'?'병원':'로컬'})`, periods: allPeriods, series };
}

// ============= 특수 단위 정규화 =============
// 프로트랙(병원본부) / MS(로컬본부) — 사업부로 들어오지만 실제론 사무소로 취급
const SPECIAL_OFFICES = ['프로트랙', 'MS'];
const isSpecialOffice = name => SPECIAL_OFFICES.some(s => (name || '').trim() === s);

function normalizeSpecial(task) {
  if (!task?.series) return task;
  for (const p of task.periods) {
    const s = task.series[p]; if (!s) continue;
    // 사업부 리스트에서 프로트랙/MS는 제거하고 사무소로 이동
    if (Array.isArray(s.divisions)) {
      const keep = [], moved = [];
      for (const d of s.divisions) {
        if (isSpecialOffice(d.name)) moved.push(d); else keep.push(d);
      }
      s.divisions = keep;
      if (!Array.isArray(s.offices)) s.offices = [];
      for (const m of moved) {
        // 사업부 행을 사무소 행으로 변환 (division 비움, office = 이름)
        s.offices.push({ ...m, division: '', office: m.name, manager: m.manager || '' });
      }
    }
    // 사무소 리스트에서 division이 프로트랙/MS인 경우 → division 비움 (독립 사무소)
    if (Array.isArray(s.offices)) {
      s.offices = s.offices.map(o => isSpecialOffice(o.division) ? { ...o, division: '' } : o);
    }
  }
  return task;
}

// ============= 요약 텍스트 =============
function summarizeTask(t) {
  if (!t?.periods?.length) return null;
  const latest = last(t.periods);
  const cur = t.series[latest];
  if (!cur) return null;
  const L = [];

  if (t.kind === 'mbo') {
    L.push(`- 본부: 수립 ${cur.total.mbo||0}억 / 약속 ${cur.total.commit||0}억 / 일치율 ${pctTxt(cur.total.matchRate)} / 오차율 ${pctTxt(cur.total.errorRate)}`);
    const topMatch = [...(cur.offices||[])].filter(o=>o.matchRate!=null).sort((a,b)=>b.matchRate-a.matchRate).slice(0,3);
    const lowMatch = [...(cur.offices||[])].filter(o=>o.matchRate!=null).sort((a,b)=>a.matchRate-b.matchRate).slice(0,3);
    L.push(`- 일치율 상위: ${topMatch.map(o=>`${o.office}(${pctTxt(o.matchRate)})`).join(', ')}`);
    L.push(`- 일치율 하위: ${lowMatch.map(o=>`${o.office}(${pctTxt(o.matchRate)})`).join(', ')}`);
  } else if (t.kind === 'puldongdo') {
    L.push(`- 본부: 인당 약속 ${cur.total.commitPerHead?.toFixed(1) || '-'} / 확인율 ${pctTxt(cur.total.confirmRate)} / 일치율 ${pctTxt(cur.total.matchRate)}`);
    const top = [...(cur.offices||[])].filter(o=>o.confirmRate!=null).sort((a,b)=>b.confirmRate-a.confirmRate).slice(0,3);
    L.push(`- 확인율 상위: ${top.map(o=>`${o.office}(${pctTxt(o.confirmRate)})`).join(', ')}`);
  } else if (t.kind === 'h110') {
    L.push(`- 본부 통과율 ${pctTxt(cur.total.result_pass_rate)} / 상정율 ${pctTxt(cur.total.result_sangjeong_rate)} / MBO수립율 ${pctTxt(cur.total.mbo_rate)}`);
    const top = [...(cur.offices||[])].filter(o=>o.result_pass_rate!=null).sort((a,b)=>b.result_pass_rate-a.result_pass_rate).slice(0,3);
    L.push(`- 통과율 상위 사무소: ${top.map(o=>`${o.office}(${pctTxt(o.result_pass_rate)})`).join(', ')}`);
  } else if (t.kind === 'h2nd') {
    L.push(`- 본부 거래율 ${pctTxt(cur.total.trade_rate)} / 성장률 ${pctTxt(cur.total.growth_rate)} / 매출 ${cur.total.sales_mil||0}백만`);
    const top = [...(cur.offices||[])].filter(o=>o.growth_rate!=null).sort((a,b)=>b.growth_rate-a.growth_rate).slice(0,3);
    L.push(`- 성장률 상위: ${top.map(o=>`${o.office}(${pctTxt(o.growth_rate)})`).join(', ')}`);
  } else if (t.kind === 'cs') {
    L.push(`- 본부 4단계↑ ${cur.total.curCount}명 / 인당 ${cur.total.curPer?.toFixed(1)||'-'} / 변화 ${cur.total.chgCount||0}명`);
    const top = [...(cur.offices||[])].filter(o=>o.chgCount!=null).sort((a,b)=>b.chgCount-a.chgCount).slice(0,3);
    L.push(`- 단계상승 상위: ${top.map(o=>`${o.office}(+${o.chgCount}명)`).join(', ')}`);
  } else if (t.kind === 'sop') {
    L.push(`- ${latest}: 성공 ${cur.successCount}명 / 미달성 ${cur.fail} / 재평가 ${cur.review}`);
    L.push(`- 성공자: ${cur.successList.slice(0,8).map(r=>`${r.office} ${r.name}(${r.topic})`).join(', ')}`);
  } else if (t.kind === 'direct') {
    L.push(`- 본부 달성률 ${pctTxt(cur.total.achieveRate)} / 가동률 ${pctTxt(cur.total.activeRate)} / 매출 ${moneyTxt(cur.total.salesAmount)}`);
    const top = [...(cur.offices||[])].filter(o=>o.achieveRate!=null).sort((a,b)=>b.achieveRate-a.achieveRate).slice(0,3);
    L.push(`- 달성률 상위: ${top.map(o=>`${o.office}(${pctTxt(o.achieveRate)})`).join(', ')}`);
  } else if (t.kind === 'shinjepum') {
    L.push(`- 본부 달성률 ${pctTxt(cur.total.rate)} / 처수 ${cur.total.achieved}/${cur.total.target}`);
    const top = [...(cur.offices||[])].filter(o=>o.rate!=null).sort((a,b)=>b.rate-a.rate).slice(0,3);
    L.push(`- 달성률 상위: ${top.map(o=>`${o.office}(${pctTxt(o.rate)})`).join(', ')}`);
  } else if (t.kind === 'perf') {
    L.push(`- 본부 성장률 ${pctTxt(cur.total.growthRate)} / 성장금액 ${moneyTxt(cur.total.growth)} / 매출 ${moneyTxt(cur.total.sales)}`);
    const top = [...(cur.offices||[])].filter(o=>o.growthRate!=null).sort((a,b)=>b.growthRate-a.growthRate).slice(0,5);
    L.push(`- 성장률 TOP5: ${top.map(o=>`${o.office}(${pctTxt(o.growthRate)})`).join(', ')}`);
  }

  return L.join('\n');
}

// ============= 이름 정규화 (AI 입력 전용) =============
// "서울1사업부" → "서울1", "병원강원사무소" → "병원강원", "병원본부" → "병원본부"(본부 유지)
function stripSuffix(name) {
  if (!name) return name;
  return String(name).replace(/사업부$/, '').replace(/사무소$/, '').trim();
}
// 프로트랙·MS는 AI 분석 대상에서 완전 제외
function isExcludedOffice(o) {
  const off = (o.office || '').trim();
  const div = (o.division || '').trim();
  return SPECIAL_OFFICES.includes(off) || SPECIAL_OFFICES.includes(div);
}

// ============= AI 입력 데이터 빌더 =============
// 사무소별 1~3월 전체 트렌드 데이터 (AI가 분석할 수 있도록 풍부하게)
function trendLines(task, getter, fmt) {
  const officeMap = {};
  for (const p of task.periods) {
    for (const o of task.series[p]?.offices || []) {
      if (isExcludedOffice(o)) continue;
      const k = `${o.division}::${o.office}`;
      if (!officeMap[k]) officeMap[k] = { division: o.division, office: o.office, values: {} };
      officeMap[k].values[p] = getter(o);
    }
  }
  return Object.values(officeMap).map(o => {
    const trend = task.periods.map(p => fmt(o.values[p])).join('/');
    const div = stripSuffix(o.division), off = stripSuffix(o.office);
    return `- ${div ? div + '/' : ''}${off}: ${trend}`;
  });
}

function divisionTrend(task, getter, fmt) {
  const divMap = {};
  for (const p of task.periods) {
    for (const d of task.series[p]?.divisions || []) {
      const k = d.name || d.division;
      if (SPECIAL_OFFICES.includes((k || '').trim())) continue;
      if (!divMap[k]) divMap[k] = { name: k, values: {} };
      divMap[k].values[p] = getter(d);
    }
  }
  return Object.values(divMap).map(d => {
    const trend = task.periods.map(p => fmt(d.values[p])).join('/');
    return `- ${stripSuffix(d.name)}: ${trend}`;
  });
}

// 교차분석용: 사무소별 백분위 점수 (bucket 별로 산출)
function buildCrossScores(facts, bucket) {
  const latest = facts.latestPeriod;
  const officeScores = {}; // key → { division, office, contribs: [{task, pct}] }
  const taskCandidates = facts.tasks.filter(t => {
    if (t.kind === 'sop') return false;
    if (!t.bucket) return bucket === 'hospital'; // 110/2차는 병원본부 전용
    return t.bucket === bucket;
  });
  for (const t of taskCandidates) {
    const cur = t.series[latest]; if (!cur?.offices) continue;
    // 프로트랙·MS는 점수 산출에서 제외
    const filteredOffices = cur.offices.filter(o => !isExcludedOffice(o));
    const getRate = o => {
      if (t.kind === 'mbo') return o.matchRate;
      if (t.kind === 'puldongdo') return o.confirmRate;
      if (t.kind === 'h110') return o.result_pass_rate;
      if (t.kind === 'h2nd') return o.growth_rate;
      if (t.kind === 'cs') return o.curPer;
      if (t.kind === 'direct') return o.achieveRate;
      if (t.kind === 'shinjepum') return o.rate;
      if (t.kind === 'perf') return o.growthRate;
      return null;
    };
    const rates = filteredOffices.map(getRate).filter(v => v != null).sort((a,b) => a-b);
    if (rates.length < 3) continue;
    const pctOf = r => {
      if (r == null) return null;
      const idx = rates.findIndex(x => x >= r);
      return idx === -1 ? 1 : idx / Math.max(1, rates.length - 1);
    };
    for (const o of filteredOffices) {
      const r = getRate(o); if (r == null) continue;
      const k = `${o.division}::${o.office}`;
      if (!officeScores[k]) officeScores[k] = { division: o.division, office: o.office, contribs: [] };
      officeScores[k].contribs.push({ task: t.label, pct: round(pctOf(r), 3) });
    }
  }
  // 사업부별 평균
  const divScores = {};
  const offResult = Object.values(officeScores).map(o => {
    const avg = o.contribs.length ? o.contribs.reduce((s,c) => s+c.pct, 0) / o.contribs.length : 0;
    return { ...o, avg: round(avg, 3), taskCount: o.contribs.length };
  }).filter(o => o.taskCount >= 2);

  offResult.forEach(o => {
    if (!divScores[o.division]) divScores[o.division] = { name: o.division, scores: [] };
    divScores[o.division].scores.push(o.avg);
  });
  const divs = Object.values(divScores).map(d => ({
    name: d.name,
    avg: round(d.scores.reduce((s,v) => s+v, 0) / d.scores.length, 3),
    count: d.scores.length,
  })).sort((a,b) => b.avg - a.avg);

  const topOffices = [...offResult].sort((a,b) => b.avg - a.avg).slice(0, 8);
  const botOffices = [...offResult].sort((a,b) => a.avg - b.avg).slice(0, 8);
  return { divisions: divs, topOffices, botOffices };
}

// ============= AI 제언 =============
async function genAI(facts) {
  if (!ANTHROPIC_KEY) return null;

  const crossH = buildCrossScores(facts, 'hospital');
  const crossL = buildCrossScores(facts, 'local');

  // 과제별 트렌드 텍스트 빌드
  const tasksByKind = (kind, bucket) => facts.tasks.filter(t => t.kind === kind && (bucket ? t.bucket === bucket : true));
  const taskByKindBucket = (kind, bucket) => tasksByKind(kind, bucket)[0] || null;

  const sections = [];

  // 교차분석 입력 (이름 정리)
  const crossInput = (cross, bucketLabel) => {
    const L = [`[${bucketLabel} 사업부별 평균 점수 (백분위 0~100)]`];
    cross.divisions.forEach(d => L.push(`- ${stripSuffix(d.name)}: ${(d.avg*100).toFixed(0)}점 (${d.count}개 사무소)`));
    L.push(`\n[${bucketLabel} 사무소 종합 TOP 8]`);
    cross.topOffices.forEach(o => {
      L.push(`- ${stripSuffix(o.division)}/${stripSuffix(o.office)}: ${(o.avg*100).toFixed(0)}점 (${o.taskCount}과제 평가)`);
    });
    L.push(`\n[${bucketLabel} 사무소 종합 BOTTOM 8]`);
    cross.botOffices.forEach(o => {
      L.push(`- ${stripSuffix(o.division)}/${stripSuffix(o.office)}: ${(o.avg*100).toFixed(0)}점`);
    });
    return L.join('\n');
  };

  const perfTrend = (bucket, bucketLabel) => {
    const t = taskByKindBucket('perf', bucket); if (!t) return '';
    const L = [`[${bucketLabel} 실적 — 본부 월별]`];
    t.periods.forEach(p => {
      const v = t.series[p]?.total;
      L.push(`- ${p}: 매출 ${moneyTxt(v?.sales)}, 성장금액 ${moneyTxt(v?.growth)}, 성장률 ${pctTxt(v?.growthRate)}`);
    });
    L.push(`\n[${bucketLabel} 실적 — 사무소별 월별 성장률]`);
    L.push(...trendLines(t, o => o.growthRate, v => pctTxt(v)));
    L.push(`\n[${bucketLabel} 실적 — 사무소별 월별 성장금액]`);
    L.push(...trendLines(t, o => o.growth, v => moneyTxt(v)));
    return L.join('\n');
  };

  const mboTrend = (bucket, bucketLabel) => {
    const t = taskByKindBucket('mbo', bucket); if (!t) return '';
    const L = [`[${bucketLabel} MBO — 본부 월별 일치율/오차율]`];
    t.periods.forEach(p => {
      const v = t.series[p]?.total;
      L.push(`- ${p}: 일치율 ${pctTxt(v?.matchRate)}, 오차율 ${pctTxt(v?.errorRate)}, 수립 ${num(v?.mbo,1)}억`);
    });
    L.push(`\n[${bucketLabel} MBO — 사무소별 월별 일치율]`);
    L.push(...trendLines(t, o => o.matchRate, v => pctTxt(v)));
    L.push(`\n[${bucketLabel} MBO — 사무소별 월별 오차율]`);
    L.push(...trendLines(t, o => o.errorRate, v => pctTxt(v)));
    return L.join('\n');
  };

  const puldongdoTrend = (bucket, bucketLabel) => {
    const t = taskByKindBucket('puldongdo', bucket); if (!t) return '';
    const L = [`[${bucketLabel} 풀동도 — 본부 월별]`];
    t.periods.forEach(p => {
      const v = t.series[p]?.total;
      L.push(`- ${p}: 인당약속 ${num(v?.commitPerHead,1)}, 확인율 ${pctTxt(v?.confirmRate)}, 일치율 ${pctTxt(v?.matchRate)}`);
    });
    L.push(`\n[${bucketLabel} 풀동도 — 사무소별 월별 인당약속/확인율/일치율]`);
    const offMap = {};
    t.periods.forEach(p => (t.series[p]?.offices || []).forEach(o => {
      if (isExcludedOffice(o)) return;
      const k = `${o.division}::${o.office}`;
      if (!offMap[k]) offMap[k] = { division: o.division, office: o.office, byP: {} };
      offMap[k].byP[p] = o;
    }));
    Object.values(offMap).forEach(o => {
      const trend = t.periods.map(p => {
        const v = o.byP[p]; if (!v) return '-';
        return `${num(v.commitPerHead,1)}/${pctTxt(v.confirmRate)}/${pctTxt(v.matchRate)}`;
      }).join(' | ');
      const div = stripSuffix(o.division), off = stripSuffix(o.office);
      L.push(`- ${div ? div + '/' : ''}${off}: ${trend}`);
    });
    return L.join('\n');
  };

  const h110Trend = () => {
    const t = taskByKindBucket('h110'); if (!t) return '';
    const L = [`[병원본부 110대병원 — 본부 월별]`];
    t.periods.forEach(p => {
      const v = t.series[p]?.total;
      L.push(`- ${p}: MBO수립율 ${pctTxt(v?.mbo_rate)}, 상정율 ${pctTxt(v?.result_sangjeong_rate)}, 통과율 ${pctTxt(v?.result_pass_rate)}`);
    });
    L.push(`\n[병원본부 110대 — 사업부별 통과율 트렌드]`);
    L.push(...divisionTrend(t, d => d.result_pass_rate, v => pctTxt(v)));
    L.push(`\n[병원본부 110대 — 사무소별 통과율 트렌드]`);
    L.push(...trendLines(t, o => o.result_pass_rate, v => pctTxt(v)));
    L.push(`\n[병원본부 110대 — 사무소별 상정율 트렌드]`);
    L.push(...trendLines(t, o => o.result_sangjeong_rate, v => pctTxt(v)));
    return L.join('\n');
  };

  const h2ndTrend = () => {
    const t = taskByKindBucket('h2nd'); if (!t) return '';
    const L = [`[병원본부 2차병원 — 본부 월별]`];
    t.periods.forEach(p => {
      const v = t.series[p]?.total;
      L.push(`- ${p}: 거래율 ${pctTxt(v?.trade_rate)}, 성장률 ${pctTxt(v?.growth_rate)}, 매출 ${num(v?.sales_mil,0)}백만`);
    });
    L.push(`\n[병원본부 2차병원 — 사업부별 성장률 트렌드]`);
    L.push(...divisionTrend(t, d => d.growth_rate, v => pctTxt(v)));
    L.push(`\n[병원본부 2차병원 — 사무소별 성장률 트렌드]`);
    L.push(...trendLines(t, o => o.growth_rate, v => pctTxt(v)));
    L.push(`\n[병원본부 2차병원 — 사무소별 거래율 트렌드]`);
    L.push(...trendLines(t, o => o.trade_rate, v => pctTxt(v)));
    return L.join('\n');
  };

  const csTrend = (bucket, bucketLabel) => {
    const t = taskByKindBucket('cs', bucket); if (!t) return '';
    const L = [`[${bucketLabel} 고객단계 — 본부 월별]`];
    t.periods.forEach(p => {
      const v = t.series[p]?.total;
      L.push(`- ${p}: 4단계↑ ${v?.curCount}명, 인당 ${num(v?.curPer,1)}, 상승 ${v?.chgCount}명`);
    });
    L.push(`\n[${bucketLabel} 고객단계 — 사무소별 4단계↑/인당/상승 (월별)]`);
    const offMap = {};
    t.periods.forEach(p => (t.series[p]?.offices || []).forEach(o => {
      if (isExcludedOffice(o)) return;
      const k = `${o.division}::${o.office}`;
      if (!offMap[k]) offMap[k] = { division: o.division, office: o.office, byP: {} };
      offMap[k].byP[p] = o;
    }));
    Object.values(offMap).forEach(o => {
      const trend = t.periods.map(p => {
        const v = o.byP[p]; if (!v) return '-';
        return `${v.curCount}명/인당${num(v.curPer,1)}/+${v.chgCount}`;
      }).join(' | ');
      const div = stripSuffix(o.division), off = stripSuffix(o.office);
      L.push(`- ${div ? div + '/' : ''}${off}: ${trend}`);
    });
    return L.join('\n');
  };

  const directTrend = (bucket, bucketLabel) => {
    const t = taskByKindBucket('direct', bucket); if (!t) return '';
    const L = [`[${bucketLabel} 직거래 — 본부 월별]`];
    t.periods.forEach(p => {
      const v = t.series[p]?.total;
      L.push(`- ${p}: 기준점 ${moneyTxt(v?.baseAmount)}, 매출 ${moneyTxt(v?.salesAmount)}, 달성률 ${pctTxt(v?.achieveRate)}, 가동률 ${pctTxt(v?.activeRate)}`);
    });
    L.push(`\n[${bucketLabel} 직거래 — 사업부별 달성률 트렌드]`);
    L.push(...divisionTrend(t, d => d.achieveRate, v => pctTxt(v)));
    L.push(`\n[${bucketLabel} 직거래 — 사무소별 달성률/가동률 (월별)]`);
    const offMap = {};
    t.periods.forEach(p => (t.series[p]?.offices || []).forEach(o => {
      if (isExcludedOffice(o)) return;
      const k = `${o.division}::${o.office}`;
      if (!offMap[k]) offMap[k] = { division: o.division, office: o.office, byP: {} };
      offMap[k].byP[p] = o;
    }));
    Object.values(offMap).forEach(o => {
      const trend = t.periods.map(p => {
        const v = o.byP[p]; if (!v) return '-';
        return `${pctTxt(v.achieveRate)}/${pctTxt(v.activeRate)}`;
      }).join(' | ');
      const div = stripSuffix(o.division), off = stripSuffix(o.office);
      L.push(`- ${div ? div + '/' : ''}${off}: ${trend}`);
    });
    return L.join('\n');
  };

  const shinjepumTrend = (bucket, bucketLabel) => {
    const t = taskByKindBucket('shinjepum', bucket); if (!t) return '';
    const L = [`[${bucketLabel} 신제품 — 본부 월별 달성률]`];
    t.periods.forEach(p => L.push(`- ${p}: 달성률 ${pctTxt(t.series[p]?.total?.rate)} (${t.series[p]?.total?.achieved}/${t.series[p]?.total?.target})`));
    L.push(`\n[${bucketLabel} 신제품 — 사무소별 달성률 트렌드]`);
    L.push(...trendLines(t, o => o.rate, v => pctTxt(v)));
    return L.join('\n');
  };

  // SOP 요약
  const sopText = (() => {
    const t = tasksByKind('sop')[0]; if (!t) return '';
    const L = ['[SOP 월별 성공자]'];
    t.periods.forEach(p => {
      const s = t.series[p];
      const names = (s.successList || []).map(r => `${stripSuffix(r.office)} ${r.name}(${r.topic})`).join(', ') || '없음';
      L.push(`- ${p}: ${names}`);
    });
    return L.join('\n');
  })();

  const dataBlock = [
    '## 교차분석 입력',
    crossInput(crossH, '병원본부'),
    '',
    crossInput(crossL, '로컬본부'),
    '',
    '## 실적 트렌드',
    perfTrend('hospital', '병원본부'),
    '',
    perfTrend('local', '로컬본부'),
    '',
    '## MBO',
    mboTrend('hospital', '병원본부'),
    '',
    mboTrend('local', '로컬본부'),
    '',
    '## 풀동도',
    puldongdoTrend('hospital', '병원본부'),
    '',
    puldongdoTrend('local', '로컬본부'),
    '',
    '## 110대병원/2차병원 (병원본부 전용)',
    h110Trend(),
    '',
    h2ndTrend(),
    '',
    '## 고객단계',
    csTrend('hospital', '병원본부'),
    '',
    csTrend('local', '로컬본부'),
    '',
    '## SOP',
    sopText,
    '',
    '## 직거래',
    directTrend('hospital', '병원본부'),
    '',
    directTrend('local', '로컬본부'),
    '',
    '## 신제품',
    shinjepumTrend('hospital', '병원본부'),
    '',
    shinjepumTrend('local', '로컬본부'),
  ].join('\n');

  const prompt = `당신은 영업기획팀 임원에게 보고하는 데이터 분석가입니다. 아래 26년 1월~3월 누적 트렌드 데이터를 보고, 영업부에 대한 인사이트 분석 리포트를 작성하세요.

## 절대 규칙
1. **본부 절대 맞비교 금지**: 병원본부와 로컬본부는 영업 대상(병원 vs 로컬약국)이 다르기 때문에 매출·실적 규모 자체가 다릅니다. **두 본부를 동일 선상에서 절대 비교하지 마세요.** "병원본부가 로컬본부보다 ~", "두 본부 모두 ~", "로컬 대비 병원이 ~" 같은 표현 금지. 각 본부는 그 본부 안의 사무소·사업부끼리만 비교하세요.
2. **조직 구조**: 병원본부 산하 사업부 = 서울1, 서울2, 지방1, 지방2. 로컬본부 산하 사업부 = 서울3, 서울4, 지방3, 지방4. 각 사업부 산하에 사무소들이 소속.
3. **명칭 간소화**: 사업부명에 "사업부"를 붙이지 마세요. ❌"서울2사업부", "서울2본부" → ✅"서울2". 사무소명에 "사무소"도 붙이지 마세요. ❌"병원강원사무소" → ✅"병원강원". 본부 호칭은 "병원본부", "로컬본부"만 사용.
4. **프로트랙·MS 완전 제외**: 병원본부의 '프로트랙'과 로컬본부의 'MS'는 조직 특성상 별도로 보는 조직이므로 **AI 제언 본문 어디에도 언급하지 마세요.** 분석 대상에서 완전히 제외하고, 사무소명/사업부명 어느 곳에도 등장시키지 마세요. (이미 데이터에서도 제외했지만 만약 보이더라도 무시할 것)
5. **트렌드 중심 분석**: 단순 1개월(3월) 스냅샷이 아니라 1월→2월→3월 추세를 보고 분석하세요.
6. **상대 비교**: "상대적으로 잘하는", "상대적으로 못하는" 형식으로 사무소를 호명하세요.
7. **예측 포함**: "26년 하반기에도 이 패턴이라면 어디가 지속 성과를 낼지, 어디는 지속 저조할 것으로 예측되는지" AI다운 예측을 담으세요.
8. **데이터에 있는 사실만**: 추측 금지, 사무소명/사업부명/수치는 정확히 인용.
9. **금지 표현**: "이번 달 영업전략 보고", "어디에 집중", "AI 지휘 제언", "데이터 미제공", "데이터 부재", "분석 불가" 같은 문구 절대 사용 금지. 데이터가 한 줄이라도 있으면 그 데이터로 분석하세요. 자연스러운 분석체로 쓰세요.
10. **분량 강조**: 1번 교차분석과 2번 실적 트렌드 섹션은 각 본부당 10~14문장으로 충분히 풍부하게 작성하세요. 나머지 섹션은 본부당 5~8문장.

## 출력 구조 (반드시 이 순서, 이 제목, 이 구성으로)

\`\`\`
## 1. 교차분석 (26년 3월 기준)

### 병원본부
[사업부별 종합 우수/저조, 사무소별 종합 우수/저조 — 점수 인용하며 분석]

### 로컬본부
[동일 패턴]

## 2. 실적 트렌드 (26.01~03)

### 병원본부
[성장률/성장금액 트렌드, 누가 잘하고 어떤 사무소가 기대되는지, 평균 대비 뒤쳐지는 사무소]

### 로컬본부
[동일 패턴]

## 3. MBO시스템 (26.01~03)

### 병원본부
[사무소별 일치율/오차율 관리 잘하는 곳, 못하는 곳]

### 로컬본부
[동일 패턴]

## 4. 풀동도 (26.01~03)

### 병원본부
[사무소별 인당약속/확인율/일치율 트렌드, 잘하는/못하는 사무소]

### 로컬본부
[동일 패턴]

## 5. 110대병원·2차병원 (병원본부)
[1~3월 트렌드 기준 사업부별 우수/저조, 사무소별 상대적으로 잘하는 곳 분석]

## 6. 고객단계 (26.01~03)

### 병원본부
[4단계↑ 고객수, 인당 평균, 단계상승 변화 — 1~3월 비교 트렌드. 기대되는 사무소 vs 보완 필요한 사무소]

### 로컬본부
[동일 패턴]

## 7. SOP
[월별 성공자만 한 줄로 명단 나열]

## 8. 직거래 (26.01~03)

### 병원본부
[사업부별 우수, 사무소별 1~3월 달성률·가동률 트렌드. 지속 성과 낼 사무소 vs 보완 필요 사무소 예측]

### 로컬본부
[동일 패턴]

## 9. 신제품 (26.01~03)

### 병원본부
[사무소별 달성률 트렌드. 잘하는 사무소 vs 보완 필요 사무소]

### 로컬본부
[동일 패턴]
\`\`\`

## 톤
- 보고서 작성하는 분석가의 객관적 어조
- 1번 교차분석·2번 실적트렌드: 본부당 10~14문장 (장문)
- 3~9번: 본부당 5~8문장
- 한국어, 전체 약 5500~6500자
- 마지막에 결론/총평 같은 거 붙이지 말고 9번 섹션으로 끝내세요.

## 데이터
${dataBlock}`;

  console.log('  Claude API 호출 중 (' + ANTHROPIC_MODEL + ')...');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 10000, messages: [{ role:'user', content: prompt }] }),
  });
  const j = await r.json();
  if (!r.ok) { console.error('  Claude API 오류:', j); return null; }
  return (j.content || []).filter(b=>b.type==='text').map(b=>b.text).join('\n').trim();
}

// ============= 메인 =============
(async () => {
  const t0 = Date.now();
  console.log('\n📊 인사이트 빌드 (v2: 과제별 맞춤)...\n');

  console.log('1) Firestore 로드');
  const ids = ['mbo_hospital','mbo_local','puldongdo_hospital','puldongdo_local','hospital110','hospital2nd','customer_stage_hospital','customer_stage_local','sop','direct_trade_hospital','direct_trade_local','shinjepum_hospital','shinjepum_local'];
  const raw = {};
  for (const id of ids) {
    raw[id] = await loadDoc(id);
    console.log(`   ${id}${raw[id] ? ' ✓' : ' (없음)'}`);
  }
  console.log('   실적 인덱스 + 월별...');
  const perfL = await extractPerformance('performance_local', 'local');
  const perfH = await extractPerformance('performance_hospital', 'hospital');

  console.log('\n2) 과제별 추출');
  const tasks = [
    extractMBO(raw.mbo_hospital, 'hospital'),
    extractMBO(raw.mbo_local, 'local'),
    extractPuldongdo(raw.puldongdo_hospital, 'hospital'),
    extractPuldongdo(raw.puldongdo_local, 'local'),
    extract110(raw.hospital110),
    extract2nd(raw.hospital2nd),
    extractCustomerStage(raw.customer_stage_hospital, 'hospital'),
    extractCustomerStage(raw.customer_stage_local, 'local'),
    extractSOP(raw.sop),
    extractDirectTrade(raw.direct_trade_hospital, 'hospital'),
    extractDirectTrade(raw.direct_trade_local, 'local'),
    extractShinjepum(raw.shinjepum_hospital, 'hospital'),
    extractShinjepum(raw.shinjepum_local, 'local'),
    perfL, perfH,
  ].filter(Boolean);

  // 프로트랙/MS를 사무소로 재분류
  tasks.forEach(normalizeSpecial);

  for (const t of tasks) t.summary = summarizeTask(t);

  // 실적 데이터 디버그 출력
  if (perfH) console.log(`   실적(병원) periods: [${perfH.periods.join(', ')}] · 사무소 수(latest): ${perfH.series[last(perfH.periods)]?.offices?.length || 0}`);
  else console.log('   ⚠ 실적(병원) 문서 없음 — Firestore에 performance_hospital 인덱스 부재');
  if (perfL) console.log(`   실적(로컬) periods: [${perfL.periods.join(', ')}] · 사무소 수(latest): ${perfL.series[last(perfL.periods)]?.offices?.length || 0}`);

  const periodVotes = {};
  for (const t of tasks) { const p = last(t.periods); if (p) periodVotes[p] = (periodVotes[p]||0)+1; }
  const latestPeriod = Object.entries(periodVotes).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
  console.log(`   ${tasks.length}개 과제 추출 완료 (latest: ${latestPeriod})`);

  // 교차분석 데이터 (차트용)
  const crossH = buildCrossScores({ tasks, latestPeriod }, 'hospital');
  const crossL = buildCrossScores({ tasks, latestPeriod }, 'local');
  const crossAnalysis = {
    hospital: { top5: crossH.topOffices.slice(0,5), bot5: crossH.botOffices.slice(0,5), divisions: crossH.divisions },
    local:    { top5: crossL.topOffices.slice(0,5), bot5: crossL.botOffices.slice(0,5), divisions: crossL.divisions },
  };

  const facts = { updatedAt: new Date().toISOString(), latestPeriod, startPeriod: '26년 01월', tasks, crossAnalysis };

  console.log('\n3) AI 제언');
  let aiText = null;
  if (ANTHROPIC_KEY) {
    aiText = await genAI(facts);
    if (aiText) console.log(`   ✓ 생성 (${aiText.length}자)`);
    else console.log('   ⚠ 스킵');
  } else {
    console.log('   (키 미제공 → 스킵)');
  }

  console.log('\n4) Firestore 저장');
  await saveDoc('insight_facts', facts);
  console.log('   ✓ insight_facts');
  if (aiText) {
    await saveDoc('insight_report', { updatedAt: new Date().toISOString(), latestPeriod, text: aiText });
    console.log('   ✓ insight_report');
  }

  console.log(`\n🎉 완료 (${((Date.now()-t0)/1000).toFixed(1)}초)\n대시보드 → 인사이트 리포트에서 확인하세요.\n`);
})().catch(err => {
  console.error('\n❌ 오류:', err.message, '\n', err.stack);
  process.exit(1);
});
