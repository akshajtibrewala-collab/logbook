// Every number on the Costs page, computed in one pure place. Training costs, cost per flight hour, pace and the
// projection are about the pilot's own flying, so passenger flights must never reach them (CLAUDE.md "Flight roles").
// The role filter is applied here, at the one entry point, so the page cannot hand these functions an unfiltered list.

import {
  computeFlightCost, totalSpent, entriesCountedForCost, costCutoffNote, spentPerCertificate, spentPerFlightHour,
  buildCertificateProjection, pickRate,
} from './cost.js';
import { computeMilestones, completionsByKey } from './milestones.js';
import { pilotFlights } from './flightRoles.js';

/** Monthly spend for the last `months` calendar months (oldest first), for the bar chart. */
export function monthlySpend(flights, groundSessions, expenses, rates, phases, months = 12, now = new Date()) {
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const from = d.toISOString().slice(0, 10);
    const to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    buckets.push({ label: d.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' }), total: totalSpent(flights, groundSessions, expenses, rates, phases, { from, to }) });
  }
  return buckets;
}

/**
 * `data` is what the Costs page loads: { flights, groundSessions, expenses, rates, phases, milestonesConfig, settings,
 * plannedCosts, aircraft, completions }. `flights` may hold every role; only pilot flights are used.
 */
export function computeCostsFigures(data, projectCert, today, now = new Date()) {
  const { groundSessions, expenses, rates, phases, milestonesConfig, settings, plannedCosts, aircraft, completions } = data;
  const flights = pilotFlights(data.flights);
  const cutoff = rates.cost_cutoff_date;
  const { flights: costFlights, groundSessions: costGround } = entriesCountedForCost(flights, groundSessions, cutoff);
  const total = totalSpent(flights, groundSessions, expenses, rates, phases);
  const perCert = spentPerCertificate(phases, flights, groundSessions, expenses, rates, today);
  const perHour = spentPerFlightHour(total, costFlights);
  const groundHours = costFlights.reduce((sum, f) => sum + (Number(f.ground_time) || 0), 0) + costGround.reduce((sum, g) => sum + (Number(g.hours) || 0), 0);
  const chart = monthlySpend(flights, groundSessions, expenses, rates, phases, 12, now);

  const aircraftById = Object.fromEntries(aircraft.map((x) => [x.id, x]));
  const requirements = computeMilestones(milestonesConfig, flights, aircraftById, completionsByKey(completions)).get(projectCert) ?? [];
  let projection = null;
  if (requirements.length) {
    // Rates come from the phase being projected; the most recently flown aircraft stands in for the one
    // you'll keep training in (a simplification, labeled as an estimate).
    const mostRecentAircraftId = [...costFlights].sort((x, y) => y.date.localeCompare(x.date)).find((f) => f.aircraft_id)?.aircraft_id;
    const certAircraftRates = rates.aircraft_rates.filter((r) => r.certificate === projectCert);
    projection = buildCertificateProjection({
      requirements, flights: costFlights,
      aircraftRate: pickRate(mostRecentAircraftId ? certAircraftRates.filter((r) => r.aircraft_id === mostRecentAircraftId) : certAircraftRates, today),
      instructorRate: pickRate(rates.instructor_rates.filter((r) => r.certificate === projectCert), today),
      groundRate: pickRate(rates.ground_rates.filter((r) => r.certificate === projectCert), today),
      targetTotalHours: projectCert === 'private' && settings.private_realistic_total_hours ? settings.private_realistic_total_hours : undefined,
      oneTimeCostsTotal: plannedCosts.filter((c) => c.certificate === projectCert).reduce((sum, c) => sum + c.amount, 0),
      today,
    });
  }

  const missingRateFlights = costFlights.filter((f) => {
    const c = computeFlightCost(f, rates, phases);
    return c.tracked && c.missingRate;
  });
  return { total, perCert, perHour, groundHours, chart, projection, missingRateFlights, cutoffNote: costCutoffNote(cutoff) };
}
