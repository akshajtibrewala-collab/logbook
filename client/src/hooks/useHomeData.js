import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { flightCodes } from '../lib/flightpath.js';
import { pickHeadline, pickSubline } from '../lib/greeting.js';
import {
  passengerCurrency, instrumentCurrency, flightReviewStatus, medicalCurrency, customExpirations,
  daysBetween, addDays, summarize,
} from '../lib/currency.js';
import { closestMilestone, completionsByKey } from '../lib/milestones.js';
import { pilotFlights, roleOf } from '../lib/flightRoles.js';
import { buildMapData, placeableMapData } from '../lib/mapdata.js';
import { visitedCounts } from '../lib/mapstyle.js';
import { hoursByAirline } from '../lib/stats.js';
import { recentActivity } from '../lib/recentActivity.js';
import { homeHighlights } from '../lib/homeHighlights.js';
import { homeStatusAlerts } from '../lib/homeAlerts.js';

// Everything Home shows, computed by the existing lib/ functions exactly as the pre-redesign Home did (this is that code,
// moved out of the page so the redesigned Home is presentation only). Pilot numbers are pilot-only; passenger numbers are
// built like the Passenger flights page, Stats and Map (buildMapData + visitedCounts + hoursByAirline over passenger flights).

// Intentionally kept as "aerotrail-" (the app's old name) despite the AeroHub rename — changing a
// localStorage key would just lose everyone's existing stored value on upgrade, for no visible benefit.
const LAST_GREETING_KEY = 'aerotrail-last-greeting';
const getLastGreeting = () => { try { return localStorage.getItem(LAST_GREETING_KEY); } catch { return null; } };
const setLastGreeting = (template) => { try { localStorage.setItem(LAST_GREETING_KEY, template); } catch { /* private mode */ } };

const today = () => new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD
const newestFirst = (a, b) => b.date.localeCompare(a.date) || b.id - a.id;

// Picks the single most meaningful highlight to show on Home (a chip, not a list). Purely a display-priority choice over
// facts lib/homeHighlights.js already computed; it never changes what counts as a highlight.
const HIGHLIGHT_PRIORITY = { milestone: 0, countries: 1, longest: 2, airports: 3, airlines: 4 };
function topHighlightOf(highlights) {
  if (!highlights.length) return null;
  return [...highlights].sort((a, b) => (HIGHLIGHT_PRIORITY[a.id] ?? 9) - (HIGHLIGHT_PRIORITY[b.id] ?? 9))[0];
}

export default function useHomeData() {
  const [flights, setFlights] = useState(null);
  const [airports, setAirports] = useState({});
  const [reviews, setReviews] = useState([]);
  const [expirations, setExpirations] = useState([]);
  const [milestonesConfig, setMilestonesConfig] = useState([]);
  const [milestoneCompletions, setMilestoneCompletions] = useState([]);
  const [aircraft, setAircraft] = useState([]);
  const [backupStatus, setBackupStatus] = useState(null);
  const [homeAirportIdent, setHomeAirportIdent] = useState(null);
  const [homeAirport, setHomeAirport] = useState(null); // { lat, lon, label } for the Home map's anchor
  const [error, setError] = useState('');
  const now = today();

  // Picked once per mount (a fresh visit to Home), not on every re-render, and never repeats whatever was shown last time.
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
      const hc = settings.home_airport_ident;
      if (hc) { // a separate read-only lookup, so the flight-derived airport map above is untouched
        api.resolveAirports([hc]).then((r) => {
          const a = Object.values(r || {})[0];
          setHomeAirport(a && Number.isFinite(a.lat) && Number.isFinite(a.lon) ? { lat: a.lat, lon: a.lon, label: String(hc).toUpperCase() } : null);
        }).catch(() => setHomeAirport(null));
      } else setHomeAirport(null);
    })().catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const pilotOnly = useMemo(() => pilotFlights(flights ?? []), [flights]);
  const passengerOnly = useMemo(() => (flights ?? []).filter((f) => roleOf(f) === 'passenger'), [flights]);

  // Pilot-only currency and hours — identical to the old Dashboard's numbers, never touched by the all-role sections.
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

  // The greeting subline's own "days since your last flight" tier stays suppressed (null) and closest-milestone progress is
  // not passed in — both live elsewhere on Home (see greeting.js).
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

  // Home's single status line — see lib/homeAlerts.js for exactly which rules make something "need attention".
  const status = useMemo(() => homeStatusAlerts({
    currencyResults: data ? [data.pax.day, data.pax.night, data.inst, data.review, data.medical] : [],
    expirations,
    backupWarn: Boolean(backupStatus?.warn),
    lastPilotFlightDate: lastPilotFlight?.date ?? null,
    today: now,
  }), [data, expirations, backupStatus, lastPilotFlight, now]);

  // Travel numbers must match the Travel page and Stats exactly, so they are built the same way TravelTab is.
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

  // The map behind the glass: the same placeable all-role data the old preview drew (pilot solid, passenger violet).
  const map = useMemo(() => {
    if (!flights) return null;
    const all = placeableMapData(buildMapData(flights, airports));
    const pilot = placeableMapData(buildMapData(pilotOnly, airports));
    const pax = placeableMapData(buildMapData(passengerOnly, airports));
    return {
      stops: all.stops.map((s) => ({ lat: s.lat, lon: s.lon })),
      routes: [
        ...pax.routes.map((r) => ({ a: r.a, b: r.b, role: 'passenger' })),
        ...pilot.routes.map((r) => ({ a: r.a, b: r.b, role: 'pilot' })),
      ],
      totalDistanceNm: all.totalDistanceNm,
      omittedFlightCount: all.omittedFlightCount,
    };
  }, [flights, airports, pilotOnly, passengerOnly]);

  return {
    flights, airports, error, load, now, headline, data, subline, status, homeAirportIdent, homeAirport,
    pilotOnly, passengerOnly, passengerCounts, passengerHours, topAirline, last12moHours,
    recentItems, topHighlight, pilotNote, map,
    milestonesConfig, aircraft, milestoneCompletions,
  };
}
