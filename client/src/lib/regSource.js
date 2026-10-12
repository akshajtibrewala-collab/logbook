// A passenger flight's registration can be filled in automatically by the daily job (see CLAUDE.md, "Automatic
// registration"). The server records where a value came from; this file decides what the detail screen shows.
// Pure functions so the rule is unit tested.

const PROVIDERS = {
  aerodatabox: { name: 'AeroDataBox', url: 'https://aerodatabox.com' },
};

/**
 * The "auto" marker state for a flight, or null when the registration is the pilot's own (typed, cleared, or
 * never filled). Only a non-blank tail that the job filled and the pilot has not cleared counts.
 */
export function registrationMarker(flight) {
  if (!flight || flight.role === 'pilot') return null;
  const provider = PROVIDERS[flight.reg_source];
  if (!provider) return null;
  if (flight.reg_cleared_at) return null;
  if (!String(flight.tail_number ?? '').trim()) return null;
  return {
    provider: provider.name,
    url: provider.url,
    // an ISO UTC instant; the date part is shown as written (never converted through a Date)
    filledOn: typeof flight.reg_filled_at === 'string' && /^\d{4}-\d{2}-\d{2}/.test(flight.reg_filled_at) ? flight.reg_filled_at.slice(0, 10) : null,
  };
}
