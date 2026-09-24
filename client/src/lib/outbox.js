// Nothing entered by the pilot may be silently lost. Two safety nets, both in localStorage (which can be
// unavailable, so every access is guarded and `storage` is injectable for tests):
//   * drafts  — the in-progress form, autosaved as they type, restored if they come back.
//   * outbox  — a flight whose save failed because the network did (not because it was invalid) is queued
//               here and retried automatically, so a bad connection at the airfield doesn't cost an entry.

const DRAFT_PREFIX = 'aerotrail-draft:';
const OUTBOX_KEY = 'aerotrail-outbox';

const defaultStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export function saveDraft(name, value, storage = defaultStorage()) {
  try { storage?.setItem(DRAFT_PREFIX + name, JSON.stringify({ savedAt: Date.now(), value })); return true; } catch { return false; }
}

export function loadDraft(name, storage = defaultStorage()) {
  try {
    const raw = storage?.getItem(DRAFT_PREFIX + name);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearDraft(name, storage = defaultStorage()) {
  try { storage?.removeItem(DRAFT_PREFIX + name); } catch { /* nothing to do */ }
}

function readQueue(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(OUTBOX_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
const writeQueue = (storage, q) => { try { storage?.setItem(OUTBOX_KEY, JSON.stringify(q)); return true; } catch { return false; } };

export const outboxList = (storage = defaultStorage()) => readQueue(storage);

/** Queues a flight payload for retry. Returns the queued entry, or null if storage refused it. */
export function enqueue(payload, storage = defaultStorage(), now = Date.now()) {
  const q = readQueue(storage);
  const entry = { id: `${now}-${Math.random().toString(36).slice(2, 8)}`, queuedAt: now, payload, attempts: 0 };
  return writeQueue(storage, [...q, entry]) ? entry : null;
}

export function removeFromOutbox(id, storage = defaultStorage()) {
  writeQueue(storage, readQueue(storage).filter((e) => e.id !== id));
}

/** True when a request failed because the network did (fetch rejects with TypeError), not because the server said no. */
export const isNetworkError = (err) => Boolean(err && (err.network || err.name === 'TypeError'));

let flushing = false;

/**
 * Tries to send every queued entry with `send(payload)`. A network failure stops the run and keeps the
 * rest queued; a server rejection (e.g. validation) marks that entry `rejected` and keeps it visible
 * rather than deleting it. Returns { sent, remaining }.
 */
export async function flushOutbox(send, storage = defaultStorage()) {
  if (flushing) return { sent: 0, remaining: readQueue(storage).length };
  flushing = true;
  let sent = 0;
  try {
    for (const entry of readQueue(storage)) {
      if (entry.rejected) continue;
      try {
        await send(entry.payload);
        removeFromOutbox(entry.id, storage);
        sent++;
      } catch (err) {
        if (isNetworkError(err)) break;
        const q = readQueue(storage).map((e) => (e.id === entry.id ? { ...e, rejected: err.message || 'Rejected', attempts: e.attempts + 1 } : e));
        writeQueue(storage, q);
      }
    }
  } finally {
    flushing = false;
  }
  return { sent, remaining: readQueue(storage).length };
}
