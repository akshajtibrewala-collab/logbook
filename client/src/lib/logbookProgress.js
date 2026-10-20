// The one progress line on the Home and Logbook heroes: how far the pilot's total time is toward the Private Pilot total-time minimum, read from the milestone engine's
// own output (computeMilestones), never recomputed here. Pilot flights only; passenger time can never move it. Once the minimum is met the line is gone.
import { computeMilestones, completionsByKey, certificateSummary, certificateLabel } from './milestones.js';
import { pilotFlights } from './flightRoles.js';

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * { certificate, label, min, current, remaining, met, percent, requirementsMet, requirementsTotal } for the certificate's total-time requirement, or null
 * when there is none. `min` is the FAA total-time minimum from the milestone engine (never changed here); `percent` is time toward that minimum.
 */
export function totalTimeProgress(requirements, certificate = 'private') {
  const r = (requirements ?? []).find((x) => x.requirement_key === 'total_time' && !x.manual && x.current != null);
  if (!r) return null;
  const { metCount, computableCount } = certificateSummary(requirements);
  return {
    certificate, label: certificateLabel(certificate), min: r.min_value, current: r.current, remaining: round2(Math.max(0, r.min_value - r.current)),
    met: r.current >= r.min_value, percent: Math.min(100, (r.current / r.min_value) * 100), requirementsMet: metCount, requirementsTotal: computableCount,
  };
}

/** From the raw API lists. `flights` may hold every role: only pilot flights are used. */
export function logbookProgress({ config, flights, aircraft, completions }, certificate = 'private') {
  const aircraftById = Object.fromEntries((aircraft ?? []).map((a) => [a.id, a]));
  const reqs = computeMilestones(config ?? [], pilotFlights(flights), aircraftById, completionsByKey(completions ?? [])).get(certificate) ?? [];
  return totalTimeProgress(reqs, certificate);
}

/**
 * The words around the hero for a progress (or none). While the minimum is not met: "of 40 h", the bar description and an accessible name that says how far
 * to go. Once met (or with no progress) there is no "of" and no bar. total is the pilot total in hours; fmt formats hours.
 */
export function heroText(progress, total, fmt) {
  const base = `Total hours: ${fmt(total)}`;
  if (!progress || progress.met) return { of: undefined, barLabel: undefined, ariaLabel: base };
  return {
    of: `of ${progress.min} h`,
    barLabel: `Total time ${fmt(progress.current)} of the ${progress.min} hour ${progress.label} FAA total-time minimum.`,
    ariaLabel: `${base}, ${fmt(progress.remaining)} hours to the ${progress.min} hour FAA ${progress.label} minimum`,
  };
}

/** The bar percent for the hero, or undefined (no line) when there is no progress or the minimum is met. */
export const heroPercent = (progress) => (progress && !progress.met ? progress.percent : undefined);
