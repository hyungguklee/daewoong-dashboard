// 가벼운 SVG 차트 모음 (인터랙티브, 라이브러리 없음)
import { useState } from 'react';

const COLORS = {
  primary: '#1A3A6B', accent: '#F59E0B', good: '#059669', bad: '#DC2626',
  warn: '#F59E0B', neutral: '#6B7280', light: '#F3F4F6',
};

// 0~1 → 진한 파랑(좋음) / 회색(보통) / 빨강(나쁨) 색상 보간
export function heatColor(v, { goodHigh = true } = {}) {
  if (v == null || isNaN(v)) return '#F3F4F6';
  const norm = Math.max(0, Math.min(1, v));
  const score = goodHigh ? norm : 1 - norm;
  // score 0(빨강) → 1(초록)
  const r = Math.round(220 - score * 180);
  const g = Math.round(80 + score * 130);
  const b = Math.round(80 + score * 50);
  return `rgb(${r},${g},${b})`;
}

// ─── 가로 막대 차트 (사무소 순위) ─────────────────────────────────
export function HBar({ data, maxItems = 10, valueFmt = v => v?.toFixed(1), color = COLORS.primary, showValue = true, height = 22 }) {
  const items = (data || []).filter(d => d.value != null).slice(0, maxItems);
  if (items.length === 0) return <div style={{ fontSize: 11, color: '#9CA3AF', padding: 8 }}>데이터 없음</div>;
  const max = Math.max(...items.map(d => Math.abs(d.value)));
  const min = Math.min(0, ...items.map(d => d.value));
  const span = max - min || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((d, i) => {
        const w = (Math.abs(d.value) / span) * 100;
        const isNeg = d.value < 0;
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 60px', alignItems: 'center', gap: 8, fontSize: 11 }}>
            <div style={{ color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.label}>{d.label}</div>
            <div style={{ position: 'relative', height, background: '#F9FAFB', borderRadius: 4 }}>
              <div style={{
                position: 'absolute', left: isNeg ? `${100 - w}%` : 0, top: 0, height: '100%',
                width: `${w}%`, background: d.color || (isNeg ? COLORS.bad : color),
                borderRadius: 4, transition: 'width .3s',
              }} />
            </div>
            {showValue && <div style={{ textAlign: 'right', fontWeight: 700, color: '#1F2937', fontVariantNumeric: 'tabular-nums' }}>{valueFmt(d.value)}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ─── 도넛 차트 (등급 분포 등) ─────────────────────────────────────
export function Donut({ data, size = 140, thickness = 20, centerLabel, centerValue }) {
  const total = (data || []).reduce((s, d) => s + (d.value || 0), 0);
  if (total === 0) return <div style={{ fontSize: 11, color: '#9CA3AF', padding: 8 }}>데이터 없음</div>;
  const r = size / 2 - thickness / 2;
  const cx = size / 2, cy = size / 2;
  let acc = 0;

  const arcs = data.map((d, i) => {
    const frac = d.value / total;
    const startA = acc * 2 * Math.PI - Math.PI / 2;
    const endA = (acc + frac) * 2 * Math.PI - Math.PI / 2;
    acc += frac;
    const large = frac > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(startA), y1 = cy + r * Math.sin(startA);
    const x2 = cx + r * Math.cos(endA),   y2 = cy + r * Math.sin(endA);
    return { i, d, pathD: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`, frac };
  });

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      <svg width={size} height={size}>
        {arcs.map(a => (
          <path key={a.i} d={a.pathD} fill="none" stroke={a.d.color} strokeWidth={thickness} />
        ))}
        {centerValue != null && (
          <>
            <text x={cx} y={cy - 2} textAnchor="middle" fontSize={20} fontWeight={800} fill="#111">{centerValue}</text>
            <text x={cx} y={cy + 16} textAnchor="middle" fontSize={10} fill="#6B7280">{centerLabel || ''}</text>
          </>
        )}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color }} />
            <span style={{ color: '#374151' }}>{d.label}</span>
            <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{d.value} <span style={{ color: '#9CA3AF', fontSize: 10 }}>({(d.value/total*100).toFixed(0)}%)</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 히트맵 (사무소 × 월) ─────────────────────────────────────────
export function Heatmap({ rows, cols, getValue, valueFmt = v => v?.toFixed(1), label, goodHigh = true, cellSize = 38 }) {
  const [hover, setHover] = useState(null);
  if (!rows?.length || !cols?.length) return <div style={{ fontSize: 11, color: '#9CA3AF', padding: 8 }}>데이터 없음</div>;
  // 정규화 (0~1)
  const all = [];
  rows.forEach(r => cols.forEach(c => { const v = getValue(r, c); if (v != null) all.push(v); }));
  const min = Math.min(...all), max = Math.max(...all);
  const norm = v => max === min ? 0.5 : (v - min) / (max - min);

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'inline-block', minWidth: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `140px repeat(${cols.length}, ${cellSize}px)`, gap: 2 }}>
          <div />
          {cols.map(c => <div key={c} style={{ fontSize: 10, color: '#6B7280', textAlign: 'center', padding: '4px 0' }}>{c.replace(/26년\s*/, '').replace('월','월')}</div>)}
          {rows.map((r, ri) => (
            <Row key={ri} r={r} cols={cols} getValue={getValue} norm={norm} valueFmt={valueFmt} goodHigh={goodHigh} cellSize={cellSize} hover={hover} setHover={setHover} />
          ))}
        </div>
        {hover && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#374151', background: '#F9FAFB', padding: '6px 10px', borderRadius: 6 }}>
            <strong>{hover.row}</strong> · {hover.col} · {label}: <strong>{valueFmt(hover.value)}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ r, cols, getValue, norm, valueFmt, goodHigh, cellSize, hover, setHover }) {
  return (
    <>
      <div style={{ fontSize: 11, color: '#374151', alignSelf: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 6 }} title={r.label}>{r.label}</div>
      {cols.map(c => {
        const v = getValue(r, c);
        const bg = v == null ? '#F3F4F6' : heatColor(norm(v), { goodHigh });
        const isHover = hover?.row === r.label && hover?.col === c;
        return (
          <div
            key={c}
            onMouseEnter={() => setHover({ row: r.label, col: c, value: v })}
            onMouseLeave={() => setHover(null)}
            style={{
              height: cellSize, background: bg, borderRadius: 3,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, color: v == null ? '#9CA3AF' : (norm(v) > 0.5 ? '#fff' : '#1F2937'),
              cursor: 'pointer', outline: isHover ? '2px solid #1A3A6B' : 'none',
            }}
          >
            {v == null ? '-' : valueFmt(v)}
          </div>
        );
      })}
    </>
  );
}

// ─── 라인 차트 (시계열) ──────────────────────────────────────────
export function LineChart({ series, periods, valueFmt = v => v?.toFixed(1), height = 180, colors }) {
  const [hover, setHover] = useState(null);
  if (!series?.length || !periods?.length) return <div style={{ fontSize: 11, color: '#9CA3AF', padding: 8 }}>데이터 없음</div>;

  const W = 600, H = height;
  const padL = 40, padR = 80, padT = 14, padB = 28;
  const innerW = W - padL - padR, innerH = H - padT - padB;

  const allVals = series.flatMap(s => s.values.map(v => v == null ? null : v).filter(v => v != null));
  const min = Math.min(...allVals), max = Math.max(...allVals);
  const span = max - min || 1;
  const padSpan = span * 0.1;
  const yMin = min - padSpan, yMax = max + padSpan;

  const xAt = i => padL + (periods.length === 1 ? innerW / 2 : (i / (periods.length - 1)) * innerW);
  const yAt = v => padT + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  const palette = colors || ['#1A3A6B', '#F59E0B', '#059669', '#DC2626', '#7C3AED', '#0891B2', '#EA580C', '#65A30D'];

  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', maxWidth: '100%', height: 'auto', display: 'block' }}>
        {/* Y 그리드 */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={padT + t * innerH} x2={padL + innerW} y2={padT + t * innerH} stroke="#E5E7EB" strokeDasharray="2 2" />
            <text x={padL - 6} y={padT + t * innerH + 3} fontSize={9} fill="#9CA3AF" textAnchor="end">{valueFmt(yMin + (1 - t) * (yMax - yMin))}</text>
          </g>
        ))}
        {/* X축 라벨 */}
        {periods.map((p, i) => (
          <text key={i} x={xAt(i)} y={H - padB + 14} fontSize={9} fill="#6B7280" textAnchor="middle">{p.replace(/26년\s*/, '').replace('월','월')}</text>
        ))}
        {/* 라인 */}
        {series.map((s, si) => {
          const color = palette[si % palette.length];
          const pts = s.values.map((v, i) => v == null ? null : { x: xAt(i), y: yAt(v), i });
          const valid = pts.filter(Boolean);
          if (valid.length < 1) return null;
          const path = valid.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          return (
            <g key={si}>
              <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
              {valid.map(p => (
                <circle key={p.i} cx={p.x} cy={p.y} r={3} fill={color}
                  onMouseEnter={() => setHover({ name: s.name, period: periods[p.i], value: s.values[p.i], color })}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: 'pointer' }}
                />
              ))}
            </g>
          );
        })}
        {/* 범례 */}
        {series.map((s, si) => {
          const color = palette[si % palette.length];
          return (
            <g key={si} transform={`translate(${padL + innerW + 8}, ${padT + si * 16})`}>
              <line x1={0} y1={5} x2={14} y2={5} stroke={color} strokeWidth={2} />
              <text x={18} y={9} fontSize={10} fill="#374151">{s.name}</text>
            </g>
          );
        })}
      </svg>
      {hover && (
        <div style={{ position: 'absolute', bottom: 4, left: padL, fontSize: 11, background: '#fff', border: '1px solid #E5E7EB', padding: '4px 8px', borderRadius: 4, color: '#1F2937', pointerEvents: 'none' }}>
          <span style={{ color: hover.color, fontWeight: 700 }}>●</span> {hover.name} · {hover.period} · <strong>{valueFmt(hover.value)}</strong>
        </div>
      )}
    </div>
  );
}

// ─── 스파크라인 (미니 추세) ─────────────────────────────────────
export function Sparkline({ values, color = COLORS.primary, width = 80, height = 24 }) {
  const valid = (values || []).filter(v => v != null);
  if (valid.length < 2) return <span style={{ fontSize: 10, color: '#9CA3AF' }}>—</span>;
  const min = Math.min(...valid), max = Math.max(...valid);
  const span = max - min || 1;
  const xStep = width / (valid.length - 1);
  const path = valid.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * xStep).toFixed(1)} ${(height - ((v - min) / span) * (height - 4) - 2).toFixed(1)}`).join(' ');
  const trend = valid[valid.length - 1] - valid[0];
  const trendColor = trend > 0 ? COLORS.good : trend < 0 ? COLORS.bad : COLORS.neutral;
  return <svg width={width} height={height} style={{ verticalAlign: 'middle' }}>
    <path d={path} fill="none" stroke={trendColor} strokeWidth={1.5} />
    {valid.map((v, i) => <circle key={i} cx={(i * xStep).toFixed(1)} cy={(height - ((v - min) / span) * (height - 4) - 2).toFixed(1)} r={1.5} fill={trendColor} />)}
  </svg>;
}

// ─── KPI 카드 (큰 숫자 + 라벨) ──────────────────────────────────
export function KpiCard({ label, value, unit, sub, color, icon }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 14px', minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: color || '#6B7280', letterSpacing: '.05em', marginBottom: 4 }}>
        {icon && <span style={{ marginRight: 4 }}>{icon}</span>}{label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#111', fontVariantNumeric: 'tabular-nums' }}>
        {value}{unit && <span style={{ fontSize: 13, color: '#6B7280', marginLeft: 2 }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export const C = COLORS;
