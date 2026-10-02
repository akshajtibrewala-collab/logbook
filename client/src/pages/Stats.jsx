import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
// Only the long "Places & aircraft" label ever needs a short fallback at narrow widths or large text.
const SHORT_LABEL = { places: 'Places' };

/** A tab button that swaps to its short label (measured, not guessed) when the full one wouldn't fit. */
function TabButton({ tabKey, label, active, onClick }) {
  const labelRef = useRef(null);
  const measureRef = useRef(null);
  const shortLabel = SHORT_LABEL[tabKey];
  const [short, setShort] = useState(false);

  useLayoutEffect(() => {
    if (!shortLabel) return;
    const visible = labelRef.current;
    const measure = measureRef.current;
    if (!visible || !measure) return;
    // Compare against the visible label's own (already padding-adjusted) width, not the button's.
    const check = () => setShort(measure.scrollWidth > visible.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(visible);
    return () => ro.disconnect();
  }, [shortLabel, label]);

  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick}
      className={`pressable relative h-11 flex-1 overflow-hidden rounded-xl px-2 text-sm font-medium shadow-sm transition-all ${active ? ACTIVE_TAB_STYLE[tabKey] : 'text-slate-400 hover:text-slate-300 shadow-none'}`}>
      <span ref={labelRef} className="block truncate">{shortLabel && short ? shortLabel : label}</span>
      {shortLabel && <span ref={measureRef} aria-hidden="true" className="invisible absolute left-0 top-0 whitespace-nowrap">{label}</span>}
    </button>
  );
}

// Each tab's active pill is tinted with its role color, so which section you're in reads at a glance —
// Places mixes both roles and deliberately stays neutral rather than picking a side.
const ACTIVE_TAB_STYLE = { pilot: 'bg-accent text-ink', travel: `bg-[rgb(var(--role-pax))] text-ink`, places: 'bg-navy-700 text-slate-100' };

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
          <div className="sticky top-0 z-20 -mx-4 bg-navy-950/90 px-4 pb-3 pt-1 shadow-[0_8px_12px_-8px_rgba(0,0,0,0.35)] backdrop-blur-xl md:static md:mx-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
            <div className="flex gap-1 rounded-2xl border border-edge bg-navy-950/60 p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]" role="tablist" aria-label="Stats section">
              {TABS.map(([k, l]) => (
                <TabButton key={k} tabKey={k} label={l} active={tab === k} onClick={() => setTab(k)} />
              ))}
            </div>
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
