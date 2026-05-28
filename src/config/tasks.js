/**
 * 과제 목록 설정
 * ─────────────────────────────────────────────────────
 * 새 과제 추가 방법:
 *   1. 아래 TASKS 배열에 항목 추가 (id, label)
 *   2. src/dashboards/ 에 새 대시보드 컴포넌트 생성 (선택)
 *   3. src/App.jsx 에서 새 컴포넌트 import + 렌더링 조건 추가
 * ─────────────────────────────────────────────────────
 */
export const TASKS = [
  { id: 'mbo_system',     label: 'MBO시스템', title: 'MBO시스템',  badge: 'MBO시스템' },
  { id: 'pool_dongdo',    label: '풀동도',    title: '풀동도',     badge: '풀동도' },
  { id: 'hospital110',    label: '110대병원', title: '110대병원',  badge: '110대병원' },
  { id: 'hospital2nd',    label: '2차병원',   title: '2차병원',    badge: '2차병원' },
  { id: 'customer_stage', label: '고객단계',  title: '고객단계',   badge: '고객단계' },
  { id: 'sop',            label: 'SOP',       title: 'SOP',        badge: 'SOP' },
  { id: 'direct_sales',   label: '직거래',    title: '직거래',     badge: '직거래' },
  { id: 'new_product',    label: '신제품',    title: '신제품',     badge: '신제품' },
  { id: 'msa',            label: 'MSA',       title: 'MSA',        badge: 'MSA' },
];
