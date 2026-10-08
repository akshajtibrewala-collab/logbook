import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Chart colours are token references, so a theme change never needs a chart edit. Colour is reserved for pilot
// (sky) vs passenger (violet); categories inside one role use the neutral ramp.
export const chartColors = { pilot: 'var(--ds-pilot)', pax: 'var(--ds-pax)', ramp: ['var(--ds-chart-1)', 'var(--ds-chart-2)', 'var(--ds-chart-3)', 'var(--ds-chart-4)'] };
const tick = { fontSize: 11, fill: 'var(--ds-text-2)' };
const margin = { left: -18, right: 16, top: 8, bottom: 0 };

/** Tooltip content: solid surface, hairline border. Use as <Tooltip content={<ChartTip unit="h" />} />. */
export function ChartTip({ active, payload, label, unit = '', format = (v) => v }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="ds-chart-tip">
      <div className="l">{label}</div>
      {payload.map((p) => (
        <div className="r" key={p.dataKey || p.name}><span className="sw" style={{ background: p.color || p.payload?.fill }} />{p.name}: {format(p.value)}{unit}</div>
      ))}
    </div>
  );
}

/** Bars: data [{ label, value }]; role picks the accent. */
export function BarsChart({ data, role = 'pilot', name = 'Hours', unit = '', height = 180 }) {
  return (
    <div className="ds-chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={margin}>
          <CartesianGrid stroke="var(--ds-chart-grid)" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={tick} axisLine={false} tickLine={false} width={44} />
          <Tooltip cursor={false} content={<ChartTip unit={unit} />} />
          <Bar dataKey="value" name={name} fill={role === 'pax' ? chartColors.pax : chartColors.pilot} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Cumulative line: data [{ label, value }]. */
export function LineTrend({ data, role = 'pilot', name = 'Hours', unit = '', height = 180 }) {
  return (
    <div className="ds-chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={margin}>
          <CartesianGrid stroke="var(--ds-chart-grid)" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={tick} axisLine={false} tickLine={false} width={44} />
          <Tooltip content={<ChartTip unit={unit} />} />
          <Line dataKey="value" name={name} type="monotone" stroke={role === 'pax' ? chartColors.pax : chartColors.pilot} strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut over the neutral ramp: data [{ name, value }]. */
export function RampDonut({ data, height = 180 }) {
  return (
    <div className="ds-chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<ChartTip />} />
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="90%" stroke="var(--ds-bg)" strokeWidth={2} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={d.name} fill={chartColors.ramp[i % chartColors.ramp.length]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
