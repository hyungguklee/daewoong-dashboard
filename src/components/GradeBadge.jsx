import { gradeColor, gradeLabel } from '../utils/format';

export default function GradeBadge({ grade, size = 'md' }) {
  if (!grade) return null;
  const sz = size === 'lg'
    ? 'text-sm px-3 py-1 min-w-[40px]'
    : size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5 min-w-[26px]'
    : 'text-xs px-2 py-0.5 min-w-[32px]';
  return (
    <span
      className={`grade-badge ${sz} font-bold rounded text-center`}
      style={{ background: gradeColor(grade), color: '#fff' }}
    >
      {gradeLabel(grade)}
    </span>
  );
}
