import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudOff } from 'lucide-react';
import { api } from '../lib/api.js';
import { flushOutbox, outboxList, removeFromOutbox } from '../lib/outbox.js';

export const OUTBOX_CHANGED = 'aerotrail:outbox-changed';

/**
 * Shows flights that couldn't be saved (offline, server down) and retries them automatically — when the
 * app opens, when the connection returns, and every 30 seconds. A flight the server rejected for a real
 * reason (not a network problem) stays listed with its reason so it can be fixed, never silently dropped.
 */
export default function OutboxBanner() {
  const [entries, setEntries] = useState(() => outboxList());
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => setEntries(outboxList()), []);
  const retry = useCallback(async () => {
    setBusy(true);
    try {
      const { sent } = await flushOutbox((payload) => api.createFlight(payload));
      if (sent) window.dispatchEvent(new Event(OUTBOX_CHANGED));
    } finally {
      setBusy(false);
      refresh();
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
    if (outboxList().length) retry();
    const onOnline = () => retry();
    const onChanged = () => refresh();
    window.addEventListener('online', onOnline);
    window.addEventListener(OUTBOX_CHANGED, onChanged);
    const timer = setInterval(() => { if (outboxList().some((e) => !e.rejected)) retry(); }, 30000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener(OUTBOX_CHANGED, onChanged);
      clearInterval(timer);
    };
  }, [refresh, retry]);

  if (!entries.length) return null;
  const rejected = entries.filter((e) => e.rejected);
  const waiting = entries.length - rejected.length;

  return (
    <div role="status" className="no-print mb-4 space-y-2 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
      {waiting > 0 && (
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2"><CloudOff size={16} className="shrink-0" />
            {waiting} flight{waiting === 1 ? '' : 's'} waiting to save — kept safely on this device.</span>
          <button type="button" onClick={retry} disabled={busy} className="h-11 shrink-0 rounded-lg border border-warn/40 px-3 font-medium disabled:opacity-60">
            {busy ? 'Trying…' : 'Retry now'}
          </button>
        </div>
      )}
      {rejected.map((e) => (
        <div key={e.id} className="flex items-center justify-between gap-3">
          <span className="min-w-0">A saved flight from {e.payload.date} couldn’t be accepted: {e.rejected}</span>
          <span className="flex shrink-0 gap-2">
            <Link to={`/logbook/new?outbox=${e.id}`} className="flex h-11 items-center rounded-lg border border-warn/40 px-3 font-medium">Fix</Link>
            <button type="button" onClick={() => { removeFromOutbox(e.id); refresh(); }} className="h-11 rounded-lg px-3 font-medium">Discard</button>
          </span>
        </div>
      ))}
    </div>
  );
}
