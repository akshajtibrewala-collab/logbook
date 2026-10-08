import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudOff } from 'lucide-react';
import { api } from '../lib/api.js';
import '../ds/states.css';
import { flushOutbox, outboxList, removeFromOutbox } from '../lib/outbox.js';

// Intentionally kept as "aerotrail:" (the app's old name) despite the AeroHub rename — it's an in-page
// custom event name (never persisted, never shown), so renaming it would carry risk for zero benefit.
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
    <div role="status" className="no-print st-note queue" style={{ marginBottom: 16 }}>
      {waiting > 0 && (
        <div className="row">
          <span><CloudOff size={16} className="shrink-0" aria-hidden="true" />{waiting} flight{waiting === 1 ? '' : 's'} waiting to save, kept safely on this device.</span>
          <button type="button" onClick={retry} disabled={busy} className="gl clear sm">{busy ? 'Trying…' : 'Retry now'}</button>
        </div>
      )}
      {rejected.map((e) => (
        <div key={e.id} className="row">
          <span><span className="st-dot" aria-hidden="true" />A saved flight from {e.payload.date} couldn’t be accepted: {e.rejected}</span>
          <span className="act">
            <Link to={`/logbook/new?outbox=${e.id}`} className="gl clear sm">Fix</Link>
            <button type="button" onClick={() => { removeFromOutbox(e.id); refresh(); }} className="gl clear sm">Discard</button>
          </span>
        </div>
      ))}
    </div>
  );
}
