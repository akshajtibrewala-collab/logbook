import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { api } from '../lib/api.js';
import { flightCodes } from '../lib/flightpath.js';
import { pilotFlights, roleOf } from '../lib/flightRoles.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import PilotTab from './stats/PilotTab.jsx';
import TravelTab from './stats/TravelTab.jsx';
import PlacesTab from './stats/PlacesTab.jsx';
import RoleFilter from './stats/RoleFilter.jsx';

const TABS = [
  ['pilot', 'Pilot'],
  ['travel', 'Travel'],
  ['places', 'Places & aircraft'],
];

const SCOPE_LABEL = { all: 'All flights — every role.', pilot: 'Pilot flights only.', passenger: 'Passenger flights only.' };

export default function Stats() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'pilot';
  const setTab = (k) => setParams((p) => { p.set('tab', k); return p; }, { replace: true });

  const [placesRole, setPlacesRole] = useState('all');
  const [flights, setFlights] = useState(null);
  const [airports, setAirports] = useState({});
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(null);

  // The pilot settings PUT replaces the whole row, so a target change sends the current settings back with it.
  async function saveTarget(patch) {
    const saved = await api.updateSettings({ ...settings, ...patch });
    setSettings(saved);
  }

  const load = useCallback(() => {
    setError('');
    (async () => {
      api.getSettings().then(setSettings).catch(() => {});
      const list = await api.listFlights();
      const codes = [...new Set(list.flatMap(flightCodes))];
      setAirports(codes.length ? await api.resolveAirports(codes) : {});
      setFlights(list);
    })().catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const pilotOnly = useMemo(() => pilotFlights(flights ?? []), [flights]);
  const passengerOnly = useMemo(() => (flights ?? []).filter((f) => roleOf(f) === 'passenger'), [flights]);

  const scopeLabel = tab === 'pilot' ? 'Pilot flights only.' : tab === 'travel' ? 'Passenger flights only.' : SCOPE_LABEL[placesRole];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Stats</h1>
      {error && <ErrorNote message={error} onRetry={load} />}

      {!flights && !error && (
        <>
          <Skeleton className="h-72" /><Skeleton className="h-52" /><Skeleton className="h-52" />
        </>
      )}

      {flights && flights.length === 0 && (
        <div className="mt-16 text-center text-slate-400">
          <BarChart3 size={40} strokeWidth={1.5} className="mx-auto text-slate-600" />
          <p className="mt-3">No stats yet.</p>
          <p className="text-sm">Log a few flights and charts will appear here.</p>
        </div>
      )}

      {flights && flights.length > 0 && (
        <>
          <div className="flex gap-1 rounded-xl bg-navy-800 p-1" role="tablist" aria-label="Stats section">
            {TABS.map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`h-11 flex-1 rounded-lg text-sm font-medium transition-colors ${tab === k ? 'bg-accent text-ink' : 'text-slate-400'}`}>{l}</button>
            ))}
          </div>
          <p className="text-xs text-slate-500">{scopeLabel}</p>
          {tab === 'places' && <RoleFilter value={placesRole} onChange={setPlacesRole} />}

          {tab === 'pilot' && <PilotTab pilotFlights={pilotOnly} settings={settings} onSaveTarget={saveTarget} />}
          {tab === 'travel' && <TravelTab passengerFlights={passengerOnly} airports={airports} />}
          {tab === 'places' && <PlacesTab flights={flights} airports={airports} roleFilter={placesRole} />}
        </>
      )}
    </div>
  );
}
