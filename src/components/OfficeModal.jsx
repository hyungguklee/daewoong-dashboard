import { useState, useEffect } from 'react';
import { fmtPct, fmtGrowth, gradeColor, gradeLabel, fmtDiv, fmtOffice } from '../utils/format';

// 원 단위 → 백만 단위 변환 (소수점 1자리)
function fmtM(n) {
  if (!n && n !== 0) return '-';
  const v = typeof n === 'number' ? n : Number(n);
  if (isNaN(v) || v === 0) return '0.0';
  return (v / 1000000).toFixed(1);
}

function cleanVal(v) {
  if (v == null) return '-';
  const s = String(v).trim();
  if (!s || s === '0' || s === '#N/A' || s === 'None' || s === 'null' || s === 'undefined') return '-';
  return s;
}

const STAGE_COLORS = {
  1: '#E8A87C', 2: '#C4975A', 3: '#A0C5A8',
  4: '#5A9B72', 5: '#3D7ABD', 6: '#1A3A6B',
};

function StagePill({ stage }) {
  const sv = cleanVal(stage);
  if (sv === '-') return <span className="text-[var(--ink-4)]">-</span>;
  const raw = String(sv).replace(/[^0-9]/g, '');
  const n = parseInt(raw);
  if (!n) return <span className="text-[11px] text-[var(--ink-3)]">-</span>;
  return (
    <span
      className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[10.5px] font-bold text-white"
      style={{ background: STAGE_COLORS[n] || '#9A9A9A' }}
    >
      {n}
    </span>
  );
}

function TradeBadge({ traded }) {
  return traded
    ? <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#E1F0E7] text-[#2D7A4F]">● 거래중</span>
    : <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#F4DBDB] text-[#C0392B]">✕ 비거래</span>;
}

// 컬럼 헤더 (전체 병원 / 비거래 탭 공통)
function TableHead({ showTrade = true }) {
  return (
    <tr className="bg-[#FAF8F1] text-[var(--ink-3)] text-[10px] font-bold tracking-wider uppercase border-b border-[var(--line)]">
      <th className="px-2 py-2 text-center w-7">#</th>
      <th className="px-2.5 py-2 text-left">요양기관명</th>
      <th className="px-2.5 py-2 text-center">종별</th>
      <th className="px-2.5 py-2 text-center">병상</th>
      <th className="px-2.5 py-2 text-left">의사결정자</th>
      <th className="px-2.5 py-2 text-left">고객명</th>
      <th className="px-2.5 py-2 text-center">단계</th>
      <th className="px-2.5 py-2 text-right">기준점</th>
      <th className="px-2.5 py-2 text-right">실적</th>
      {showTrade && <th className="px-2.5 py-2 text-center">거래</th>}
      <th className="px-2.5 py-2 text-left">로컬담당</th>
    </tr>
  );
}

function HospRow({ h, idx, showTrade = true }) {
  return (
    <tr className="border-t border-[var(--line-2)] hover:bg-[#FCFAF3]">
      <td className="px-2 py-2 text-center text-[var(--ink-4)] text-[11px]">{idx + 1}</td>
      <td className={`px-2.5 py-2 text-left font-bold text-[12px] ${!h.is_traded ? 'text-[#C0392B]' : 'text-[var(--ink)]'}`}>
        {h.name}
      </td>
      <td className="px-2.5 py-2 text-center text-[11px] text-[var(--ink-3)]">{cleanVal(h.type)}</td>
      <td className="px-2.5 py-2 text-center font-semibold text-[12px]">{h.beds || '-'}</td>
      <td className="px-2.5 py-2 text-left text-[11px]">{cleanVal(h.decision_maker)}</td>
      <td className="px-2.5 py-2 text-left text-[11px]">{cleanVal(h.customer_name)}</td>
      <td className="px-2.5 py-2 text-center"><StagePill stage={h.customer_stage} /></td>
      <td className="px-2.5 py-2 text-right font-semibold tabular-nums text-[12px]">{fmtM(h.baseline)}</td>
      <td className="px-2.5 py-2 text-right font-bold tabular-nums text-[12px]">{fmtM(h.sales_mar)}</td>
      {showTrade && (
        <td className="px-2.5 py-2 text-center"><TradeBadge traded={h.is_traded} /></td>
      )}
      <td className="px-2.5 py-2 text-left text-[10.5px] text-[var(--ink-3)]">
        {h.local_office || ''}
      </td>
    </tr>
  );
}

export default function OfficeModal({ office, hospitals, trendData, onClose }) {
  const [tab, setTab] = useState('all');

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  if (!office) return null;

  const list = hospitals || [];

  // 비거래 먼저(병상↓) → 거래중 나중(병상↓)
  const allSorted = [...list].sort((a, b) => {
    const tradeDiff = (a.is_traded ? 1 : 0) - (b.is_traded ? 1 : 0); // 비거래(0) 먼저
    if (tradeDiff !== 0) return tradeDiff;
    return (b.beds || 0) - (a.beds || 0); // 같은 거래여부 내 병상 내림차순
  });

  const traded = list.filter(h => h.is_traded);
  const nonTraded = list.filter(h => !h.is_traded);
  const noTradeList = [...nonTraded].sort((a, b) => (b.beds || 0) - (a.beds || 0));

  const gc = gradeColor(office.grade_final);

  // 월별 트렌드
  const offTrend = trendData?.offices?.[office.office];
  const trendKeys = offTrend ? Object.keys(offTrend).sort().slice(-6) : [];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content animate-in" style={{ maxWidth: 1120 }}>

        {/* ── Header ── */}
        <div className="flex items-start gap-4 p-5 border-b border-[var(--line)] flex-shrink-0">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-black text-xl flex-shrink-0"
            style={{ background: gc }}
          >
            {gradeLabel(office.grade_final)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-[var(--ink-4)] tracking-widest uppercase mb-0.5">
              {fmtDiv(office.division)} 사업부 · 사무소 상세
            </div>
            <div className="text-[22px] font-black text-[var(--ink)] leading-tight mb-1">
              {fmtOffice(office.office)} 사무소
            </div>
            <div className="text-[12px] text-[var(--ink-3)]">
              소장 <strong className="text-[var(--ink-2)]">{office.manager || '-'}</strong>
              {' · '}대상 <strong>{office.target}처</strong>
              {' · '}거래율 <strong>{fmtPct(office.trade_rate)}</strong>
              {' · '}매출성장{' '}
              <strong style={{ color: (office.growth_rate || 0) >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                {fmtGrowth(office.growth_rate)}
              </strong>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 border border-[var(--line)] rounded-lg text-[var(--ink-3)] hover:bg-[var(--bg)] hover:text-[var(--ink)] flex items-center justify-center text-sm flex-shrink-0"
          >✕</button>
        </div>

        <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(88vh - 108px)' }}>

          {/* ── KPI 4개 ── */}
          <div className="grid grid-cols-4 gap-2.5 mb-5">
            {/* 거래율 */}
            <div className="bg-[#FAF8F1] rounded-lg p-3 border border-[var(--line-2)]">
              <div className="text-[10px] font-bold text-[var(--ink-3)] tracking-widest uppercase mb-1">거래율</div>
              <div className="text-lg font-black text-[var(--ink)]">{fmtPct(office.trade_rate)}</div>
              <div className="text-[10.5px] text-[var(--ink-3)] mt-0.5">거래 {office.trade_cur} / 대상 {office.target}처</div>
            </div>
            {/* 성장률 */}
            <div className="bg-[#FAF8F1] rounded-lg p-3 border border-[var(--line-2)]">
              <div className="text-[10px] font-bold text-[var(--ink-3)] tracking-widest uppercase mb-1">성장률</div>
              <div
                className="text-lg font-black"
                style={{ color: (office.growth_rate || 0) >= 0 ? 'var(--pos)' : 'var(--neg)' }}
              >
                {fmtGrowth(office.growth_rate)}
              </div>
              <div className="text-[10.5px] text-[var(--ink-3)] mt-0.5">
                실적 {(office.sales_mil || 0).toFixed(1)}백만원
              </div>
            </div>
            {/* 거래중 병원 */}
            <div className="bg-[#FAF8F1] rounded-lg p-3 border border-[var(--line-2)]">
              <div className="text-[10px] font-bold text-[var(--ink-3)] tracking-widest uppercase mb-1">거래중 병원</div>
              <div className="text-lg font-black text-[var(--ink)]">
                {traded.length}<span className="text-xs font-medium text-[var(--ink-3)] ml-1">처</span>
              </div>
              <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--neg)' }}>
                비거래 {nonTraded.length}처
              </div>
            </div>
            {/* 평가등급 */}
            <div className="bg-[#FAF8F1] rounded-lg p-3 border border-[var(--line-2)]">
              <div className="text-[10px] font-bold text-[var(--ink-3)] tracking-widest uppercase mb-1">평가등급</div>
              <div className="flex items-center mt-0.5">
                <span
                  className="inline-flex items-center justify-center w-10 h-7 rounded font-black text-base text-white"
                  style={{ background: gc }}
                >
                  {gradeLabel(office.grade_final)}
                </span>
              </div>
              <div className="text-[10.5px] text-[var(--ink-3)] mt-1">
                정성 {gradeLabel(office.grade_quality)} · 정량 {gradeLabel(office.grade_quant)}
              </div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="flex border-b-2 border-[var(--line)] mb-4">
            {[
              { key: 'all',     label: `전체 병원 (${list.length})` },
              { key: 'notrade', label: `비거래 병원만 (${nonTraded.length})` },
              { key: 'trend',   label: '월별 트렌드' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-xs font-semibold border-b-2 -mb-0.5 transition-all ${
                  tab === t.key
                    ? 'text-[var(--ink)] border-[var(--ink)]'
                    : 'text-[var(--ink-3)] border-transparent hover:text-[var(--ink-2)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── 전체 병원 ── */}
          {tab === 'all' && (
            <>
              <div className="text-[10.5px] text-[var(--ink-4)] text-right mb-1">(단위: 백만)</div>
              <div className="border border-[var(--line)] rounded-lg overflow-hidden">
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full text-xs" style={{ minWidth: 860 }}>
                    <thead><TableHead showTrade /></thead>
                    <tbody>
                      {allSorted.length === 0
                        ? <tr><td colSpan={11} className="py-10 text-center text-[var(--ink-3)]">데이터 없음</td></tr>
                        : allSorted.map((h, i) => <HospRow key={i} h={h} idx={i} showTrade />)
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── 비거래 병원만 ── */}
          {tab === 'notrade' && (
            <>
              <div className="text-[10.5px] text-[var(--ink-4)] text-right mb-1">(단위: 백만)</div>
              <div className="border border-[var(--line)] rounded-lg overflow-hidden">
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full text-xs" style={{ minWidth: 760 }}>
                    {/* 비거래 탭은 거래 배지 없이 표시 */}
                    <thead><TableHead showTrade={false} /></thead>
                    <tbody>
                      {noTradeList.length === 0
                        ? (
                          <tr>
                            <td colSpan={10} className="py-10 text-center text-sm font-medium" style={{ color: 'var(--pos)' }}>
                              ✓ 비거래 병원 없음! 전체 거래 달성
                            </td>
                          </tr>
                        )
                        : noTradeList.map((h, i) => <HospRow key={i} h={h} idx={i} showTrade={false} />)
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── 월별 트렌드 ── */}
          {tab === 'trend' && (
            <div>
              {trendKeys.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {trendKeys.map(key => {
                    const m = offTrend[key] || {};
                    return (
                      <div key={key} className="bg-[#FAF8F1] border border-[var(--line-2)] rounded-lg p-4 text-center">
                        <div className="text-[10px] text-[var(--ink-3)] font-bold mb-2">{key}</div>
                        <div className="text-base font-black text-[var(--ink)]">{fmtPct(m.trade_rate)}</div>
                        <div className="text-[10px] text-[var(--ink-3)] mt-1">
                          거래 {m.trade_cnt || 0}처 · {(m.sales_mil || 0).toFixed(1)}백만
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="text-3xl mb-3">📊</div>
                  <div className="text-sm text-[var(--ink-3)]">트렌드 데이터 없음</div>
                  <div className="text-xs text-[var(--ink-4)] mt-1">월별 데이터 업로드 시 트렌드가 표시됩니다</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
