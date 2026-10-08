import { fmtHours } from '../../lib/hours.js';
import { ROLE_TINT } from './chartStyle.js';

/** A ranked list of {label, count, hours?, sub?} rows with a proportional bar against the largest count. */
export default function Ranked({ rows, tint }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const barTint = tint ? ROLE_TINT[tint].bg : 'bg-accent';
  if (!rows.length) return <p className="text-sm text-slate-400">Nothing to rank yet.</p>;
  return (
    <ol className="space-y-3.5">
      {rows.map((r, i) => (
        <li key={r.label} className="flex items-center gap-3">
          <span className="w-5 text-sm text-slate-400">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium">{r.label}</span>
              <span className="shrink-0 text-sm text-slate-400">{r.count}×{r.hours !== undefined ? ` · ${fmtHours(r.hours)} h` : ''}</span>
            </div>
            {r.sub && <div className="truncate text-xs text-slate-400">{r.sub}</div>}
            <div className="mt-1.5 h-1.5 rounded-full bg-navy-800">
              <div className={`h-full rounded-full ${barTint}`} style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
