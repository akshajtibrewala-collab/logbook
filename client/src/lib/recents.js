// "Remember the ones I've used": most-recently-used lists (airports, aircraft) kept in localStorage.
// Storage is injectable for tests and every access is guarded — it can be blocked in private mode.

const PREFIX = 'aerotrail-recent:';
const MAX = 12;
const defaultStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export function getRecents(kind, storage = defaultStorage()) {
  try {
    const parsed = JSON.parse(storage?.getItem(PREFIX + kind) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

/** Moves `value` to the front of the list (deduplicated, case-insensitively for strings, capped). */
export function recordRecent(kind, value, storage = defaultStorage(), max = MAX) {
  if (value === null || value === undefined || value === '') return getRecents(kind, storage);
  const key = (v) => (typeof v === 'string' ? v.toUpperCase() : v);
  const next = [value, ...getRecents(kind, storage).filter((v) => key(v) !== key(value))].slice(0, max);
  try { storage?.setItem(PREFIX + kind, JSON.stringify(next)); } catch { /* remembering is a nicety */ }
  return next;
}

/** Sorts `items` so ones whose id is in `recentIds` come first, in recency order; the rest keep their order. */
export function sortByRecency(items, recentIds, idOf = (x) => x.id) {
  const rank = new Map(recentIds.map((id, i) => [id, i]));
  return [...items].sort((a, b) => (rank.has(idOf(a)) ? rank.get(idOf(a)) : Infinity) - (rank.has(idOf(b)) ? rank.get(idOf(b)) : Infinity));
}
