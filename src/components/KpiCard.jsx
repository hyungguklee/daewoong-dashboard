import { fmtPct, fmtMil, fmtGrowth, fmtNum } from '../utils/format';

export default function KpiCard({ label, value, sub, type = 'pct', positive }) {
  const formatted =
    type === 'pct' ? fmtPct(value) :
    type === 'mil' ? fmtMil(value) :
    type === 'growth' ? fmtGrowth(value) :
    type === 'num' ? fmtNum(value) :
    value;

  const isPos = positive != null ? positive : (type === 'growth' ? value >= 0 : null);

  return (
    <div className="bg-white rounded-2xl p-6 border border-[var(--line)]">
      <div className="text-xs font-medium text-[var(--ink-4)] uppercase tracking-widest mb-3">{label}</div>
      <div
        className="text-3xl font-bold mb-1"
        style={{ color: isPos === true ? 'var(--pos)' : isPos === false ? 'var(--neg)' : 'var(--ink)' }}
      >
        {formatted}
      </div>
      {sub && <div className="text-xs text-[var(--ink-4)] mt-1">{sub}</div>}
    </div>
  );
}
