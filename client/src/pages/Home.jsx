import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plane, Gauge, ClipboardCheck, HeartPulse, ChevronRight, GraduationCap, Zap, Luggage, MapPin } from 'lucide-react';
import { api } from '../lib/api.js';
import { flightCodes } from '../lib/flightpath.js';
import ThemeToggle from '../components/ThemeToggle.jsx';
import DatePicker from '../components/DatePicker.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import CurrencyStatusCard, { TONE, daysText } from '../components/CurrencyStatusCard.jsx';
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

function Stat({ label, value }) {
  return (
    <div className="card card-elevated p-3 text-center md:p-4">
      <div className="stat-value text-xl md:text-2xl">{fmtHours(value)}</div>
      <div className="mt-0.5 text-xs text-slate-400">{label}</div>
    </div>
  );
}

/** One currency item, already known to be current: a single calm row instead of a full status card. */
function CompactCurrencyRow({ title, result }) {
  const days = daysText(result);
  return (
    <div className="flex items-center justify-between rounded-xl bg-navy-900 px-3 py-2.5 text-sm">
      <span className="flex items-center gap-2 text-slate-300">
        <TONE.current.Icon size={15} className="text-ok" />{title}
      </span>
      <span className="text-xs text-slate-400">{days.big} {days.small}</span>
    </div>
  );
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
  const [groundSessions, setGroundSessions] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [expirations, setExpirations] = useState([]);
  const [milestonesConfig, setMilestonesConfig] = useState([]);
  const [milestoneCompletions, setMilestoneCompletions] = useState([]);
  const [aircraft, setAircraft] = useState([]);
  const [backupStatus, setBackupStatus] = useState(null);
  const [error, setError] = useState('');
  const [reviewDate, setReviewDate] = useState(today);
  const [logging, setLogging] = useState(false);
  const [editingId, setEditingId] = useState(null); // id of the review being re-dated, or null when adding
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
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
      const [f, r, e, m, a, g, c, b] = await Promise.all([
        api.listFlights(), api.listReviews(), api.listExpirations(), api.listMilestonesConfig(),
        api.listAircraft(true), api.listGroundSessions(), api.listMilestoneCompletions(),
        api.backupJobStatus().catch(() => null),
      ]);
      const codes = [...new Set(f.flatMap(flightCodes))];
      const resolved = codes.length ? await api.resolveAirports(codes) : {};
      setFlights(f); setReviews(r); setExpirations(e); setMilestonesConfig(m); setAircraft(a);
      setGroundSessions(g); setMilestoneCompletions(c); setBackupStatus(b); setAirports(resolved);
    })().catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const pilotOnly = useMemo(() => pilotFlights(flights ?? []), [flights]);
  const passengerOnly = useMemo(() => (flights ?? []).filter((f) => roleOf(f) === 'passenger'), [flights]);

  // Total ground training hours: ground instruction logged with a flight, plus ground-only sessions —
  // the same total the cost tracker bills at the ground rate, shown here regardless of cost tracking.
  // Pilot-only: a passenger flight always has ground_time forced to 0 (see validate.js), but
  // filtering explicitly here keeps this in step with every other logbook-time total on this page.
  const totalGroundHours = useMemo(() => {
    if (!flights) return 0;
    const flightGround = pilotOnly.reduce((s, f) => s + (Number(f.ground_time) || 0), 0);
    const groundOnly = groundSessions.reduce((s, g) => s + (Number(g.hours) || 0), 0);
    return flightGround + groundOnly;
  }, [flights, pilotOnly, groundSessions]);

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
    const lastFlight = pilotOnly.length ? [...pilotOnly].sort(newestFirst)[0] : null;
    const reviewCount = pilotOnly.filter((f) => f.aircraft_id == null && daysBetween(f.date, now) >= 0 && daysBetween(f.date, now) <= 14).length;
    return pickSubline({
      currencyItems,
      hasFlights: pilotOnly.length > 0,
      daysSinceLastFlight: lastFlight ? daysBetween(lastFlight.date, now) : null,
      reviewCount,
      lastFlightWorkOn: lastFlight?.debrief_work_on?.trim() || null,
      closestMilestone: closest,
      totalHoursThisYear: data.stats.year,
    });
  }, [data, flights, pilotOnly, expirations, closest, now]);

  // Alerts strip: everything that genuinely needs attention, each linking straight to where it's fixed.
  // Flight review and medical are already covered generically as currency items — "days since last pilot
  // flight" is the one condition with no currency-item equivalent, using the same 7-day threshold the
  // greeting subline already uses for its own "it's been a while" nudge, so the two never disagree.
  const alerts = useMemo(() => {
    if (!data) return [];
    const list = [];
    if (backupStatus?.warn) list.push({ text: backupStatus.message, to: '/logbook/data', tone: 'warn' });
    const checks = [
      ['Passenger currency (day)', data.pax.day], ['Passenger currency (night)', data.pax.night],
      ['Instrument currency', data.inst], ['Flight review', data.review], ['Medical certificate', data.medical],
    ];
    for (const [label, result] of checks) {
      if (result.status === 'expired') list.push({ text: `${label}: not current`, to: '/currency', tone: 'bad' });
      else if (result.status === 'expiring') list.push({ text: `${label}: expiring soon`, to: '/currency', tone: 'warn' });
    }
    for (const r of customExpirations(expirations, now)) {
      if (r.status !== 'current') list.push({ text: `${r.item.label}: ${r.status === 'expired' ? 'not current' : 'expiring soon'}`, to: '/currency', tone: r.status === 'expired' ? 'bad' : 'warn' });
    }
    const lastPilotFlight = pilotOnly.length ? [...pilotOnly].sort(newestFirst)[0] : null;
    const daysSince = lastPilotFlight ? daysBetween(lastPilotFlight.date, now) : null;
    if (daysSince !== null && daysSince >= 7) list.push({ text: `${daysSince} day${daysSince === 1 ? '' : 's'} since your last pilot flight`, to: '/logbook/new', tone: 'warn' });
    return list;
  }, [data, backupStatus, expirations, pilotOnly, now]);

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

  const notCurrentCount = data ? [data.pax.day, data.pax.night, data.inst, data.review, data.medical].filter((r) => r.status !== 'current').length : 0;
  const currencySummary = notCurrentCount === 0 ? 'All current' : `${notCurrentCount} of 5`;
  const currencySummaryLabel = notCurrentCount === 0 ? 'currency' : `need${notCurrentCount === 1 ? 's' : ''} attention`;

  const recentItems = useMemo(() => recentActivity(flights ?? [], 6), [flights]);
  const highlights = useMemo(
    () => (flights ? homeHighlights({ flights, airports, completions: milestoneCompletions, config: milestonesConfig, now }) : []),
    [flights, airports, milestoneCompletions, milestonesConfig, now],
  );

  const currencyRows = data ? [
    { key: 'paxDay', title: 'Passenger currency (day)', Icon: Plane, result: data.pax.day, detail: `${data.pax.day.count} of 3 landings in the last 90 days` },
    { key: 'paxNight', title: 'Passenger currency (night)', Icon: Plane, result: data.pax.night, detail: `${data.pax.night.count} of 3 landings in the last 90 days` },
    { key: 'inst', title: 'Instrument currency', Icon: Gauge, result: data.inst, detail: `${data.inst.approaches}/${data.inst.requiredApproaches} approaches · ${data.inst.holds}/${data.inst.requiredHolds} hold in 6 months` },
    { key: 'medical', title: 'Medical certificate', Icon: HeartPulse, result: data.medical, detail: data.medical.item ? data.medical.item.label : 'No medical certificate logged' },
  ] : [];
  const attentionRows = currencyRows.filter((r) => r.result.status !== 'current');
  const healthyRows = currencyRows.filter((r) => r.result.status === 'current');

  function startAdd() { setEditingId(null); setReviewDate(today()); setLogging(true); }
  function startEdit() { setEditingId(reviews[0].id); setReviewDate(reviews[0].date); setLogging(true); }
  function cancelReview() { setLogging(false); setEditingId(null); }

  async function logReview(e) {
    e.preventDefault();
    try {
      const saved = editingId ? await api.updateReview(editingId, reviewDate) : await api.addReview(reviewDate);
      setReviews((rs) => [saved, ...rs.filter((r) => r.id !== saved.id)].sort(newestFirst));
      cancelReview();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeReview() {
    setRemoving(true);
    try {
      await api.deleteReview(reviews[0].id);
      setReviews((rs) => rs.slice(1));
      setConfirmRemove(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setRemoving(false);
    }
  }

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
          <AlertsStrip alerts={alerts} />

          <div className="grid gap-3 md:grid-cols-2">
            <RoleHeroCard icon={Plane} title="Pilot" scopeLabel="pilot-only"
              bigValue={fmtHours(data.stats.total)} bigLabel="total hours"
              stats={[
                { label: 'Last 12 mo', value: fmtHours(last12moHours) },
                { label: currencySummaryLabel, value: currencySummary },
                { label: 'This year', value: fmtHours(data.stats.year) },
              ]}
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

          <Suspense fallback={<Skeleton className="h-48" />}>
            <MapPreviewCard flights={flights} airports={airports} />
          </Suspense>

          {recentItems.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-400">Recent activity</h2>
                <span className="flex gap-3 text-xs text-accent-strong">
                  <Link to="/logbook">Logbook</Link><Link to="/travel">Passenger</Link>
                </span>
              </div>
              <RecentActivityList items={recentItems} />
            </div>
          )}

          {highlights.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-medium text-slate-400">Highlights</h2>
              <ul className="space-y-1.5">
                {highlights.map((h) => (
                  <li key={h.id} className="flex items-center gap-2 rounded-xl bg-navy-900 px-3 py-2.5 text-sm text-slate-300">
                    <MapPin size={15} className="shrink-0 text-accent" />{h.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {closest && (
            <Link to="/milestones" className="flex items-center gap-3 rounded-xl bg-navy-900 px-3 py-2.5 active:opacity-70">
              <GraduationCap size={18} className="shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate">{closest.label} · {closest.certificateLabel}</span>
                  <span className="shrink-0 text-xs text-slate-400">{Math.round(closest.percent)}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-navy-800">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${closest.percent}%` }} />
                </div>
              </div>
              <ChevronRight size={16} className="shrink-0 text-slate-500" />
            </Link>
          )}

          {totalGroundHours > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-medium text-slate-400">Ground training</h2>
              <div className="grid grid-cols-3 gap-3 md:gap-4">
                <Stat label="Total hours" value={totalGroundHours} />
              </div>
            </div>
          )}

          <WeatherDashboardCard />

          <div className="space-y-2">
            {attentionRows.map((r) => (
              <CurrencyStatusCard key={r.key} title={r.title} Icon={r.Icon} result={r.result} detail={r.detail}>
                {r.key === 'paxDay' && (
                  <div className={`flex items-center justify-between rounded-xl bg-navy-800 px-3 py-2 text-sm ${TONE[data.pax.night.status].textStrong}`}>
                    <span>Night</span>
                    <span>{data.pax.night.daysRemaining === null ? 'Not current'
                      : data.pax.night.daysRemaining < 0 ? `Lapsed ${-data.pax.night.daysRemaining}d ago`
                      : `${data.pax.night.daysRemaining} days left`}</span>
                  </div>
                )}
              </CurrencyStatusCard>
            ))}

            <CurrencyStatusCard title="Flight review" Icon={ClipboardCheck} result={data.review}
              detail={data.review.lastReview ? `Last review ${fmtDate(data.review.lastReview)} · due ${fmtDate(data.review.expires)}` : 'No flight review logged'}>
              {logging ? (
                <form onSubmit={logReview} className="space-y-2">
                  <DatePicker label={editingId ? 'Change review date' : 'Flight review date'} value={reviewDate} onChange={setReviewDate} />
                  <div className="flex gap-2">
                    <Button size="md" fullWidth={false} className="flex-1">Save</Button>
                    <Button type="button" variant="ghost" size="md" fullWidth={false} onClick={cancelReview}>Cancel</Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-1">
                  <Button variant="secondary" size="md" onClick={startAdd}>Log a flight review</Button>
                  {reviews.length > 0 && (
                    <div className="flex justify-center gap-2 text-sm">
                      <Button variant="ghost" size="sm" fullWidth={false} onClick={startEdit}>Change date</Button>
                      <Button variant="danger" size="sm" fullWidth={false} onClick={() => setConfirmRemove(true)}>Remove</Button>
                    </div>
                  )}
                </div>
              )}
            </CurrencyStatusCard>

            {healthyRows.map((r) => <CompactCurrencyRow key={r.key} title={r.title} result={r.result} />)}
          </div>

          <Link to="/currency" className="flex items-center justify-between rounded-xl px-1 py-1 text-sm text-accent-strong active:opacity-70">
            See all currency & expirations<ChevronRight size={16} />
          </Link>

          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setShowAddFlight(true)}
              className="pressable flex flex-col items-center gap-1.5 rounded-2xl border border-edge p-3 text-xs font-medium text-slate-300 active:bg-navy-800">
              <Plane size={20} className="text-accent" />Add flight
            </button>
            <Link to="/logbook/quick" className="pressable flex flex-col items-center gap-1.5 rounded-2xl border border-edge p-3 text-xs font-medium text-slate-300 active:bg-navy-800">
              <Zap size={20} className="text-accent" />Quick log
            </Link>
            <Link to="/map" className="pressable flex flex-col items-center gap-1.5 rounded-2xl border border-edge p-3 text-xs font-medium text-slate-300 active:bg-navy-800">
              <MapPin size={20} className="text-accent" />Map
            </Link>
          </div>
        </>
      )}

      <AddFlightModal open={showAddFlight} onClose={() => setShowAddFlight(false)} />
      <ConfirmDialog open={confirmRemove} title="Remove flight review?"
        description="This removes your most recently logged flight review. This cannot be undone."
        confirmLabel="Remove" busy={removing} onConfirm={removeReview} onClose={() => setConfirmRemove(false)} />
    </div>
  );
}
