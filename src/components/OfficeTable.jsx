import { useState } from 'react';
import GradeBadge from './GradeBadge';
import { fmtPct, fmtMil, fmtGrowth, gradeLabel, fmtDiv, fmtOffice, sortOfficesByDivision } from '../utils/format';

const GRADES = ['전체', 'S', 'A+', 'A', 'B+', 'B', 'C+', 'C'];

export default function OfficeTable({ offices, onOfficeClick }) {
  const [filterGrade, setFilterGrade] = useState('전체');
  const [sortField, setSortField] = useState(null); // null = 기본 정렬(사업부순+ㄱㄴㄷ)
  const [sortAsc, setSortAsc] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const gradeCounts = {};
  offices.forEach(o => {
    const label = gradeLabel(o.grade_final);
    gradeCounts[label] = (gradeCounts[label] || 0) + 1;
  });

  const filtered = offices.filter(o => {
    if (filterGrade !== '전체' && gradeLabel(o.grade_final) !== filterGrade) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        fmtOffice(o.office).toLowerCase().includes(q) ||
        o.manager?.toLowerCase().includes(q) ||
        fmtDiv(o.division).toLowerCase().includes(q)
      );
    }
    return true;
  });

  const sorted = (() => {
    if (!sortField) return sortOfficesByDivision(filtered);
    const gradeOrder = ['S', 'Ap', 'A', 'Bp', 'B', 'Cp', 'C'];
    return [...filtered].sort((a, b) => {
      if (sortField === 'grade_final') {
        const diff = gradeOrder.indexOf(a.grade_final) - gradeOrder.indexOf(b.grade_final);
        return sortAsc ? diff : -diff;
      }
      const av = a[sortField] ?? 0;
      const bv = b[sortField] ?? 0;
      return sortAsc ? av - bv : bv - av;
    });
  })();

  const handleSort = (field) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  const SortIcon = ({ field }) => (
    <span className="ml-1 text-[var(--ink-4)] text-xs">
      {sortField === field ? (sortAsc ? '↑' : '↓') : '↕'}
    </span>
  );

  return (
    <div className="bg-white rounded-2xl border border-[var(--line)] overflow-hidden">
      {/* Filters */}
      <div className="p-4 border-b border-[var(--line)] flex flex-wrap gap-2 items-center">
        <div className="flex gap-1.5 flex-wrap">
          {GRADES.map(g => (
            <button
              key={g}
              onClick={() => setFilterGrade(g)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                filterGrade === g
                  ? 'bg-[var(--ink)] text-white'
                  : 'bg-[var(--line-2)] text-[var(--ink-3)] hover:bg-[var(--line)]'
              }`}
            >
              {g}
              {g !== '전체' && gradeCounts[g] != null && (
                <span className="ml-1 opacity-60">({gradeCounts[g]})</span>
              )}
              {g === '전체' && (
                <span className="ml-1 opacity-60">({offices.length})</span>
              )}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="사무소/소장 검색"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="ml-auto border border-[var(--line)] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[var(--accent)] w-40"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[var(--line-2)] text-[var(--ink-4)] text-left">
              <th className="px-4 py-3 font-medium w-8">#</th>
              <th className="px-3 py-3 font-medium">사업부</th>
              <th className="px-3 py-3 font-medium">사무소</th>
              <th className="px-3 py-3 font-medium">소장</th>
              <th className="px-3 py-3 font-medium text-right cursor-pointer" onClick={() => handleSort('target')}>
                대상 <SortIcon field="target" />
              </th>
              <th className="px-3 py-3 font-medium text-right cursor-pointer" onClick={() => handleSort('trade_cur')}>
                거래 <SortIcon field="trade_cur" />
              </th>
              <th className="px-3 py-3 font-medium text-right cursor-pointer" onClick={() => handleSort('trade_rate')}>
                거래율 <SortIcon field="trade_rate" />
              </th>
              <th className="px-3 py-3 font-medium text-right cursor-pointer" onClick={() => handleSort('gj_rate')}>
                종합병원 <SortIcon field="gj_rate" />
              </th>
              <th className="px-3 py-3 font-medium text-right cursor-pointer" onClick={() => handleSort('hosp_rate')}>
                병원 <SortIcon field="hosp_rate" />
              </th>
              <th className="px-3 py-3 font-medium text-right cursor-pointer" onClick={() => handleSort('sales_mil')}>
                실적(백만) <SortIcon field="sales_mil" />
              </th>
              <th className="px-3 py-3 font-medium text-right cursor-pointer" onClick={() => handleSort('growth_rate')}>
                성장률 <SortIcon field="growth_rate" />
              </th>
              <th className="px-3 py-3 font-medium text-center cursor-pointer" onClick={() => handleSort('grade_final')}>
                평가 <SortIcon field="grade_final" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((office, idx) => (
              <tr
                key={office.office + idx}
                className="border-t border-[var(--line-2)] hover:bg-[var(--bg)] cursor-pointer transition-colors"
                onClick={() => onOfficeClick(office)}
              >
                <td className="px-4 py-3 text-[var(--ink-4)]">{idx + 1}</td>
                <td className="px-3 py-3 text-[var(--ink-3)]">{fmtDiv(office.division)}</td>
                <td className="px-3 py-3 font-medium text-[var(--ink)]">{fmtOffice(office.office)}</td>
                <td className="px-3 py-3 text-[var(--ink-3)]">{office.manager}</td>
                <td className="px-3 py-3 text-right">{office.target}</td>
                <td className="px-3 py-3 text-right">{office.trade_cur}</td>
                <td className="px-3 py-3 text-right font-medium">{fmtPct(office.trade_rate)}</td>
                <td className="px-3 py-3 text-right">{fmtPct(office.gj_rate)}</td>
                <td className="px-3 py-3 text-right">{fmtPct(office.hosp_rate)}</td>
                <td className="px-3 py-3 text-right font-medium">{fmtMil(office.sales_mil)}</td>
                <td
                  className="px-3 py-3 text-right font-medium"
                  style={{ color: office.growth_rate >= 0 ? 'var(--pos)' : 'var(--neg)' }}
                >
                  {fmtGrowth(office.growth_rate)}
                </td>
                <td className="px-3 py-3 text-center">
                  <GradeBadge grade={office.grade_final} size="sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="py-12 text-center text-[var(--ink-4)] text-sm">
            해당하는 사무소가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
