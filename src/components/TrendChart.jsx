import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
  BarChart, Bar, Cell, LabelList,
} from 'recharts';

function buildChartData(trendData) {
  if (!trendData) return [];
  const allMonths = Object.keys(trendData).sort();
  return allMonths.map(m => ({
    month: m,
    trade_rate: trendData[m]?.trade_rate != null ? Math.round(trendData[m].trade_rate * 1000) / 10 : null,
    sales_mil: trendData[m]?.sales_mil != null ? Math.round(trendData[m].sales_mil) : null,
    trade_cnt: trendData[m]?.trade_cnt,
  }));
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[var(--line)] rounded-xl p-3 shadow-lg text-xs">
      <div className="font-bold text-[var(--ink)] mb-2">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="flex gap-2 items-center">
          <span style={{ color: p.color }}>●</span>
          <span className="text-[var(--ink-3)]">{p.name}:</span>
          <span className="font-semibold">
            {p.dataKey === 'trade_rate' ? p.value + '%' :
             p.dataKey === 'sales_mil' ? p.value.toLocaleString('ko-KR') + '백만' :
             p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── 사업부별 성장률 비교 바차트 ─────────────────────────────────────────────
const DIV_ORDER = ['서울1', '서울2', '지방1', '지방2'];
const DIV_COLORS = {
  '서울1': '#3B82F6',
  '서울2': '#8B5CF6',
  '지방1': '#10B981',
  '지방2': '#F59E0B',
};

const GrowthTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-[var(--line)] rounded-xl p-3 shadow-lg text-xs">
      <div className="font-bold text-[var(--ink)] mb-1">{d.payload.name}</div>
      <div className="flex gap-2 items-center">
        <span style={{ color: d.payload.color }}>●</span>
        <span className="text-[var(--ink-3)]">성장률:</span>
        <span className="font-semibold">{d.value > 0 ? '+' : ''}{d.value.toFixed(1)}%</span>
      </div>
    </div>
  );
};

export function DivisionGrowthChart({ divisions = [], title = '사업부별 성장률 비교' }) {
  const data = DIV_ORDER.map(name => {
    const div = divisions.find(d => d.name === name);
    const growth = div?.growth_rate != null
      ? Math.round(div.growth_rate * 10000) / 100
      : null;
    return { name, growth, color: DIV_COLORS[name] };
  });

  // Y축 범위: 데이터 기반으로 여유 포함
  const vals = data.map(d => d.growth).filter(v => v != null);
  const minVal = vals.length ? Math.min(...vals) : 0;
  const maxVal = vals.length ? Math.max(...vals) : 30;
  const yMin = Math.floor(Math.min(minVal, 0) / 5) * 5;
  const yMax = Math.ceil((maxVal + 5) / 5) * 5;

  return (
    <div className="bg-white rounded-2xl p-6 border border-[var(--line)]">
      <div className="text-sm font-bold text-[var(--ink)] mb-4">{title}</div>
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 16, left: -8, bottom: 0 }} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line-2)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: 'var(--ink-3)', fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[yMin, yMax]}
              tickFormatter={v => v + '%'}
              tick={{ fontSize: 10, fill: 'var(--ink-4)' }}
              tickLine={false}
              axisLine={false}
              width={42}
            />
            <Tooltip content={<GrowthTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <ReferenceLine y={0} stroke="var(--line)" strokeWidth={1} />
            <Bar dataKey="growth" radius={[6, 6, 0, 0]} maxBarSize={56}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} fillOpacity={entry.growth == null ? 0.25 : 0.85} />
              ))}
              <LabelList
                dataKey="growth"
                position="top"
                formatter={v => v != null ? (v > 0 ? '+' : '') + v.toFixed(1) + '%' : '-'}
                style={{ fontSize: 11, fontWeight: 700, fill: 'var(--ink-2)' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function TrendChart({ trendData, divisionTrends, title = '누적 트렌드' }) {
  const totalData = buildChartData(trendData);

  // Division overlay data
  const divColors = {
    '서울1': '#3B82F6', '서울2': '#8B5CF6',
    '지방1': '#10B981', '지방2': '#F59E0B', '프로트랙': '#EF4444',
  };

  const divLines = divisionTrends
    ? Object.entries(divisionTrends).map(([name, data]) => ({
        name, data: buildChartData(data), color: divColors[name] || '#999',
      }))
    : [];

  // Build merged dataset for multi-line chart
  const allMonths = [...new Set([
    ...totalData.map(d => d.month),
    ...divLines.flatMap(d => d.data.map(r => r.month))
  ])].sort();

  const chartData = allMonths.map(month => {
    const total = totalData.find(d => d.month === month) || {};
    const row = { month, ...total };
    divLines.forEach(({ name, data }) => {
      const found = data.find(d => d.month === month);
      if (found) row[name + '_rate'] = found.trade_rate;
    });
    return row;
  });

  const showDivisions = divLines.length > 0;

  return (
    <div className="bg-white rounded-2xl p-6 border border-[var(--line)]">
      <div className="text-sm font-bold text-[var(--ink)] mb-4">{title}</div>
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line-2)" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: 'var(--ink-4)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="rate"
              domain={[60, 105]}
              tickFormatter={v => v + '%'}
              tick={{ fontSize: 10, fill: 'var(--ink-4)' }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            {showDivisions && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />}

            {showDivisions ? (
              divLines.map(({ name, color }) => (
                <Line
                  key={name}
                  yAxisId="rate"
                  type="monotone"
                  dataKey={name + '_rate'}
                  name={name}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))
            ) : (
              <Line
                yAxisId="rate"
                type="monotone"
                dataKey="trade_rate"
                name="거래율"
                stroke="var(--accent)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: 'var(--accent)' }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            )}
            <ReferenceLine yAxisId="rate" y={85} stroke="var(--neg)" strokeDasharray="4 2" strokeWidth={1} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
