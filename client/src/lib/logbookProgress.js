// The one progress line on the Logbook hero: how far the pilot's total time is toward the Private Pilot total-time minimum, read from the milestone engine's
// own output (computeMilestones), never recomputed here. Pilot flights only; passenger time can never move it.
import { computeMilestones, completionsByKey, certificateSummary, certificateLabel } from './milestones.js';
import { pilotFlights } from './flightRoles.js';

import { DEFAULT_GOAL_HOURS } from './goal.js';

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * { certificate, label, min, goal, current, remaining, met, goalMet, toGoal, percent, tickPercent, requirementsMet, requirementsTotal } for the certificate's total-time
 * requirement, or null when there is none. `min` is the FAA total-time minimum from the milestone engine (never changed here); `goal` is the pilot's hour goal
 * (default 50). `percent` is time toward the GOAL and `tickPercent` is where the minimum sits on the same line (null when the goal is not above the minimum).
 */
export function totalTimeProgress(requirements, certificate = 'private', goal = DEFAULT_GOAL_HOURS) {
  const r = (requirements ?? []).find((x) => x.requirement_key === 'total_time' && !x.manual && x.current != null);
  if (!r) return null;
  const { metCount, computableCount } = certificateSummary(requirements);
  return {
    certificate, label: certificateLabel(certificate), min: r.min_value, current: r.current, remaining: round2(Math.max(0, r.min_value - r.current)),
    goal, goalMet: r.current >= goal, toGoal: round2(Math.max(0, goal - r.current)),
    met: r.current >= r.min_value, percent: Math.min(100, (r.current / goal) * 100), tickPercent: goal > r.min_value ? (r.min_value / goal) * 100 : null, requirementsMet: metCount, requirementsTotal: computableCount,
  };
}

/** From the raw API lists. `flights` may hold every role: only pilot flights are used. */
export function logbookProgress({ config, flights, aircraft, completions, goal = DEFAULT_GOAL_HOURS }, certificate = 'private') {
  const aircraftById = Object.fromEntries((aircraft ?? []).map((a) => [a.id, a]));
  const reqs = computeMilestones(config ?? [], pilotFlights(flights), aircraftById, completionsByKey(completions ?? [])).get(certificate) ?? [];
  return totalTimeProgress(reqs, certificate, goal);
}

/** The words around the hero for a progress (or none): "of 50 h", the bar description and the accessible name. total is the pilot total in hours; fmt formats hours. */
export function heroText(progress, total, fmt) {
  if (!progress) return { of: undefined, barLabel: undefined, ariaLabel: `Pilot: ${fmt(total)} hours total time` };
  const gap = progress.goalMet ? 'goal reached' : `${fmt(progress.toGoal)} hours to the ${progress.goal} hour goal`;
  return {
    of: `of ${progress.goal} h`,
    barLabel: `Total time ${fmt(progress.current)} of your ${progress.goal} hour goal. The ${progress.min} hour ${progress.label} FAA total-time minimum is marked on the line.`,
    ariaLabel: `${progress.label}: ${fmt(total)} hours total time, ${gap}; ${progress.met ? 'the FAA minimum is reached' : `${fmt(progress.remaining)} hours to the ${progress.min} hour FAA minimum`}`,
  };
}
