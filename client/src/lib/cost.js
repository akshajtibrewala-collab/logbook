// Pure training-cost calculations. Rates are effective-dated (never "the current rate") so an old
// flight's cost doesn't change retroactively when a rate is edited later — every lookup picks the latest
// rate row with effective_date <= the date in question. Rates also belong to one training phase each (its
// own certificate): a flight or ground session only gets a calculated cost when its date falls inside a
// phase that has cost tracking on, using *that phase's own* rates — never a different phase's, and never
// a global "current rate". This is what makes ending a phase (setting its end_date) freeze its totals: a
// later rate change is a new row under a different phase's certificate and can never reach into a phase
// that's already closed. Nothing here talks to the API.

import { addDays, daysBetween } from './currency.js';
import { formatDate } from './calendar.js';

const round2 = (n) => Math.round(n * 100) / 100;

export const fmtMoney = (n) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Cost tracking is meant to cover training only. The pilot can set a cutoff calendar day (e.g. the
// commercial certificate date, `pilot_settings.cost_cutoff_date`); flights and ground sessions dated ON OR
// AFTER it are left out of every cost total. It travels on the rates object (`rates.cost_cutoff_date`,
// added by fetchAllRates), which every cost function already receives. Dates are compared as plain
// YYYY-MM-DD strings — calendar days, never timestamps — so no time zone can move a flight across the line.
// The flight's stored cost fields are never touched; they're just not counted.

/** True when `date` is on or after a set cutoff. No cutoff (empty/null) means never. */
export const isPastCostCutoff = (date, cutoff) => Boolean(cutoff) && Boolean(date) && String(date).slice(0, 10) >= cutoff;

/** The calendar day before `iso` (YYYY-MM-DD), by pure UTC date arithmetic. */
export function dayBefore(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** The note shown next to cost totals when a cutoff is set (else ''): "Costs counted through 06/14/2026 …". */
export function costCutoffNote(cutoff) {
  if (!cutoff) return '';
  return `Costs counted through ${formatDate(dayBefore(cutoff))} — flights and ground sessions from ${formatDate(cutoff)} on aren't included.`;
}

/**
 * The flights and ground sessions that count toward costs: everything dated before the cutoff (all of them
 * when there is no cutoff). Used for cost per hour, averages, pace and projections, so hours flown after the
 * cutoff don't dilute or skew them. Everything else in the app keeps using the full lists.
 */
export function entriesCountedForCost(flights, groundSessions, cutoff) {
  return {
    flights: flights.filter((f) => !isPastCostCutoff(f.date, cutoff)),
    groundSessions: groundSessions.filter((g) => !isPastCostCutoff(g.date, cutoff)),
  };
}

const EXCLUDED = { total: null, computedTotal: null, tracked: false, override: false, missingRate: false, breakdown: null, excluded: true };

/** The latest rate row from `rates` with effective_date <= date, or null if none applies yet. */
export function pickRate(rates, date) {
  let best = null;
  for (const r of rates) {
    if (r.effective_date > date) continue;
    if (!best || r.effective_date > best.effective_date) best = r;
  }
  return best;
}

/**
 * Which training phase (if any) covers `date` — the phase whose [start_date, end_date] range contains it,
 * end_date null meaning still open. Phases aren't expected to overlap (one certificate is being actively
 * trained at a time), so the first match is taken.
 */
export function findPhaseForDate(phases, date) {
  return (phases ?? []).find((p) => p.start_date <= date && (!p.end_date || date <= p.end_date)) ?? null;
}

/** Narrows a full rates bundle down to just one training phase's own rate history. */
function ratesForCertificate(rates, certificate) {
  const { aircraft_rates = [], instructor_rates = [], ground_rates = [], simulator_rates = [] } = rates ?? {};
  return {
    aircraft_rates: aircraft_rates.filter((r) => r.certificate === certificate),
    instructor_rates: instructor_rates.filter((r) => r.certificate === certificate),
    ground_rates: ground_rates.filter((r) => r.certificate === certificate),
    simulator_rates: simulator_rates.filter((r) => r.certificate === certificate),
  };
}

const hasValue = (v) => v !== null && v !== undefined && v !== '';

/**
 * A flight's cost breakdown from its own hours (aircraft time, simulator time, dual received, ground
 * instruction) and whichever rates were in effect, in the training phase covering the flight's date, on
 * that date. Aircraft rental + fuel surcharge apply to `total_time` (aircraft hours); simulator time is
 * billed separately at the simulator rate, not the aircraft rate, since it's not the same aircraft.
 * Instructor cost only applies when `dual_received` is logged.
 *
 * `cost_override`, when set, replaces the total outright and always applies — even for a flight whose date
 * falls outside any cost-tracked phase, so a one-off cost can still be recorded there. Without an override,
 * a flight outside a tracked phase gets `total: null` (not 0) and `tracked: false`: it has no calculated
 * cost at all, and callers should exclude it from totals/projections rather than treat it as free.
 */
export function computeFlightCost(flight, rates, phases) {
  if (isPastCostCutoff(flight.date, rates?.cost_cutoff_date)) return EXCLUDED;
  const phase = findPhaseForDate(phases, flight.date);
  const tracked = Boolean(phase?.track_costs);
  const hasOverride = hasValue(flight.cost_override);

  if (!tracked) {
    return {
      total: hasOverride ? round2(Number(flight.cost_override)) : null,
      computedTotal: null, tracked: hasOverride, override: hasOverride, missingRate: false, breakdown: null,
    };
  }

  const { aircraft_rates, instructor_rates, ground_rates, simulator_rates } = ratesForCertificate(rates, phase.certificate);
  const date = flight.date;
  const aircraftRate = flight.aircraft_id != null
    ? pickRate(aircraft_rates.filter((r) => r.aircraft_id === flight.aircraft_id), date)
    : null;
  const instructorRate = pickRate(instructor_rates, date);
  const groundRate = pickRate(ground_rates, date);
  const simulatorRate = pickRate(simulator_rates, date);

  const aircraftHours = Number(flight.total_time) || 0;
  const simHours = Number(flight.simulator_time) || 0;
  const dualHours = Number(flight.dual_received) || 0;
  const groundHours = Number(flight.ground_time) || 0;

  const rentalCost = aircraftHours > 0 && aircraftRate ? aircraftHours * aircraftRate.rental_rate_per_hr : 0;
  const fuelCost = aircraftHours > 0 && aircraftRate ? aircraftHours * aircraftRate.fuel_surcharge_per_hr : 0;
  const simCost = simHours > 0 && simulatorRate ? simHours * simulatorRate.hourly_rate : 0;
  const instructorCost = dualHours > 0 && instructorRate ? dualHours * instructorRate.hourly_rate : 0;
  const groundCost = groundHours > 0 && groundRate ? groundHours * groundRate.hourly_rate : 0;

  const computedTotal = round2(rentalCost + fuelCost + simCost + instructorCost + groundCost);
  const missingRate = (aircraftHours > 0 && !aircraftRate) || (simHours > 0 && !simulatorRate) ||
    (dualHours > 0 && !instructorRate) || (groundHours > 0 && !groundRate);

  return {
    total: hasOverride ? round2(Number(flight.cost_override)) : computedTotal,
    computedTotal, tracked: true, override: hasOverride, missingRate,
    breakdown: {
      rentalCost: round2(rentalCost), fuelCost: round2(fuelCost), simCost: round2(simCost),
      instructorCost: round2(instructorCost), groundCost: round2(groundCost),
    },
  };
}

/**
 * A ground-only session's cost: same phase-gating and override contract as computeFlightCost, just with
 * one rate (hours x the ground rate in effect, in the phase covering the session's date).
 */
export function computeGroundSessionCost(session, rates, phases) {
  if (isPastCostCutoff(session.date, rates?.cost_cutoff_date)) return EXCLUDED;
  const phase = findPhaseForDate(phases, session.date);
  const tracked = Boolean(phase?.track_costs);
  const hasOverride = hasValue(session.cost_override);

  if (!tracked) {
    return { total: hasOverride ? round2(Number(session.cost_override)) : null, computedTotal: null, tracked: hasOverride, override: hasOverride, missingRate: false };
  }

  const { ground_rates } = ratesForCertificate(rates, phase.certificate);
  const rate = pickRate(ground_rates, session.date);
  const hours = Number(session.hours) || 0;
  const computedTotal = hours > 0 && rate ? round2(hours * rate.hourly_rate) : 0;
  return {
    total: hasOverride ? round2(Number(session.cost_override)) : computedTotal,
    computedTotal, tracked: true, override: hasOverride, missingRate: hours > 0 && !rate,
  };
}

const inRange = (date, from, to) => (!from || date >= from) && (!to || date <= to);

/**
 * Total spent across flights, ground-only sessions, and other expenses within an optional [from, to].
 * Entries with no calculated cost (outside any cost-tracked phase, no override) simply don't contribute —
 * they're excluded, not counted as $0.
 */
export function totalSpent(flights, groundSessions, expenses, rates, phases, { from, to } = {}) {
  let total = 0;
  for (const f of flights) {
    if (!inRange(f.date, from, to)) continue;
    const c = computeFlightCost(f, rates, phases);
    if (c.total !== null) total += c.total;
  }
  for (const s of groundSessions) {
    if (!inRange(s.date, from, to)) continue;
    const c = computeGroundSessionCost(s, rates, phases);
    if (c.total !== null) total += c.total;
  }
  for (const e of expenses) if (inRange(e.date, from, to)) total += Number(e.amount) || 0;
  return round2(total);
}

/**
 * Spend per certificate, using each certificate's own training-phase date range rather than which
 * milestones a flight's hours satisfy — a flight's hours often count toward more than one certificate's
 * requirements, but the flight itself only happened during one phase of training. A phase with no
 * end_date is still open, so it runs through `today`; an ended phase's total is a permanent record (its
 * own rates never change after the fact, so recomputing it later gives the same number).
 */
export function spentPerCertificate(phases, flights, groundSessions, expenses, rates, today) {
  const out = {};
  for (const phase of phases) {
    out[phase.certificate] = totalSpent(flights, groundSessions, expenses, rates, phases, { from: phase.start_date, to: phase.end_date || today });
  }
  return out;
}

/**
 * Total spent (everything: lessons, ground sessions, expenses) divided by every flight hour logged —
 * a physical measure, so it counts all flights regardless of cost tracking.
 */
export function spentPerFlightHour(total, flights) {
  const hours = flights.reduce((s, f) => s + (Number(f.total_time) || 0) + (Number(f.simulator_time) || 0), 0);
  return hours > 0 ? round2(total / hours) : 0;
}

// The one manual/count requirement with an hour amount in its own wording ("3 hours of flight training
// within 2 calendar months before the checkride", 14 CFR 61.109(a)(4)); milestones_config carries no
// structured hours for manual items, so it's the one regulatory constant here.
const CHECKRIDE_PREP_HOURS = 3;

/**
 * Remaining hours to finish a certificate, split dual vs. solo, from computed milestone requirements
 * (computeRequirement output for one certificate). Sub-requirements (dual_xc, dual_night, solo_xc...) are
 * subsets of the parent hours, not extra on top, so each bucket takes its single largest remaining value
 * (the binding constraint) rather than a sum. A dual requirement is one whose sum_field/flight_filter
 * mentions dual; solo is one summing solo_time. Any gap between the total-time minimum and dual+solo is
 * folded into solo (extra hours past minimums are typically flown solo). checkride_prep, if not yet done,
 * adds its 3 hours as dual. Other manual/count requirements have no hours and are not costed.
 */
export function remainingHoursByType(requirements) {
  let dual = 0;
  let solo = 0;
  let total = 0;
  let prep = 0;
  for (const r of requirements) {
    if (r.requirement_key === 'checkride_prep') { if (!r.met) prep = CHECKRIDE_PREP_HOURS; continue; }
    if (r.manual || r.current == null) continue;
    const remaining = Math.max(0, r.min_value - r.current);
    if (r.requirement_key === 'total_time') total = remaining;
    else if (`${r.sum_field ?? ''} ${r.flight_filter ?? ''}`.includes('dual')) dual = Math.max(dual, remaining);
    else if ((r.sum_field ?? '').includes('solo_time')) solo = Math.max(solo, remaining);
  }
  dual += prep;
  const extra = Math.max(0, total - dual - solo);
  return { dualHours: round2(dual), soloHours: round2(solo + extra) };
}

/** Actual averages per logged flight: lesson length (total_time) and ground instruction hours. */
export function lessonAverages(flights) {
  const n = flights.length;
  if (!n) return { avgLessonLength: 0, avgGroundPerLesson: 0 };
  const hours = flights.reduce((s, f) => s + (Number(f.total_time) || 0), 0);
  const ground = flights.reduce((s, f) => s + (Number(f.ground_time) || 0), 0);
  return { avgLessonLength: hours / n, avgGroundPerLesson: ground / n };
}

/** Flights per week over the last `windowDays`, or null with fewer than two flights to judge a pace from. */
export function recentFlyingFrequency(flights, today, windowDays = 90) {
  const cutoff = addDays(today, -windowDays);
  const dates = flights.filter((f) => f.date >= cutoff && f.date <= today).map((f) => f.date).sort();
  if (dates.length < 2) return null;
  const spanDays = Math.max(7, daysBetween(dates[0], today));
  return { lessonsPerWeek: round2(dates.length / (spanDays / 7)), sampleSize: dates.length, windowDays };
}

export function estimateFinishDate(remainingLessons, lessonsPerWeek, today) {
  if (!lessonsPerWeek || lessonsPerWeek <= 0) return null;
  return addDays(today, Math.ceil((remainingLessons / lessonsPerWeek) * 7));
}

export const DEFAULT_TARGET_TOTAL_HOURS = 50;

/**
 * Two remaining-cost estimates (label as estimates in the UI), derived from data with no manual inputs
 * except one-time costs: remaining hours from milestones; rates from the current phase; ground time from
 * the pilot's own average ground hours per lesson x the lesson count implied by their average lesson
 * length. Remaining solo hours cost aircraft only; dual hours cost aircraft + instructor; ground hours
 * cost the ground rate. "FAA minimum" uses the remaining requirement hours as-is; "realistic" pads
 * total hours up to `targetTotalHours` (extra hours assumed solo) and, if the pilot has already flown past
 * the target without finishing, raises the target to flown + remaining minimum instead of showing $0.
 */
export function buildCertificateProjection({
  requirements, flights, aircraftRate, instructorRate, groundRate,
  targetTotalHours = DEFAULT_TARGET_TOTAL_HOURS, oneTimeCostsTotal = 0, today,
}) {
  const { dualHours, soloHours } = remainingHoursByType(requirements);
  const { avgLessonLength, avgGroundPerLesson } = lessonAverages(flights);
  const flownTotal = flights.reduce((s, f) => s + (Number(f.total_time) || 0), 0);
  const minRemaining = dualHours + soloHours;
  const effectiveTarget = Math.max(targetTotalHours, flownTotal + minRemaining);
  const realisticSolo = soloHours + Math.max(0, effectiveTarget - flownTotal - minRemaining);

  const rentalPerHr = aircraftRate ? aircraftRate.rental_rate_per_hr + aircraftRate.fuel_surcharge_per_hr : 0;
  const instructorPerHr = instructorRate?.hourly_rate ?? 0;
  const groundPerHr = groundRate?.hourly_rate ?? 0;
  const oneTime = round2(oneTimeCostsTotal);

  const estimate = (dual, solo) => {
    const lessons = avgLessonLength > 0 ? (dual + solo) / avgLessonLength : 0;
    const groundHours = lessons * avgGroundPerLesson;
    const aircraftCost = (dual + solo) * rentalPerHr;
    const instructorCost = dual * instructorPerHr;
    const groundCost = groundHours * groundPerHr;
    return {
      dualHours: round2(dual), soloHours: round2(solo), lessons: round2(lessons), groundHours: round2(groundHours),
      aircraftCost: round2(aircraftCost), instructorCost: round2(instructorCost), groundCost: round2(groundCost),
      oneTimeCosts: oneTime, cost: round2(aircraftCost + instructorCost + groundCost + oneTime),
    };
  };

  const faaMinEstimate = estimate(dualHours, soloHours);
  const realisticEstimate = estimate(dualHours, realisticSolo);
  const frequency = recentFlyingFrequency(flights, today);
  return {
    faaMinEstimate, realisticEstimate,
    finishDate: frequency ? estimateFinishDate(realisticEstimate.lessons, frequency.lessonsPerWeek, today) : null,
    breakdown: {
      avgLessonLength: round2(avgLessonLength), avgGroundPerLesson: round2(avgGroundPerLesson),
      rentalPerHr, instructorPerHr, groundPerHr, frequency,
      targetTotalHours: round2(effectiveTarget), targetRaised: effectiveTarget > targetTotalHours, flownTotal: round2(flownTotal),
    },
  };
}
