import { useEffect } from 'react';
import GradeBadge from './GradeBadge';
import OfficeTable from './OfficeTable';
import { fmtPct, fmtMil, fmtGrowth } from '../utils/format';

export default function DivisionModal({ division, offices, hospitalData, trendData, onOfficeClick, onClose }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!division) return null;

  const divOffices = offices.filter(o => o.division === division.name || division.name === '프로트랙' && o.office === '프로트랙');

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content animate-in" style={{ maxWidth: 1000 }}>
        <div className="flex items-start justify-between p-6 border-b border-[var(--line)]">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-bold text-[var(--ink)] m-0">{division.name} 사업부</h2>
              <GradeBadge grade={division.grade_final} size="lg" />
            </div>
            <div className="text-sm text-[var(--ink-3)]">
              {division.manager && `본부장 ${division.manager} · `}
              대상 {division.target}처 · 거래 {division.trade_cur}처 · 거래율 {fmtPct(division.trade_rate)}
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--ink-4)] hover:text-[var(--ink)] text-xl font-light ml-4">✕</button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-[var(--bg)] rounded-xl p-4">
              <div className="text-xs text-[var(--ink-4)] mb-1">거래율</div>
              <div className="text-xl font-bold">{fmtPct(division.trade_rate)}</div>
            </div>
            <div className="bg-[var(--bg)] rounded-xl p-4">
              <div className="text-xs text-[var(--ink-4)] mb-1">종합병원</div>
              <div className="text-xl font-bold">{fmtPct(division.gj_rate)}</div>
            </div>
            <div className="bg-[var(--bg)] rounded-xl p-4">
              <div className="text-xs text-[var(--ink-4)] mb-1">실적</div>
              <div className="text-xl font-bold">{fmtMil(division.sales_mil)}</div>
            </div>
            <div className="bg-[var(--bg)] rounded-xl p-4">
              <div className="text-xs text-[var(--ink-4)] mb-1">성장률</div>
              <div className="text-xl font-bold" style={{ color: division.growth_rate >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                {fmtGrowth(division.growth_rate)}
              </div>
            </div>
          </div>

          <div className="text-sm font-bold text-[var(--ink)] mb-3">소속 사무소</div>
          <OfficeTable offices={divOffices} onOfficeClick={onOfficeClick} />
        </div>
      </div>
    </div>
  );
}
