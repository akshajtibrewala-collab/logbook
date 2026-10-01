import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import Card from './Card.jsx';

/**
 * One of Home's two role hero cards (Pilot / Travel): a large headline number, up to 3 supporting stats,
 * and a link into that role's own page. `scoped` wraps the card in `.role-pax-scope` so the existing
 * `bg-accent`/`text-accent-strong` tokens resolve to violet instead of sky blue for the Travel card — the
 * same mechanism PassengerFlights.jsx and Stats.jsx already use, so "pilot = sky, passenger = violet"
 * never needs a second color system.
 */
// `note` is a small line under the stats grid: a plain string (e.g. Travel's top airline), or
// `{ text, to }` to make it a tappable link (e.g. Pilot's folded closest-milestone progress).
export default function RoleHeroCard({ scoped = false, icon: Icon, title, scopeLabel, bigValue, bigLabel, stats, to, linkLabel, note, empty }) {
  const content = (
    <Card className="h-full">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        {Icon && <Icon size={16} strokeWidth={1.75} />}
        <span className="font-medium text-slate-300">{title}</span>
        <span className="text-xs text-slate-500">· {scopeLabel}</span>
      </div>

      {empty ? (
        <div className="mt-3">{empty}</div>
      ) : (
        <>
          <div className="mt-2">
            <div className="stat-value text-accent-strong text-4xl leading-none">{bigValue}</div>
            <div className="mt-1 text-xs text-slate-400">{bigLabel}</div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {stats.map((s) => (
              <div key={s.label} className="min-w-0 text-center">
                <div className="truncate text-base font-semibold">{s.value}</div>
                <div className="mt-0.5 truncate text-[11px] text-slate-400">{s.label}</div>
              </div>
            ))}
          </div>
          {note && (typeof note === 'string' ? (
            <p className="mt-2 truncate text-center text-xs text-slate-500">{note}</p>
          ) : (
            <Link to={note.to} className="mt-2 flex items-center justify-center gap-1 truncate text-center text-xs text-accent-strong">
              {note.text}<ChevronRight size={12} />
            </Link>
          ))}
          <Link to={to} className="mt-4 flex items-center justify-center gap-1 text-sm font-medium text-accent-strong">
            {linkLabel}<ChevronRight size={16} />
          </Link>
        </>
      )}
    </Card>
  );
  return scoped ? <div className="role-pax-scope">{content}</div> : content;
}
