// A flight's stops in order: departure, any airports flown via ("route"), arrival.
export function routeTokens(route) {
  return String(route ?? '').toUpperCase().split(/[\s,;>/-]+/).filter((t) => /^[A-Z0-9]{3,4}$/.test(t));
}

/** Codes as entered, in order, with blanks and immediate repeats removed (KSUS KSUS -> KSUS). */
export function flightStops(f) {
  const codes = [f.departure_airport, ...routeTokens(f.route), f.arrival_airport]
    .map((c) => String(c ?? '').trim().toUpperCase())
    .filter(Boolean);
  return codes.filter((c, i) => i === 0 || c !== codes[i - 1]);
}

/** Every distinct code a flight mentions, for looking airports up. */
export const flightCodes = (f) => [...new Set(flightStops(f))];

/** The code to show for a resolved airport: ICAO, else K + FAA code for US airports (KMO6 is shown as KFYG). */
export function airportCode(a) {
  if (a.icao) return a.icao;
  if (a.country === 'US' && a.local_code && a.local_code.length === 3) return `K${a.local_code}`;
  return a.ident;
}
