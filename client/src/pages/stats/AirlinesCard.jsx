import { Building2 } from 'lucide-react';
import { fmtHours } from '../../lib/hours.js';
import AirlineBadge from '../../components/AirlineBadge.jsx';
import CollapsibleStatCard from './CollapsibleStatCard.jsx';

export default function AirlinesCard({ airlines, defaultOpen = false }) {
  const teaser = airlines[0] ? `Top: ${airlines[0].name} · ${fmtHours(airlines[0].hours)} h` : 'No airline recorded yet.';
  return (
    <CollapsibleStatCard title="Airlines" note={teaser} icon={Building2} defaultOpen={defaultOpen}>
      {airlines.length === 0 ? <p className="text-sm text-slate-400">No airline recorded yet.</p> : (
        <ul className="space-y-3">
          {airlines.map((a) => (
            <li key={a.name} className="flex items-center gap-3">
              <AirlineBadge airline={a.name} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.name}</span>
              <span className="shrink-0 text-sm text-slate-400">{a.flights} flight{a.flights === 1 ? '' : 's'} · {fmtHours(a.hours)} h</span>
            </li>
          ))}
        </ul>
      )}
    </CollapsibleStatCard>
  );
}
