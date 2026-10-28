// The pilot flight form carries some fields without an input (SIC, ground instruction, dual given, simulator time, airline, flight number). An edit sends them back
// exactly as stored, so a stored value that no longer passes today's rules (a SIC above the total, say) must not block a save nobody can fix from that form.
// Only an UNCHANGED value is forgiven; a changed one, or any other field, is validated as usual.
export const HIDDEN_FORM_FIELDS = ['sic_time', 'dual_given', 'simulator_time', 'ground_time', 'airline', 'flight_number'];

// null, undefined and '' are all "empty"; a number and its numeric string are the same value; text is compared trimmed. Nothing else matches.
const norm = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (s === '') return null;
  return Number.isFinite(Number(s)) ? Number(s) : s;
};
export const sameStored = (stored, sent) => norm(stored) === norm(sent);

/**
 * `errors` is parseFlight's error map (or null), `value` its parsed values, `stored` the row as stored and `body` what the update sent (merged onto stored).
 * Returns the errors left once an unchanged hidden field's error is dropped (null when none are left); a forgiven field keeps its stored value.
 */
export function forgiveUnchangedHidden(errors, value, stored, body) {
  if (!errors) return null;
  const left = { ...errors };
  for (const k of HIDDEN_FORM_FIELDS) {
    if (left[k] && sameStored(stored[k], body[k])) { delete left[k]; value[k] = stored[k]; }
  }
  return Object.keys(left).length ? left : null;
}
