import { CalendarRange } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fmtHours } from '../../lib/hours.js';
import { axisTick, tooltipStyle, chartMargin, barCursor, barRestingOpacity, barActive, gridStroke, ROLE_TINT } from './chartStyle.js';
import CollapsibleStatCard from './CollapsibleStatCard.jsx';

export default function FlightsPerYearChart({ rows, note, defaultOpen = true }) {
  return (
    <CollapsibleStatCard title="Flights per year" note={note} icon={CalendarRange} defaultOpen={defaultOpen}>
      {rows.length === 0 ? <p className="text-sm text-slate-400">No flights yet.</p> : (
        <div className="h-56" role="img" aria-label={`Bar chart of flights per year. ${rows.map((r) => `${r.year}: ${r.flights}`).join(', ')}`}>
          <ResponsiveContainer>
            <BarChart data={rows} margin={chartMargin}>
              <CartesianGrid {...gridStroke} />
              <XAxis dataKey="year" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...tooltipStyle} cursor={barCursor} formatter={(v, name) => (name === 'flights' ? [v, 'Flights'] : [`${fmtHours(v)} h`, 'Hours'])} />
              <Bar dataKey="flights" name="flights" fill={ROLE_TINT.pax.bar} fillOpacity={barRestingOpacity} activeBar={barActive(ROLE_TINT.pax.bar)}
                radius={[8, 8, 0, 0]} maxBarSize={40} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </CollapsibleStatCard>
  );
}
