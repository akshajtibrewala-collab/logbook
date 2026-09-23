// Pure training-cost calculations. Rates are effective-dated (never "the current rate") so an old
// flight's cost doesn't change retroactively when a rate is edited later — every lookup picks the latest
// rate row with effective_date <= the date in question. Nothing here talks to the API.

const round2 = (n) => Math.round(n * 100) / 100;

export const fmtMoney = (n) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
 * A flight's cost breakdown from its own hours (aircraft time, simulator time, dual received, ground
 * instruction) and whichever rates were in effect on the flight's date. Aircraft rental + fuel surcharge
 * apply to `total_time` (aircraft hours); simulator time is billed separately at the simulator rate, not
 * the aircraft rate, since it's not the same aircraft. Instructor cost only applies when `dual_received`
 * is logged. `cost_override`, when set, replaces the total outright — the computed breakdown is still
 * returned alongside it so an overridden flight can be edited without losing what the calculation would
 * have said.
 */
export function computeFlightCost(flight, rates) {
  const { aircraft_rates = [], instructor_rates = [], ground_rates = [], simulator_rates = [] } = rates ?? {};
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

  const hasOverride = flight.cost_override !== null && flight.cost_override !== undefined && flight.cost_override !== '';
  return {
    total: hasOverride ? round2(Number(flight.cost_override)) : computedTotal,
    computedTotal,
    override: hasOverride,
    missingRate,
    breakdown: {
      rentalCost: round2(rentalCost), fuelCost: round2(fuelCost), simCost: round2(simCost),
      instructorCost: round2(instructorCost), groundCost: round2(groundCost),
    },
  };
}

/** A ground-only session's cost: its hours at whichever ground rate was in effect on its date. */
export function computeGroundSessionCost(session, groundRates) {
  const rate = pickRate(groundRates ?? [], session.date);
  const hours = Number(session.hours) || 0;
  return { total: hours > 0 && rate ? round2(hours * rate.hourly_rate) : 0, missingRate: hours > 0 && !rate };
}

const inRange = (date, from, to) => (!from || date >= from) && (!to || date <= to);

/** Total spent across flights, ground-only sessions, and other expenses within an optional [from, to]. */
export function totalSpent(flights, groundSessions, expenses, rates, { from, to } = {}) {
  let total = 0;
  for (const f of flights) if (inRange(f.date, from, to)) total += computeFlightCost(f, rates).total;
  for (const s of groundSessions) if (inRange(s.date, from, to)) total += computeGroundSessionCost(s, rates?.ground_rates).total;
  for (const e of expenses) if (inRange(e.date, from, to)) total += Number(e.amount) || 0;
  return round2(total);
}

/**
 * Spend per certificate, using each certificate's own training-phase date range rather than which
 * milestones a flight's hours satisfy — a flight's hours often count toward more than one certificate's
 * requirements, but the flight itself only happened during one phase of training. A phase with no
 * end_date is still open, so it runs through `today`. A certificate with no phase defined is omitted.
 */
export function spentPerCertificate(phases, flights, groundSessions, expenses, rates, today) {
  const out = {};
  for (const phase of phases) {
    out[phase.certificate] = totalSpent(flights, groundSessions, expenses, rates, { from: phase.start_date, to: phase.end_date || today });
  }
  return out;
}

/** Average cost per logged hour of flight (aircraft + simulator time; ground-only sessions have no flight hours of their own). */
export function averageCostPerFlightHour(flights, rates) {
  let cost = 0;
  let hours = 0;
  for (const f of flights) {
    cost += computeFlightCost(f, rates).total;
    hours += (Number(f.total_time) || 0) + (Number(f.simulator_time) || 0);
  }
  return hours > 0 ? round2(cost / hours) : 0;
}

/**
 * Two remaining-cost estimates for finishing a certificate, both explicitly estimates (label them as such
 * in the UI, not here): one at the regulatory minimum remaining dual/solo hours, one at a "realistic"
 * total hour count the pilot sets themselves (most private pilots fly well past the 40-hour minimum).
 * Both split remaining hours into dual vs. solo since they cost differently. Modeling choice: the
 * realistic estimate's hours beyond the regulatory-minimum remaining total are assumed solo, since extra
 * hours beyond minimums are typically flown solo, not with an instructor; hours at or under that minimum
 * are split in the same dual:solo proportion as the regulatory minimum itself.
 */
export function projectRemainingCost({
  faaMinDualHours, faaMinSoloHours, flownDualHours, flownSoloHours, flownTotalHours,
  realisticTotalHours, currentAircraftRate, currentInstructorRate,
}) {
  const remainingDualFaaMin = Math.max(0, faaMinDualHours - flownDualHours);
  const remainingSoloFaaMin = Math.max(0, faaMinSoloHours - flownSoloHours);

  const estimate = (dualHours, soloHours) => {
    const aircraftHours = dualHours + soloHours;
    const rentalPlusFuel = currentAircraftRate
      ? aircraftHours * (currentAircraftRate.rental_rate_per_hr + currentAircraftRate.fuel_surcharge_per_hr)
      : 0;
    const instructorCost = currentInstructorRate ? dualHours * currentInstructorRate.hourly_rate : 0;
    return { dualHours: round2(dualHours), soloHours: round2(soloHours), cost: round2(rentalPlusFuel + instructorCost) };
  };

  const faaMinEstimate = estimate(remainingDualFaaMin, remainingSoloFaaMin);

  const remainingRealisticTotal = Math.max(0, realisticTotalHours - flownTotalHours);
  const faaMinRemainingTotal = remainingDualFaaMin + remainingSoloFaaMin;
  let realisticDual;
  let realisticSolo;
  if (remainingRealisticTotal <= faaMinRemainingTotal) {
    const scale = faaMinRemainingTotal > 0 ? remainingRealisticTotal / faaMinRemainingTotal : 0;
    realisticDual = remainingDualFaaMin * scale;
    realisticSolo = remainingSoloFaaMin * scale;
  } else {
    realisticDual = remainingDualFaaMin;
    realisticSolo = remainingSoloFaaMin + (remainingRealisticTotal - faaMinRemainingTotal);
  }
  const realisticEstimate = estimate(realisticDual, realisticSolo);

  return { faaMinEstimate, realisticEstimate };
}
