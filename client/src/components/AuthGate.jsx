import { useCallback, useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { LOCKED_EVENT, api, setPasscode } from '../lib/api.js';

function LockScreen({ onUnlock, error, busy }) {
  const [value, setValue] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onUnlock(value); }} className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6">
      <div className="text-center">
        <Lock size={36} strokeWidth={1.5} className="mx-auto text-accent" />
        <h1 className="mt-3 text-2xl font-semibold">Logbook</h1>
        <p className="mt-1 text-sm text-slate-400">Enter your passcode to continue.</p>
      </div>
      <input type="password" autoFocus autoComplete="current-password" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Passcode"
        className={`h-12 w-full rounded-xl border bg-navy-800 px-3 text-base outline-none focus:border-accent ${error ? 'border-bad' : 'border-edge'}`} />
      {error && <p className="text-sm text-bad">{error}</p>}
      <button disabled={busy || !value} className="h-12 rounded-xl bg-accent font-semibold text-ink active:bg-accent-dark disabled:opacity-60">{busy ? 'Checking…' : 'Unlock'}</button>
    </form>
  );
}

/** Shows the app when the API is open or the stored passcode works; otherwise a lock screen. */
export default function AuthGate({ children }) {
  const [state, setState] = useState('checking'); // 'checking' | 'locked' | 'open' | 'offline'
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    try {
      const s = await api.session();
      setState(!s.required || s.ok ? 'open' : 'locked');
    } catch (e) {
      // request() already flips to the lock screen on a 401; anything else means the server is unreachable.
      setState((cur) => (cur === 'locked' ? cur : 'offline'));
    }
  }, []);

  useEffect(() => { check(); }, [check]);
  useEffect(() => {
    const onLocked = () => setState('locked');
    window.addEventListener(LOCKED_EVENT, onLocked);
    return () => window.removeEventListener(LOCKED_EVENT, onLocked);
  }, []);

  async function unlock(value) {
    setBusy(true);
    setError('');
    setPasscode(value);
    try {
      const s = await api.session();
      if (s.ok) setState('open');
      else { setPasscode(''); setError('That passcode is not right.'); }
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'checking') return null;
  if (state === 'offline') {
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-slate-400">Can’t reach the server right now.</p>
        <button onClick={() => { setState('checking'); check(); }} className="h-11 rounded-xl border border-edge-strong px-5 text-accent">Retry</button>
      </div>
    );
  }
  if (state === 'locked') return <LockScreen onUnlock={unlock} error={error} busy={busy} />;
  return children;
}
