import { all, get, run } from '../db.js';

export const FALLBACK_AIRCRAFT_RATE = { rental_rate_per_hr: 195, fuel_surcharge_per_hr: 15 };

/**
 * The rate a brand-new aircraft starts with in a phase: the phase's most recently added aircraft rate
 * (so it follows whatever the pilot last set), or $195/hr + $15/hr fuel when the phase has none yet.
 */
export function pickDefaultAircraftRate(phaseRates) {
  const latest = [...phaseRates].sort((a, b) => b.effective_date.localeCompare(a.effective_date) || b.id - a.id)[0];
  return latest
    ? { rental_rate_per_hr: latest.rental_rate_per_hr, fuel_surcharge_per_hr: latest.fuel_surcharge_per_hr }
    : { ...FALLBACK_AIRCRAFT_RATE };
}

/**
 * When a flight is logged in an aircraft that has no rate in the cost-tracked phase covering the flight's
 * date, gives that aircraft the phase's default rate (effective from the phase's start, so the flight and
 * any earlier ones in the phase are covered). Editable afterwards in cost settings. No-op otherwise.
 */
export async function ensureAircraftRate(aircraftId, date) {
  if (!aircraftId) return null;
  const phase = await get(
    'SELECT * FROM training_phases WHERE track_costs = 1 AND start_date <= ? AND (end_date IS NULL OR end_date >= ?) LIMIT 1',
    [date, date],
  );
  if (!phase) return null;
  const has = await get('SELECT id FROM aircraft_rates WHERE aircraft_id = ? AND certificate = ?', [aircraftId, phase.certificate]);
  if (has) return null;
  const rate = pickDefaultAircraftRate(await all('SELECT * FROM aircraft_rates WHERE certificate = ?', [phase.certificate]));
  await run(
    'INSERT INTO aircraft_rates (certificate, aircraft_id, effective_date, rental_rate_per_hr, fuel_surcharge_per_hr) VALUES (?, ?, ?, ?, ?)',
    [phase.certificate, aircraftId, phase.start_date, rate.rental_rate_per_hr, rate.fuel_surcharge_per_hr],
  );
  return rate;
}
