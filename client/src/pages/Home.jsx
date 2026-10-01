import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plane, Zap, Luggage, Sparkles } from 'lucide-react';
import { api } from '../lib/api.js';
import { flightCodes } from '../lib/flightpath.js';
import ThemeToggle from '../components/ThemeToggle.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import WeatherDashboardCard from '../components/WeatherDashboardCard.jsx';
import AlertsStrip from '../components/AlertsStrip.jsx';
import RoleHeroCard from '../components/RoleHeroCard.jsx';
import RecentActivityList from '../components/RecentActivityList.jsx';
import { fmtHours } from '../lib/hours.js';
import { pickHeadline, pickSubline } from '../lib/greeting.js';
import {
  passengerCurrency, instrumentCurrency, flightReviewStatus, medicalCurrency, customExpirations,
  daysBetween, addDays, summarize,
} from '../lib/currency.js';
import { closestMilestone, completionsByKey } from '../lib/milestones.js';
import { pilotFlights, roleOf } from '../lib/flightRoles.js';
import { formatDate as fmtDate } from '../lib/calendar.js';
import { buildMapData } from '../lib/mapdata.js';
import { visitedCounts } from '../lib/mapstyle.js';
import { hoursByAirline } from '../lib/stats.js';
import { recentActivity } from '../lib/recentActivity.js';
import { homeHighlights } from '../lib/homeHighlights.js';
import { homeStatusAlerts } from '../lib/homeAlerts.js';

// The Map preview draws its own SVG (see MapPreviewCard.jsx) and never imports Leaflet/react-leaflet, but
// it's still code-split so its map-data computation only loads once Home actually renders it.
const MapPreviewCard = lazy(() => import('../components/MapPreviewCard.jsx'));

// Intentionally kept as "aerotrail-" (the app's old name) despite the AeroHub rename — changing a
// localStorage key would just lose everyone's existing stored value on upgrade, for no visible benefit.
const LAST_GREETING_KEY = 'aerotrail-last-greeting';
const getLastGreeting = () => { try { return localStorage.getItem(LAST_GREETING_KEY); } catch { return null; } };
const setLastGreeting = (template) => { try { localStorage.setItem(LAST_GREETING_KEY, template); } catch { /* private mode */ } };

const today = () => new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD
const newestFirst = (a, b) => b.date.localeCompare(a.date) || b.id - a.id;

// Picks the single most meaningful highlight to show on Home (a chip, not a list) — a completed milestone
// or a new country is a bigger deal than one more new airport or airline, so those sort first. This is
// purely a display-priority choice over facts lib/homeHighlights.js already computed; it never changes
// what counts as a highlight, only which one Home leads with.
const HIGHLIGHT_PRIORITY = { milestone: 0, countries: 1, longest: 2, airports: 3, airlines: 4 };
function topHighlightOf(highlights) {
  if (!highlights.length) return null;
  return [...highlights].sort((a, b) => (HIGHLIGHT_PRIORITY[a.id] ?? 9) - (HIGHLIGHT_PRIORITY[b.id] ?? 9))[0];
}

function AddFlightModal({ open, onClose }) {
  const navigate = useNavigate();
  return (
    <Modal open={open} onClose={onClose} title="Add flight">
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => navigate('/logbook/new')}
          className="pressable flex flex-col items-center gap-2 rounded-2xl border border-edge p-5 active:bg-navy-800">
          <Plane size={28} className="text-accent" />
          <span className="text-sm font-medium">Pilot</span>
        </button>
        <button type="button" onClick={() => navigate('/logbook/new?role=passenger&from=home')}
          className="pressable flex flex-col items-center gap-2 rounded-2xl border border-edge p-5 active:bg-navy-800">
          <Luggage size={28} className="text-[rgb(var(--role-pax))]" />
          <span className="text-sm font-medium">Passenger</span>
        </button>
      </div>
    </Modal>
  );
}

export default function Home() {
  const [flights, setFlights] = useState(null);
  const [airports, setAirports] = useState({});
  const [reviews, setReviews] = useState([]);
  const [expirations, setExpirations] = useState([]);
  const [milestonesConfig, setMilestonesConfig] = useState([]);
  const [milestoneCompletions, setMilestoneCompletions] = useState([]);
  const [aircraft, setAircraft] = useState([]);
  const [backupStatus, setBackupStatus] = useState(null);
  const [homeAirportIdent, setHomeAirportIdent] = useState(null);
  const [error, setError] = useState('');
  const [showAddFlight, setShowAddFlight] = useState(false);
  const now = today();

  // Picked once per mount (a fresh visit to Home), not on every re-render, and never repeats whatever was
  // shown last time.
  const [headline] = useState(() => {
    const picked = pickHeadline({ previous: getLastGreeting() });
    setLastGreeting(picked.template);
    return picked.text;
  });

  const load = useCallback(() => {
    setError('');
    (async () => {
      const [f, r, e, m, a, c, b, settings] = await Promise.all([
        api.listFlights(), api.listReviews(), api.listExpirations(), api.listMilestonesConfig(),
        api.listAircraft(true), api.listMilestoneCompletions(),
        api.backupJobStatus().catch(() => null),
        api.getSettings().catch(() => ({})),
      ]);
      const codes = [...new Set(f.flatMap(flightCodes))];
      const resolved = codes.length ? await api.resolveAirports(codes) : {};
      setFlights(f); setReviews(r); setExpirations(e); setMilestonesConfig(m); setAircraft(a);
      setMilestoneCompletions(c); setBackupStatus(b); setAirports(resolved);
      setHomeAirportIdent(settings.home_airport_ident || null);
    })().catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const pilotOnly = useMemo(() => pilotFlights(flights ?? []), [flights]);
  const passengerOnly = useMemo(() => (flights ?? []).filter((f) => roleOf(f) === 'passenger'), [flights]);

  // Pilot-only currency and hours — identical to the old Dashboard's numbers, never touched by the rest
  // of this page's all-role sections.
  const data = useMemo(() => {
    if (!flights) return null;
    return {
      pax: passengerCurrency(pilotOnly, now),
      inst: instrumentCurrency(pilotOnly, now),
      review: flightReviewStatus(reviews, now),
      medical: medicalCurrency(expirations, now),
      stats: summarize(pilotOnly, now),
    };
  }, [flights, pilotOnly, reviews, expirations, now]);

  const closest = useMemo(() => {
    if (!flights || !milestonesConfig.length) return null;
    const aircraftById = Object.fromEntries(aircraft.map((a) => [a.id, a]));
    return closestMilestone(milestonesConfig, pilotOnly, aircraftById, completionsByKey(milestoneCompletions));
  }, [flights, pilotOnly, milestonesConfig, aircraft, milestoneCompletions]);

  const lastPilotFlight = useMemo(() => (pilotOnly.length ? [...pilotOnly].sort(newestFirst)[0] : null), [pilotOnly]);

  // The greeting subline's own "it's been N days since your last flight" tier is intentionally suppressed
  // here (by passing null) — that fact now lives in just one place, the status line below, instead of
  // being shown twice. Closest-milestone progress is left out of the facts passed to pickSubline entirely
  // (not just one tier among others) — it's always visible in the Pilot hero's own note (`pilotNote`
  // below), so pickSubline no longer has a tier for it at all; see greeting.js. Every other tier (urgent
  // currency, unlinked-aircraft flights, a debrief note, a calm currency nudge, a plain stat) is untouched.
  const subline = useMemo(() => {
    if (!data || !flights) return null;
    const currencyItems = [
      { label: 'Day passenger currency', result: data.pax.day },
      { label: 'Night passenger currency', result: data.pax.night },
      { label: 'Instrument currency', result: data.inst },
      { label: 'Flight review', result: data.review },
      { label: 'Medical certificate', result: data.medical },
      ...customExpirations(expirations, now).map((r) => ({ label: r.item.label, result: r })),
    ];
    const reviewCount = pilotOnly.filter((f) => f.aircraft_id == null && daysBetween(f.date, now) >= 0 && daysBetween(f.date, now) <= 14).length;
    return pickSubline({
      currencyItems,
      hasFlights: pilotOnly.length > 0,
      daysSinceLastFlight: null,
      reviewCount,
      lastFlightWorkOn: lastPilotFlight?.debrief_work_on?.trim() || null,
      totalHoursThisYear: data.stats.year,
    });
  }, [data, flights, pilotOnly, expirations, lastPilotFlight, now]);

  // Home's single status line — see lib/homeAlerts.js for exactly which rules make something "need
  // attention" (narrower than the Currency page's own current/expiring/expired split, which still shows
  // everything in full).
  const status = useMemo(() => homeStatusAlerts({
    currencyResults: data ? [data.pax.day, data.pax.night, data.inst, data.review, data.medical] : [],
    expirations,
    backupWarn: Boolean(backupStatus?.warn),
    lastPilotFlightDate: lastPilotFlight?.date ?? null,
    today: now,
  }), [data, expirations, backupStatus, lastPilotFlight, now]);

  // Travel hero: must match the Travel page and Stats exactly, so it's built the same way TravelTab is —
  // buildMapData + visitedCounts + hoursByAirline over the passenger-only flight list.
  const passengerMapData = useMemo(() => buildMapData(passengerOnly, airports), [passengerOnly, airports]);
  const passengerCounts = useMemo(() => visitedCounts(passengerMapData.stops), [passengerMapData]);
  const passengerHours = useMemo(() => passengerOnly.reduce((s, f) => s + (Number(f.total_time) || 0), 0), [passengerOnly]);
  const topAirline = useMemo(() => hoursByAirline(passengerOnly)[0] ?? null, [passengerOnly]);

  const last12moHours = useMemo(() => {
    const cutoff = addDays(now, -365);
    return pilotOnly.filter((f) => f.date >= cutoff && f.date <= now).reduce((s, f) => s + (Number(f.total_time) || 0), 0);
  }, [pilotOnly, now]);

  const recentItems = useMemo(() => recentActivity(flights ?? [], 3), [flights]);
  const highlights = useMemo(
    () => (flights ? homeHighlights({ flights, airports, completions: milestoneCompletions, config: milestonesConfig, now }) : []),
    [flights, airports, milestoneCompletions, milestonesConfig, now],
  );
  const topHighlight = useMemo(() => topHighlightOf(highlights), [highlights]);

  const pilotNote = closest ? { text: `${Math.round(closest.percent)}% toward ${closest.label}`, to: '/milestones' } : null;

  return (
    <div className="stagger space-y-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          {/* Headlines are kept to one line's worth of characters (see greetings.js), but this is a
              safety net for narrow phones or a future long addition: shrink instead of wrapping or
              truncating with an ellipsis. */}
          <h1 className="whitespace-nowrap text-[clamp(1.125rem,6vw,1.5rem)] font-semibold">{headline}</h1>
          <p className="text-sm text-slate-400">{fmtDate(now)}</p>
          {subline && (
            <p className="mt-2 text-sm text-slate-300">
              {subline.text}
              {subline.action && (
                <Link to={subline.action.to} className="ml-2 font-medium text-accent-strong">{subline.action.label}</Link>
              )}
            </p>
          )}
        </div>
        <ThemeToggle />
      </div>

      {error && <ErrorNote message={error} onRetry={load} />}
      {!data && !error && (
        <>
          <Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" />
        </>
      )}

      {data && flights.length === 0 && (
        <section className="card card-elevated p-5 text-center">
          <Plane size={36} strokeWidth={1.5} className="mx-auto text-slate-600" />
          <h2 className="stat-title mt-3 text-lg">Welcome to AeroHub</h2>
          <p className="mt-1 text-sm text-slate-400">Log a flight or import a CSV and your currency status, hours and map fill in here.</p>
          <div className="mt-4 grid gap-2">
            <Button as={Link} to="/logbook/new" size="md">Add your first flight</Button>
            <Button as={Link} to="/logbook/data" size="md" variant="secondary">Import a CSV</Button>
          </div>
        </section>
      )}

      {data && flights.length > 0 && (
        <>
          <AlertsStrip count={status.count} to={status.to} />

          <div className="grid gap-3 md:grid-cols-2">
            <RoleHeroCard icon={Plane} title="Pilot" scopeLabel="pilot-only"
              bigValue={fmtHours(data.stats.total)} bigLabel="total hours"
              stats={[
                { label: 'Last 12 mo', value: fmtHours(last12moHours) },
                { label: 'This year', value: fmtHours(data.stats.year) },
              ]}
              note={pilotNote}
              to="/logbook" linkLabel="Open Logbook" />

            <RoleHeroCard scoped icon={Luggage} title="Travel" scopeLabel="passenger-only"
              bigValue={fmtHours(passengerHours)} bigLabel="passenger hours"
              stats={[
                { label: 'Flights', value: passengerOnly.length },
                { label: 'Airports', value: passengerCounts.airports },
                { label: 'Countries', value: passengerCounts.countries },
              ]}
              to="/travel" linkLabel="Open Passenger flights"
              note={topAirline ? `Top airline: ${topAirline.name} · ${fmtHours(topAirline.hours)}h` : null}
              empty={passengerOnly.length === 0 ? (
                <div className="text-center">
                  <p className="text-sm text-slate-400">No passenger flights yet — riding along, not flying? Log your first trip.</p>
                  <Button as={Link} to="/logbook/new?role=passenger&from=home" size="md" className="mt-3">Add passenger flight</Button>
                </div>
              ) : null} />
          </div>

          <Suspense fallback={<Skeleton className="h-28" />}>
            <MapPreviewCard flights={flights} airports={airports} homeAirportIdent={homeAirportIdent} />
          </Suspense>

          {recentItems.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-400">Recent activity</h2>
                <span className="flex gap-3 text-xs text-accent-strong">
                  <Link to="/logbook">See all logbook</Link><Link to="/travel">See all passenger</Link>
                </span>
              </div>
              <RecentActivityList items={recentItems} />
            </div>
          )}

          {topHighlight && (
            <div className="flex items-center gap-2 rounded-xl bg-navy-900 px-3 py-2.5 text-sm text-slate-300">
              <Sparkles size={15} className="shrink-0 text-accent" />{topHighlight.text}
            </div>
          )}

          <WeatherDashboardCard />

          {/* Map dropped (it's already both a bottom-nav tab and the whole map preview card above, one tap
              away) — Add flight and Quick log are each a real, otherwise-unreachable-in-one-tap entry
              point, so they keep the row instead of getting folded into something else. */}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setShowAddFlight(true)}
              className="pressable flex min-h-11 flex-col items-center gap-1.5 rounded-2xl border border-edge p-3 text-xs font-medium text-slate-300 active:bg-navy-800">
              <Plane size={20} className="text-accent" />Add flight
            </button>
            <Link to="/logbook/quick" className="pressable flex min-h-11 flex-col items-center gap-1.5 rounded-2xl border border-edge p-3 text-xs font-medium text-slate-300 active:bg-navy-800">
              <Zap size={20} className="text-accent" />Quick log
            </Link>
          </div>
        </>
      )}

      <AddFlightModal open={showAddFlight} onClose={() => setShowAddFlight(false)} />
    </div>
  );
}
