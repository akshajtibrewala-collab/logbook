import { PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { fmtHours } from '../../lib/hours.js';
import { PALETTE, tooltipStyle } from './chartStyle.js';
import CollapsibleStatCard from './CollapsibleStatCard.jsx';

export default function CategoryDonut({ categories, defaultOpen = true }) {
  const total = categories.reduce((s, c) => s + c.hours, 0);
  return (
    <CollapsibleStatCard title="Hours by category" icon={PieChartIcon} note="Categories overlap — night PIC counts toward both." defaultOpen={defaultOpen}>
      {categories.length === 0 ? <p className="text-sm text-slate-500">No category time logged yet.</p> : (
        <>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={categories} dataKey="hours" nameKey="label" innerRadius="58%" outerRadius="90%" paddingAngle={2} stroke="none">
                  {categories.map((c, i) => <Cell key={c.key} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip {...tooltipStyle} formatter={(v) => `${fmtHours(v)} h`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-2">
            {categories.map((c, i) => (
              <li key={c.key} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />{c.label}
                </span>
                <span className="text-slate-400">{fmtHours(c.hours)} h · {Math.round((c.hours / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </CollapsibleStatCard>
  );
}
