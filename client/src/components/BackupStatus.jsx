import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Mail } from 'lucide-react';
import { api } from '../lib/api.js';
import { formatInstant } from '../lib/calendar.js';
import Button from './Button.jsx';

/** Latest automatic backup: date and status, a warning when it failed or is overdue, and "Run backup now". */
export default function BackupStatus({ compact = false }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => { api.backupJobStatus().then(setStatus).catch((e) => setError(e.message)); }, []);
  useEffect(load, [load]);

  async function runNow() {
    setBusy(true);
    setError('');
    try {
      setStatus(await api.runBackupNow());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      load();
    }
  }

  // On the Dashboard only speak up when something needs attention.
  if (compact) {
    if (!status?.warn) return null;
    return (
      <Link to="/logbook/data" className="flex items-start gap-2 rounded-xl bg-warn/10 p-3 text-sm text-warn">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{status.message} Open Import &amp; export to check it.</span>
      </Link>
    );
  }

  const Icon = !status ? Mail : status.warn ? AlertTriangle : CheckCircle2;
  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-start gap-3">
        <Icon size={20} className={`mt-0.5 shrink-0 ${status?.warn ? 'text-warn' : 'text-ok'}`} />
        <div className="min-w-0">
          <h2 className="text-sm font-medium">Automatic weekly backup</h2>
          <p className="text-xs text-slate-400">Emailed every Monday as an attachment, excluding airports and runways.</p>
          {status && (
            <p className={`mt-1 text-sm ${status.warn ? 'text-warn' : 'text-slate-300'}`}>
              {status.last
                ? `Last: ${formatInstant(status.last.ran_at)} — ${status.last.status === 'ok' ? 'sent' : 'failed'}${status.last.trigger === 'manual' ? ' (manual)' : ''}${status.last.size_bytes ? `, ${(status.last.size_bytes / 1024).toFixed(1)} KB${status.last.gzipped ? ' gzipped' : ''}` : ''}`
                : 'No backup has run yet.'}
            </p>
          )}
          {status?.warn && status.last && <p className="text-xs text-warn">{status.message}</p>}
        </div>
      </div>
      {error && <p className="rounded-xl bg-bad/10 p-2 text-sm text-bad">{error}</p>}
      <Button variant="secondary" size="md" onClick={runNow} disabled={busy}>{busy ? 'Sending…' : 'Run backup now'}</Button>
    </section>
  );
}
