import { useNavigate } from 'react-router-dom';
import { fmtHours } from '../lib/hours.js';
import { formatDate as fmtDate } from '../lib/calendar.js';
import AirlineBadge from './AirlineBadge.jsx';
import RoleBadge from './RoleBadge.jsx';
import Card from './Card.jsx';

/** Home's merged pilot+passenger recent-activity feed. `items` is the output of lib/recentActivity.js. */
export default function RecentActivityList({ items }) {
  const navigate = useNavigate();
  return (
    <ul className="stagger space-y-2">
      {items.map((f) => (
        <li key={`${f.role}-${f.id}`}>
          <Card as="button" onClick={() => navigate(f.role === 'passenger' ? `/travel/${f.id}` : `/logbook/${f.id}`)} className="w-full text-left transition-colors active:bg-navy-800">
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <RoleBadge role={f.role} />
                <span className="truncate text-base font-medium">{f.from || '—'} → {f.to || '—'}</span>
              </span>
              <span className="shrink-0 stat-value text-base text-accent-strong">{fmtHours(f.hours)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-sm text-slate-400">
              <span className="flex min-w-0 items-center gap-1.5">
                {f.airline && <AirlineBadge airline={f.airline} />}
                <span className="truncate">{fmtDate(f.date)}</span>
              </span>
              {(f.aircraft_type || f.tail_number) && (
                <span className="shrink-0 truncate text-xs text-slate-500">{[f.aircraft_type, f.tail_number].filter(Boolean).join(' · ')}</span>
              )}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
