/**
 * Update semantics shared by the update routes: only the fields the caller actually sent change.
 *
 * The parsers (parseFlight, parseGroundSession) turn every omitted field into null or 0, and the UPDATE
 * then writes every column — so a client that simply left `instructor` or `invoice_ref` out of its body
 * erased what was stored. Merging the request onto the stored row first means omission keeps a value;
 * sending `null` (or '') still clears it, and the merged result goes through the same validation as before.
 *
 * `keys` are the writable columns. A key counts as sent when it is an own property of `body` and not
 * `undefined` (JSON can't carry `undefined`, so this only matters for in-process callers).
 */
export function mergeOntoStored(stored, body, keys) {
  const sent = body && typeof body === 'object' ? body : {};
  const merged = {};
  for (const k of keys) {
    merged[k] = Object.hasOwn(sent, k) && sent[k] !== undefined ? sent[k] : stored[k];
  }
  return merged;
}
