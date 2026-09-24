// Builds the read-only public summary. Pure (no database access) so exactly what leaves the server is
// unit-tested: the allow-list below is the only thing that ever reaches a public link. Costs, instructor
// names, invoice references and debriefs are never included, whatever the toggles say.
const round2 = (n) => Math.round(n * 100) / 100;
const sum = (rows, key) => round2(rows.reduce((s, r) => s + (Number(r[key]) || 0), 0));

export const RECENT_LIMIT = 10;

const newestFirst = (a, b) => b.date.localeCompare(a.date) || b.id - a.id;

/** The flights the public page lists — also the only flights whose photos may be served publicly. */
export function recentFlights(flights, limit = RECENT_LIMIT) {
  return [...flights].sort(newestFirst).slice(0, limit);
}

/**
 * @param flights   all flight rows
 * @param share     the share_settings row (flags are 0/1)
 * @param settings  the pilot_settings row (for the hours target), may be undefined
 * @param photoIdsByFlight  flightId -> [photo ids], only used when share.show_photos
 */
export function buildShareSummary({ flights, share, settings, photoIdsByFlight = {}, now = new Date(), recentLimit = RECENT_LIMIT }) {
  const yearAgo = new Date(now.getTime() - 365 * 86400_000).toISOString().slice(0, 10);
  const last12 = flights.filter((f) => f.date >= yearAgo);
  const total = sum(flights, 'total_time');
  const target = settings?.hours_target ? {
    label: settings.hours_target_label || 'Goal',
    hours: settings.hours_target,
    flown: total,
  } : null;

  const summary = {
    generated_at: now.toISOString(),
    totals: {
      flights: flights.length,
      total,
      pic: sum(flights, 'pic_time'),
      dual_received: sum(flights, 'dual_received'),
      solo: sum(flights, 'solo_time'),
      night: sum(flights, 'night_time'),
      cross_country: sum(flights, 'cross_country_time'),
      instrument: round2(sum(flights, 'instrument_actual') + sum(flights, 'instrument_simulated')),
      landings: flights.reduce((s, f) => s + (Number(f.day_landings) || 0) + (Number(f.night_landings) || 0), 0),
      last_12_months: sum(last12, 'total_time'),
    },
    target,
    options: {
      show_recent_flights: Boolean(share.show_recent_flights),
      show_aircraft: Boolean(share.show_aircraft),
      show_notes: Boolean(share.show_notes),
      show_photos: Boolean(share.show_photos),
    },
    recent: [],
  };

  if (share.show_recent_flights) {
    summary.recent = recentFlights(flights, recentLimit).map((f) => {
      const row = {
        id: f.id, date: f.date, from: f.departure_airport, to: f.arrival_airport, route: f.route, total_time: f.total_time,
      };
      if (share.show_aircraft) { row.aircraft_type = f.aircraft_type; row.tail_number = f.tail_number; }
      if (share.show_notes && f.remarks) row.note = f.remarks;
      if (share.show_photos) row.photo_ids = photoIdsByFlight[f.id] ?? [];
      return row;
    });
  }
  return summary;
}
