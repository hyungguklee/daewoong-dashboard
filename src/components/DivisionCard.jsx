import GradeBadge from './GradeBadge';
import { fmtPct, fmtMil, fmtGrowth } from '../utils/format';

export default function DivisionCard({ division, onClick }) {
  const { name, manager, grade_final, trade_rate, trade_cur, target, sales_mil, growth_rate } = division;

  return (
    <div
      className="bg-white rounded-2xl p-6 border border-[var(--line)] cursor-pointer hover:shadow-lg hover:border-[var(--accent)] transition-all duration-200 group"
      onClick={() => onClick(division)}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-base font-bold text-[var(--ink)]">{name}</div>
          {manager && <div className="text-xs text-[var(--ink-4)] mt-0.5">{manager}</div>}
        </div>
        <GradeBadge grade={grade_final} size="lg" />
      </div>

      {/* Trade rate bar */}
      <div className="mb-4">
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="text-xs text-[var(--ink-4)]">거래율</span>
          <span className="text-lg font-bold text-[var(--ink)]">{fmtPct(trade_rate)}</span>
        </div>
        <div className="h-1.5 bg-[var(--line-2)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${(trade_rate || 0) * 100}%`, background: 'var(--accent)' }}
          />
        </div>
        <div className="text-xs text-[var(--ink-4)] mt-1">{trade_cur}처 / {target}처</div>
      </div>

      <div className="flex gap-4 pt-4 border-t border-[var(--line-2)]">
        <div>
          <div className="text-xs text-[var(--ink-4)] mb-0.5">실적</div>
          <div className="text-sm font-semibold">{fmtMil(sales_mil)}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-[var(--ink-4)] mb-0.5">성장률</div>
          <div
            className="text-sm font-bold"
            style={{ color: growth_rate >= 0 ? 'var(--pos)' : 'var(--neg)' }}
          >
            {fmtGrowth(growth_rate)}
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity text-right">
        사무소 상세 보기 →
      </div>
    </div>
  );
}
