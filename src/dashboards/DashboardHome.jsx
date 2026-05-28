import { useState, useEffect, useMemo } from 'react';
import { loadDashboard } from '../utils/firebase';
import logoImg from '../assets/logo.png';

// ─── 과제 메타 정의 ───────────────────────────────────────────────────────────
// id: 사이드바 task id와 동일
// firestoreKeys: 로드할 Firestore document 키 (병원/로컬 분리된 경우 2개)
// gradeField: total 객체에서 등급을 꺼낼 키 (과제마다 다름)
// 색상: 좌측 컬러 스트라이프
// singleLabel: single 도큐먼트만 가진 과제의 등급 라벨 ('본부' 대신 '병원' 등)
const TASK_DEFS = [
  { num: '01', id: 'mbo_system',     name: 'MBO시스템',    desc: 'MBO 시스템 평가',     color: '#4F46E5',
    keys: { hospital: 'mbo_hospital', local: 'mbo_local' }, gradeField: 'finalGrade' },
  { num: '02', id: 'pool_dongdo',    name: '풀동도',        desc: '풀동도 평가',          color: '#0891B2',
    keys: { hospital: 'puldongdo_hospital', local: 'puldongdo_local' }, gradeField: 'finalGrade' },
  { num: '03', id: 'hospital110',    name: '110대병원',     desc: '신규품목 현황',        color: '#059669',
    keys: { single: 'hospital110' }, gradeField: 'grade_final', singleLabel: '병원' },
  { num: '04', id: 'hospital2nd',    name: '2차병원',       desc: '관리 현황',           color: '#2563EB',
    keys: { single: 'hospital2nd' }, gradeField: 'grade_final', singleLabel: '병원' },
  { num: '05', id: 'customer_stage', name: '고객단계',      desc: '고객단계 평가',        color: '#1E3A8A',
    keys: { hospital: 'customer_stage_hospital', local: 'customer_stage_local' }, gradeField: 'grade' },
  { num: '06', id: 'sop',            name: 'SOP',          desc: 'SOP 리더 현황',       color: '#B45309',
    keys: { single: 'sop' }, gradeField: null, singleLabel: '본부' },
  { num: '07', id: 'direct_sales',   name: '직거래',        desc: '직거래 평가',          color: '#7C3AED',
    keys: { hospital: 'direct_trade_hospital', local: 'direct_trade_local' }, gradeField: 'grade' },
  { num: '08', id: 'new_product',    name: '신제품',        desc: '신제품 평가',          color: '#BE185D',
    keys: { hospital: 'shinjepum_hospital', local: 'shinjepum_local' }, gradeField: 'grade' },
  { num: '09', id: 'msa',            name: 'MSA',          desc: '준비 중',             color: '#475569',
    keys: {}, gradeField: null },
];

// 기간 "26년 03월" → 숫자 2603 (정렬용)
function periodToNum(p) {
  if (!p) return 0;
  const m = String(p).match(/(\d{2})년\s*(\d{1,2})월/);
  return m ? parseInt(m[1], 10) * 100 + parseInt(m[2], 10) : 0;
}

// 도큐먼트에서 달력상 가장 최근 기간 추출 (top-level period + history 키들 중 최대)
function findLatestPeriod(doc) {
  if (!doc) return null;
  const periods = new Set();
  if (doc.period) periods.add(doc.period);
  Object.keys(doc.history || {}).forEach(p => periods.add(p));
  const arr = Array.from(periods).filter(Boolean);
  arr.sort((a, b) => periodToNum(b) - periodToNum(a));
  return arr[0] || null;
}

// 두 기간 중 더 최근(달력상)
function pickLater(a, b) {
  if (!a) return b;
  if (!b) return a;
  return periodToNum(a) >= periodToNum(b) ? a : b;
}

const GRADE_COLOR = {
  S:  '#059669', Sp: '#059669',
  A:  '#2563EB', Ap: '#2563EB',
  B:  '#F59E0B', Bp: '#F59E0B',
  C:  '#DC2626', Cp: '#DC2626',
};
const gradeLabel = g => g ? g.replace(/p$/, '+') : null;

// 기간 비교: "26년 03월" 형식 두 개를 비교
function isSamePeriod(a, b) {
  if (!a || !b) return false;
  return String(a).trim() === String(b).trim();
}

export default function DashboardHome({ period, onTaskChange, onAdminClick, isAdmin }) {
  const [loading, setLoading] = useState(true);
  const [taskData, setTaskData] = useState({}); // { taskId: { hospital: {...}, local: {...} } }

  // 모든 과제의 Firestore 데이터 병렬 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = {};
      await Promise.all(
        TASK_DEFS.map(async (t) => {
          if (t.keys.single) {
            const d = await loadDashboard(t.keys.single);
            result[t.id] = { single: d };
          } else if (t.keys.hospital || t.keys.local) {
            const [h, l] = await Promise.all([
              t.keys.hospital ? loadDashboard(t.keys.hospital) : null,
              t.keys.local ? loadDashboard(t.keys.local) : null,
            ]);
            result[t.id] = { hospital: h, local: l };
          } else {
            result[t.id] = {};
          }
        })
      );
      if (!cancelled) {
        setTaskData(result);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 특정 period의 데이터를 strict하게 꺼내기 (없으면 null)
  const getPeriodDataStrict = (data, targetPeriod) => {
    if (!data) return null;
    if (data.history?.[targetPeriod]) return { ...data, ...data.history[targetPeriod], period: targetPeriod };
    if (data.period === targetPeriod) return data;
    return null;
  };

  // 통계: 9개 과제 중 이번 달(=사이드바 선택 period) 업데이트 완료된 과제 수
  const stats = useMemo(() => {
    let updated = 0;
    let hasData = 0;
    TASK_DEFS.forEach(t => {
      const data = taskData[t.id];
      if (!data || Object.keys(t.keys).length === 0) return;
      const docs = [data.single, data.hospital, data.local].filter(Boolean);
      if (docs.length > 0) hasData++;
      // 이번 달 데이터 보유 여부: history에 해당 period가 있거나 top-level period가 일치
      const upd = docs.some(d => d.history?.[period] || d.period === period);
      if (upd) updated++;
    });
    return { totalTasks: TASK_DEFS.filter(t => Object.keys(t.keys).length > 0).length, updated, hasData };
  }, [taskData, period]);

  return (
    <div style={{ fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif" }}>
      {/* ─── HERO 영역 ─── */}
      <section style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        color: '#fff', borderRadius: 14, padding: '36px 40px 32px',
        marginBottom: 20, position: 'relative', overflow: 'hidden',
      }}>
        {/* 배경 장식 */}
        <div style={{ position: 'absolute', right: -60, top: -60, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', right: 80, bottom: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <div style={{ width: 56, height: 56, background: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, flexShrink: 0 }}>
                <img src={logoImg} alt="영업기획팀" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#F59E0B', letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 4 }}>
                  Daewoong · ETC Sales Planning
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>영업기획팀</div>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <h1 style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: 44, fontWeight: 800, letterSpacing: '-.025em',
                lineHeight: 1.05, marginBottom: 8,
              }}>{period}</h1>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,.7)', fontWeight: 500 }}>
                월간 평가 리포트 대시보드
              </div>
            </div>
          </div>

          {/* 우측 액션 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <button onClick={onAdminClick}
              style={{
                padding: '8px 16px', fontSize: 12, fontWeight: 600,
                background: isAdmin ? 'rgba(245,158,11,.2)' : 'rgba(255,255,255,.1)',
                color: isAdmin ? '#F59E0B' : '#fff',
                border: `1px solid ${isAdmin ? 'rgba(245,158,11,.4)' : 'rgba(255,255,255,.2)'}`,
                borderRadius: 8, cursor: 'pointer',
              }}>
              {isAdmin ? '🔓 관리자 모드' : '🔒 관리자'}
            </button>
          </div>
        </div>

        {/* 통계 띠 */}
        <div style={{
          marginTop: 28, paddingTop: 22, borderTop: '1px solid rgba(255,255,255,.1)',
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24,
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>총 평가 과제</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em' }}>{stats.totalTasks}<span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,.6)', marginLeft: 4 }}>개</span></div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>이번 달 업데이트</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em', color: '#34D399' }}>{stats.updated}<span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,.6)', marginLeft: 4 }}>/ {stats.totalTasks}</span></div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>데이터 보유</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em' }}>{stats.hasData}<span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,.6)', marginLeft: 4 }}>개 과제</span></div>
          </div>
        </div>
      </section>

      {/* ─── 과제 카드 그리드 ─── */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <h2 style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 22, fontWeight: 800, letterSpacing: '-.02em',
          }}>평가 과제</h2>
          <div style={{ fontSize: 12, color: '#6B7280' }}>
            카드를 클릭하면 해당 과제의 상세 대시보드로 이동합니다
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} style={{ height: 180, background: '#F3F4F6', borderRadius: 12, opacity: .6 }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {TASK_DEFS.map(t => (
              <TaskCard key={t.id} task={t} data={taskData[t.id]} period={period} getPeriodData={getPeriodDataStrict} onClick={() => onTaskChange(t.id)} />
            ))}
          </div>
        )}
      </section>

      {/* ─── 푸터 ─── */}
      <footer style={{ marginTop: 36, paddingTop: 18, borderTop: '1px solid #E5E7EB', textAlign: 'center', fontSize: 11, color: '#9CA3AF' }}>
        영업기획팀 · 대웅제약 · 기준 {period}
      </footer>
    </div>
  );
}

// ─── 개별 과제 카드 ───────────────────────────────────────────────────────────
function TaskCard({ task, data, period, getPeriodData, onClick }) {
  const isEmpty = !data || (!data.single && !data.hospital && !data.local);
  const hasMSA = task.id === 'msa';

  // 등급 추출
  let grades = null;
  let latestPeriod = null;     // 달력상 가장 최근 기간 (history 기반)
  let isUpdated = false;       // 사이드바에서 선택한 period에 데이터가 있는지

  if (data) {
    if (data.single) {
      // 선택 period 우선, 없으면 최신 기간 fallback해서 등급 표시
      const pdSel = getPeriodData(data.single, period);
      const latest = findLatestPeriod(data.single);
      latestPeriod = latest;
      isUpdated = !!pdSel;
      const pdShow = pdSel || (latest ? getPeriodData(data.single, latest) : null);
      if (pdShow && task.gradeField) {
        grades = { single: pdShow.total?.[task.gradeField] };
      }
    } else if (data.hospital || data.local) {
      const phSel = data.hospital ? getPeriodData(data.hospital, period) : null;
      const plSel = data.local ? getPeriodData(data.local, period) : null;
      isUpdated = !!phSel || !!plSel;
      latestPeriod = pickLater(findLatestPeriod(data.hospital), findLatestPeriod(data.local));
      // 등급 표시: 선택 period 우선, 없으면 latest fallback
      const phShow = phSel || (data.hospital && latestPeriod ? getPeriodData(data.hospital, latestPeriod) : null);
      const plShow = plSel || (data.local && latestPeriod ? getPeriodData(data.local, latestPeriod) : null);
      grades = {
        hospital: phShow?.total?.[task.gradeField],
        local: plShow?.total?.[task.gradeField],
      };
    }
  }

  return (
    <button onClick={onClick} style={{
      background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12,
      padding: 0, position: 'relative', overflow: 'hidden',
      cursor: 'pointer', textAlign: 'left',
      transition: 'all .2s ease',
      minHeight: 180, display: 'flex', flexDirection: 'column',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.08)'; e.currentTarget.style.borderColor = task.color; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#E5E7EB'; }}>
      {/* 좌측 컬러 스트라이프 */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: task.color }} />

      <div style={{ padding: '18px 20px 18px 26px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* 번호 + 상태 배지 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '.1em' }}>{task.num}</span>
          {!hasMSA && (
            isUpdated ? (
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#ECFDF5', color: '#059669', letterSpacing: '.05em' }}>● 업데이트</span>
            ) : isEmpty ? (
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#F3F4F6', color: '#6B7280', letterSpacing: '.05em' }}>데이터 없음</span>
            ) : (
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#FEF3C7', color: '#B45309', letterSpacing: '.05em' }}>이전 기간</span>
            )
          )}
        </div>

        {/* 과제명 */}
        <div style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 22, fontWeight: 800, letterSpacing: '-.015em',
          color: '#111', marginBottom: 4,
        }}>{task.name}</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 'auto' }}>{task.desc}</div>

        {/* 등급/지표 */}
        {hasMSA ? (
          <div style={{ marginTop: 16, fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>대시보드 구성 예정</div>
        ) : grades && (grades.single || grades.hospital || grades.local) ? (
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {grades.single != null && <GradeChip label={task.singleLabel || '본부'} grade={grades.single} />}
            {grades.hospital != null && <GradeChip label="병원" grade={grades.hospital} />}
            {grades.local != null && <GradeChip label="로컬" grade={grades.local} />}
          </div>
        ) : isEmpty ? (
          <div style={{ marginTop: 16, fontSize: 11, color: '#9CA3AF' }}>아직 데이터가 업로드되지 않았습니다</div>
        ) : (
          <div style={{ marginTop: 16, fontSize: 11, color: '#6B7280' }}>—</div>
        )}

        {/* 하단: 기간 + 화살표 */}
        <div style={{
          marginTop: 14, paddingTop: 12, borderTop: '1px solid #F3F4F6',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>
            {latestPeriod ? `최신 ${latestPeriod}` : (hasMSA ? '' : '데이터 없음')}
          </span>
          <span style={{ fontSize: 16, color: task.color, fontWeight: 700 }}>→</span>
        </div>
      </div>
    </button>
  );
}

function GradeChip({ label, grade }) {
  if (!grade) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10, color: '#9CA3AF' }}>{label}</span>
      <span style={{ fontSize: 10, color: '#9CA3AF' }}>-</span>
    </span>
  );
  const color = GRADE_COLOR[grade] || '#6B7280';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 10, color: '#9CA3AF' }}>{label}</span>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 22, height: 20, padding: '0 5px', borderRadius: 4,
        background: color, color: '#fff', fontSize: 11, fontWeight: 800,
      }}>{gradeLabel(grade)}</span>
    </span>
  );
}
