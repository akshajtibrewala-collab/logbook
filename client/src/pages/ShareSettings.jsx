import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Printer, RefreshCw, Link2Off } from 'lucide-react';
import { api } from '../lib/api.js';
import Button from '../components/Button.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import Skeleton from '../components/Skeleton.jsx';
import Toggle from '../components/Toggle.jsx';

const OPTIONS = [
  ['show_recent_flights', 'Recent flights', 'List your last 10 flights (route, date, time).'],
  ['show_aircraft', 'Aircraft', 'Show aircraft type and tail number on each flight.'],
  ['show_notes', 'Notes', 'Show each flight’s personal note. Off by default.'],
  ['show_photos', 'Photos', 'Show photos attached to those flights. Off by default.'],
];

/** Manage the one read-only public link: turn on/off, choose what it shows, regenerate it. */
export default function ShareSettings() {
  const navigate = useNavigate();
  const [share, setShare] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'regenerate' | 'revoke'
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => { setError(''); api.getShare().then(setShare).catch((e) => setError(e.message)); }, []);
  useEffect(load, [load]);

  const url = share?.token ? `${window.location.origin}/share/${share.token}` : '';

  async function act(fn) {
    setBusy(true);
    setError('');
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); setConfirm(null); }
  }
  const enable = () => act(async () => setShare(await api.enableShare()));
  const toggle = (key) => act(async () => setShare(await api.updateShare({ [key]: !share[key] })));
  const regenerate = () => act(async () => setShare(await api.regenerateShare()));
  const revoke = () => act(async () => { await api.revokeShare(); setShare(await api.getShare()); });

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setError('Couldn’t copy — select the link and copy it manually.'); }
  }

  return (
    <div className="space-y-4 md:mx-auto md:max-w-xl">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/logbook')} className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800" aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-semibold">Share & print</h1>
      </div>

      {error && <ErrorNote message={error} onRetry={load} />}
      {!share && !error && <Skeleton className="h-40" />}

      <section className="card p-4">
        <h2 className="text-sm font-medium text-accent">Printable summary</h2>
        <p className="mt-1 text-sm text-slate-400">Totals, goal and certificate progress, and recent flights — print it or save it as a PDF.</p>
        <Button as={Link} to="/logbook/print" variant="secondary" size="md" icon={Printer} iconSize={18} className="mt-3">Open printable summary</Button>
      </section>

      {share && (
        <section className="card p-4">
          <h2 className="text-sm font-medium text-accent">Public link</h2>
          <p className="mt-1 text-sm text-slate-400">Anyone with the link can view a read-only summary — never edit anything, and never costs, instructors or debriefs. No sign-in needed.</p>

          {!share.enabled ? (
            <Button className="mt-3" size="md" disabled={busy} onClick={enable}>Create public link</Button>
          ) : (
            <>
              <label className="mt-3 block text-xs text-slate-400">Your link
                <input readOnly value={url} onFocus={(e) => e.target.select()}
                  className="mt-1 h-12 w-full rounded-xl border border-edge bg-navy-800 px-3 text-sm outline-none focus:border-accent" />
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button size="md" variant="secondary" icon={Copy} iconSize={16} onClick={copy}>{copied ? 'Copied' : 'Copy link'}</Button>
                <Button as="a" size="md" variant="secondary" href={url} target="_blank" rel="noreferrer">Preview</Button>
              </div>

              <h3 className="mb-1 mt-5 text-sm font-medium text-slate-300">What the link shows</h3>
              <p className="text-xs text-slate-500">Totals are always shown.</p>
              <div className="mt-1 divide-y divide-edge">
                {OPTIONS.map(([key, label, hint]) => (
                  <Toggle key={key} label={label} description={hint} checked={share[key]} onChange={() => { if (!busy) toggle(key); }} />
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-edge pt-4">
                <Button size="md" variant="secondary" icon={RefreshCw} iconSize={16} disabled={busy} onClick={() => setConfirm('regenerate')}>New link</Button>
                <Button size="md" variant="danger" icon={Link2Off} iconSize={16} disabled={busy} onClick={() => setConfirm('revoke')}>Turn off</Button>
              </div>
            </>
          )}
        </section>
      )}

      <ConfirmDialog open={confirm === 'regenerate'} title="Create a new link?" confirmLabel="Create new link" busy={busy}
        description="The current link stops working immediately. Anyone you sent it to will need the new one."
        onConfirm={regenerate} onClose={() => setConfirm(null)} />
      <ConfirmDialog open={confirm === 'revoke'} title="Turn off the public link?" confirmLabel="Turn off" busy={busy}
        description="The link stops working for everyone. Turning sharing on again creates a different link."
        onConfirm={revoke} onClose={() => setConfirm(null)} />
    </div>
  );
}
