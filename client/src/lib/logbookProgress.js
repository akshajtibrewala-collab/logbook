// The one progress line on the Logbook hero: how far the pilot's total time is toward the Private Pilot total-time minimum, read from the milestone engine's
// own output (computeMilestones), never recomputed here. Pilot flights only; passenger time can never move it.
import { computeMilestones, completionsByKey, certificateSummary, certificateLabel } from './milestones.js';
import { pilotFlights } from './flightRoles.js';

const round2 = (n) => Math.round(n * 100) / 100;

/** { certificate, min, current, remaining, met, percent } for the certificate's total-time requirement, or null when there is none. */
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
