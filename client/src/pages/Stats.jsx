import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { api } from '../lib/api.js';
import { flightCodes } from '../lib/flightpath.js';
import { pilotFlights, roleOf } from '../lib/flightRoles.js';
import ErrorNote from '../components/ErrorNote.jsx';
import { MnEmpty, MnSkeleton } from '../components/mn/Mn.jsx';
import { Segmented } from '../ds/Controls.jsx';
import PilotTab from './stats/PilotTab.jsx';
import TravelTab from './stats/TravelTab.jsx';
import PlacesTab from './stats/PlacesTab.jsx';
import '../ds/bcalm.css';

const TABS = [
  { value: 'pilot', label: 'Pilot', role: 'pilot' },
  { value: 'travel', label: 'Travel', role: 'pax' },
  { value: 'places', label: 'Places', role: 'clear' },
];
const ROLES = [{ value: 'all', label: 'All' }, { value: 'pilot', label: 'Pilot' }, { value: 'passenger', label: 'Passenger' }];

/**
 * Stats (B-calm): a role-scoped figure per tab (Pilot, Travel = passenger, Places = either or both with a role filter), then flat chart sections.
 * The top bar owns the title; the three tabs are one segmented control; each tab says which flights it counts in one word.
 */
export default function Stats() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'pilot';
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

  return (
    <div className="cl bc">
      {error && <ErrorNote message={error} onRetry={load} />}
      {!flights && !error && <MnSkeleton />}
      {flights && flights.length === 0 && <MnEmpty title="No stats yet" icon={<BarChart3 />} />}

      {flights && flights.length > 0 && (
        <>
          <div className="bc-ctl">
            <Segmented label="Stats section" options={TABS} value={tab} onChange={setTab} />
          </div>
          {tab === 'places' && <div className="bc-ctl"><Segmented label="Filter by role" scope="pilot" options={ROLES} value={placesRole} onChange={setPlacesRole} /></div>}

          {tab === 'pilot' && <PilotTab pilotFlights={pilotOnly} settings={settings} onSaveTarget={saveTarget} />}
          {tab === 'travel' && <TravelTab passengerFlights={passengerOnly} airports={airports} />}
          {tab === 'places' && <PlacesTab flights={flights} airports={airports} roleFilter={placesRole} />}
        </>
      )}
    </div>
  );
}
