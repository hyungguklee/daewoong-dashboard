import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';

const DIV_COLORS = {
  '서울1': '#3B82F6',
  '서울2': '#8B5CF6',
  '지방1': '#10B981',
  '지방2': '#F59E0B',
};

const TARGET = ['서울1', '서울2', '지방1', '지방2'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value;
  return (
    <div className="bg-white border border-[var(--line)] rounded-xl p-3 shadow-lg text-xs">
      <div className="font-bold text-[var(--ink)] mb-1">{label}</div>
      <div className="text-[var(--ink-2)]">
        성장률 <span className="font-bold ml-1" style={{ color: v >= 0 ? '#1B6B3D' : '#A03333' }}>
          {v >= 0 ? '+' : ''}{v?.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

export default function GrowthChart({ divisions, title = '사업부별 성장률' }) {
  const data = TARGET.map(name => {
    const d = divisions?.find(div => div.name === name);
    const growth = d?.growth_rate != null
      ? Math.round(d.growth_rate * 10000) / 100
      : null;
    return { name, growth, color: DIV_COLORS[name] };
  }).filter(d => d.growth != null);

  if (!data.length) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-[var(--line)] flex items-center justify-center" style={{ height: 292 }}>
        <p className="text-sm text-[var(--ink-4)]">데이터 없음</p>
      </div>
    );
  }

  const maxAbs = Math.max(...data.map(d => Math.abs(d.growth)), 1);
  const hasNeg = data.some(d => d.growth < 0);
  const domainMax = Math.ceil(maxAbs * 1.25);
  const domainMin = hasNeg ? -Math.ceil(maxAbs * 1.25) : 0;

  return (
    <div className="bg-white rounded-2xl p-6 border border-[var(--line)]">
      <div className="text-sm font-bold text-[var(--ink)] mb-4">{title}</div>
      <div style={{ height: 210 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line-2)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: 'var(--ink-3)', fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[domainMin, domainMax]}
              tickFormatter={v => v.toFixed(0) + '%'}
              tick={{ fontSize: 10, fill: 'var(--ink-4)' }}
              tickLine={false}
              axisLine={false}
              width={42}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="var(--line)" strokeWidth={1.5} />
            <Bar dataKey="growth" radius={[4, 4, 0, 0]} maxBarSize={72}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-5 mt-3 flex-wrap">
        {data.map(d => (
          <div key={d.name} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
            <span className="text-xs text-[var(--ink-3)]">{d.name}</span>
            <span className="text-xs font-bold" style={{ color: d.growth >= 0 ? '#1B6B3D' : '#A03333' }}>
              {d.growth >= 0 ? '+' : ''}{d.growth.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
