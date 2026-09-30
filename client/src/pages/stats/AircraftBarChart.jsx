import { useState } from 'react';
import { Plane } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, LabelList, Tooltip, ResponsiveContainer } from 'recharts';
import { fmtHours } from '../../lib/hours.js';
import { tooltipStyle, barCursor, ROLE_TINT } from './chartStyle.js';
import CollapsibleStatCard from './CollapsibleStatCard.jsx';

// Tall enough per row that a single bar isn't stranded in a mostly-empty card, short enough that a dozen
// aircraft still fit on one phone screen without excess scrolling.
const ROW_HEIGHT = 52;

/**
 * Horizontal bar chart of hours per aircraft. `byTail` is optional — when given, a "By type / By tail
 * number" toggle appears above the chart (used on the Pilot tab); omit it for a type-only breakdown
 * (used on the Travel tab, tinted for the passenger role via `tint`). Both `byType` and `byTail` are
 * `{ type, hours }[]`, already sorted.
 */
export default function AircraftBarChart({ title, note, byType, byTail, tint = 'pilot', defaultOpen = true }) {
  const [groupBy, setGroupBy] = useState('type');
  const rows = byTail && groupBy === 'tail' ? byTail : byType;
  const barFill = ROLE_TINT[tint].bar;

  return (
    <CollapsibleStatCard title={title} note={note} icon={Plane} defaultOpen={defaultOpen}>
      {byTail && (
        <div className="mb-3 flex gap-1 rounded-xl bg-navy-800 p-1" role="group" aria-label="Group aircraft by">
          {[['type', 'By type'], ['tail', 'By tail number']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setGroupBy(k)} aria-pressed={groupBy === k}
              className={`pressable h-11 flex-1 rounded-lg text-sm font-medium transition-colors ${groupBy === k ? 'bg-accent text-ink' : 'text-slate-400'}`}>{l}</button>
          ))}
        </div>
      )}
      {rows.length === 0 ? <p className="text-sm text-slate-500">No aircraft logged yet.</p> : (
        <div style={{ height: Math.max(140, rows.length * ROW_HEIGHT) }}>
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="type" width={72} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <Tooltip {...tooltipStyle} cursor={barCursor} formatter={(v) => `${fmtHours(v)} h`} />
              <Bar dataKey="hours" fill={barFill} radius={[0, 8, 8, 0]} barSize={22} isAnimationActive={false}>
                <LabelList dataKey="hours" position="right" fontSize={12} formatter={(v) => fmtHours(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </CollapsibleStatCard>
  );
}
