// Milestone progress, computed from raw flights against milestones_config rows (server/src/migrations/
// 005_milestones.js). Nothing here is certificate- or requirement-specific: nothing about "private
// pilot" or "complex/turbine/TAA" is written in this file. Every row says which flight field(s) to sum
// and which flights count, and this module just does the summing — so a new or changed requirement is a
// data change (a new migration), never a code change here.

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * True if `flight` counts toward a requirement with these filter clauses (all clauses AND together).
 * A `{ aircraft_flags: [...] }` clause is true if the flight's linked aircraft has ANY of those boolean
 * flags set — this is the one place "OR across a set of flags" is implemented, generically; the flag
 * list itself (e.g. complex/turbine/TAA) is data, supplied by the clause, not hardcoded here.
 */
export function matchesFilter(flight, clauses, aircraftById) {
  return clauses.every((clause) => {
    if (clause.aircraft_flags) {
      const ac = flight.aircraft_id != null ? aircraftById?.[flight.aircraft_id] : null;
      return Boolean(ac) && clause.aircraft_flags.some((flag) => Boolean(ac[flag]));
    }
    const actual = Number(flight[clause.field]) || 0;
    switch (clause.op) {
      case '>': return actual > clause.value;
      case '>=': return actual >= clause.value;
      case '=': return actual === clause.value;
      default: return true;
    }
  });
}

/**
 * Progress toward one requirement row. `req.sum_field` may list several flight columns, comma-
 * separated, summed together (e.g. "instrument_actual,instrument_simulated"). Manual requirements (no
 * sum_field, req.manual true) return current: null — there is nothing to compute, only to check off.
 */
export function computeRequirement(req, flights, aircraftById = {}) {
  if (req.manual || !req.sum_field) {
    return { ...req, current: null, percent: null, met: null };
  }
  const fields = req.sum_field.split(',').map((s) => s.trim());
  const clauses = req.flight_filter ? JSON.parse(req.flight_filter) : [];
  let current = 0;
  for (const f of flights) {
    if (!matchesFilter(f, clauses, aircraftById)) continue;
    for (const field of fields) current += Number(f[field]) || 0;
  }
  current = round2(current);
  return { ...req, current, percent: Math.min(100, (current / req.min_value) * 100), met: current >= req.min_value };
}

/** Every requirement's progress, grouped by certificate, in the config's own sort order. */
export function computeMilestones(config, flights, aircraftById = {}) {
  const byCert = new Map();
  for (const req of config) {
    const computed = computeRequirement(req, flights, aircraftById);
    if (!byCert.has(req.certificate)) byCert.set(req.certificate, []);
    byCert.get(req.certificate).push(computed);
  }
  return byCert;
}

const CERT_LABELS = { private: 'Private Pilot', instrument: 'Instrument Rating', commercial: 'Commercial Pilot', cfi: 'CFI', multi_engine: 'Multi-Engine', atp: 'ATP' };
export const certificateLabel = (cert) => CERT_LABELS[cert] ?? cert;

/**
 * Which group a requirement belongs to for display, purely from its own data — never a hardcoded list
 * of requirement_keys, so a new requirement (a new migration row) groups correctly with no UI change:
 *   - manual (no computable progress) -> "Tracked manually"
 *   - otherwise, if either the summed field(s) or the flight_filter clauses mention dual time (received
 *     or given) -> "Training" (time logged with/as an instructor)
 *   - otherwise -> "Flight time"
 * Checking flight_filter as well as sum_field matters: a requirement like "instrument training" sums
 * instrument_actual/instrument_simulated (not a "dual" field) but *gates* on dual_received > 0 in its
 * filter, which is what actually makes it training rather than plain instrument time.
 */
export function requirementGroup(req) {
  if (req.manual) return 'Tracked manually';
  const haystack = `${req.sum_field ?? ''} ${req.flight_filter ?? ''}`;
  return haystack.includes('dual') ? 'Training' : 'Flight time';
}

/** Groups requirements for one certificate into the three display buckets, each in the given order. */
export function groupRequirements(requirements) {
  const groups = { 'Flight time': [], Training: [], 'Tracked manually': [] };
  for (const req of requirements) groups[requirementGroup(req)].push(req);
  return groups;
}

/**
 * A certificate's overall completion: how many of its *computable* requirements are met (manual ones
 * have no met/not-met state, so they're excluded from both the count and the percent — they're tracked,
 * not scored) and the resulting percent, for a summary ring/bar.
 */
export function certificateSummary(requirements) {
  const computable = requirements.filter((r) => !r.manual);
  const metCount = computable.filter((r) => r.met).length;
  const percent = computable.length ? (metCount / computable.length) * 100 : 0;
  return { metCount, computableCount: computable.length, percent, complete: computable.length > 0 && metCount === computable.length };
}
