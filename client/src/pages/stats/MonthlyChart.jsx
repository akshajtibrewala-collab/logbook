import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fmtHours } from '../../lib/hours.js';
import { hoursByMonth } from '../../lib/charts.js';
import { axisTick, tooltipStyle, chartMargin, barCursor } from './chartStyle.js';
import CollapsibleStatCard from './CollapsibleStatCard.jsx';

const localToday = () => new Date().toLocaleDateString('en-CA');

export default function MonthlyChart({ flights, note, defaultOpen = true }) {
  const rows = useMemo(() => hoursByMonth(flights, { months: 12, now: localToday() }), [flights]);
  const any = rows.some((r) => r.hours > 0);
  return (
    <CollapsibleStatCard title="Hours by month" note={note} defaultOpen={defaultOpen}>
      {!any ? <p className="text-sm text-slate-500">No flying in the last 12 months.</p> : (
        <div className="h-56" role="img" aria-label={`Bar chart of hours flown per month. ${rows.map((r) => `${r.label}: ${fmtHours(r.hours)}`).join(', ')}`}>
          <ResponsiveContainer>
            <BarChart data={rows} margin={chartMargin}>
              <CartesianGrid vertical={false} stroke="rgb(var(--edge) / var(--edge-a))" />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={14} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...tooltipStyle} cursor={barCursor} formatter={(v) => `${fmtHours(v)} h`} />
              <Bar dataKey="hours" name="Hours" fill="rgb(var(--accent))" radius={[6, 6, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </CollapsibleStatCard>
  );
}
