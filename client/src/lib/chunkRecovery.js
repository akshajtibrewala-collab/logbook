// Recovery from a lazy-loaded page that cannot be fetched (after a deploy the old hashed file is gone, for an open tab or the installed app). Pure logic,
// tested; the React boundary that uses it is components/ChunkBoundary.jsx. Nothing here touches the draft or the outbox (their storage keys are unchanged):
// a reload keeps localStorage, and the log-a-flight draft autosaves 400 ms after every change.

/** The key of the one-reload guard (sessionStorage: it lasts for this tab only). */
export const RELOAD_FLAG = 'aerohub-chunk-reload';
/** A second chunk failure within this long after an automatic reload is NOT reloaded again (no loops); the person gets the Tap-to-reload state. */
export const RELOAD_GUARD_MS = 30000;

const CHUNK_PATTERNS = [
  /error loading dynamically imported module/i, // Chromium
  /failed to fetch dynamically imported module/i, // Chromium, Vite
  /importing a module script failed/i, // Safari
  /loading chunk [\w-]+ failed/i, // webpack-style
  /unable to preload css/i, // Vite
  /dynamically imported module/i,
];

/** Is this error a failed dynamic import (a missing or unreachable chunk)? */
export function isChunkLoadError(err) {
  if (!err) return false;
  if (err.name === 'ChunkLoadError') return true;
  const text = `${err.message || ''} ${typeof err === 'string' ? err : ''}`;
  return CHUNK_PATTERNS.some((re) => re.test(text));
}

/**
 * Decide whether to reload automatically now. True when no automatic reload happened in the last RELOAD_GUARD_MS; it then records this one. `storage` is
 * anything with getItem and setItem (sessionStorage); a storage that throws (blocked) counts as "already reloaded", so there can never be a loop.
 */
export function claimAutoReload(storage, now = Date.now()) {
  try {
    const last = Number(storage.getItem(RELOAD_FLAG));
    if (Number.isFinite(last) && last > 0 && now - last < RELOAD_GUARD_MS) return false;
    storage.setItem(RELOAD_FLAG, String(now));
    return true;
  } catch { return false; }
}
