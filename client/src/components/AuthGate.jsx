import { useCallback, useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { LOCKED_EVENT, api, setPasscode } from '../lib/api.js';
import Button from './Button.jsx';
import '../ds/tokens.css';
import '../ds/states.css';

function LockScreen({ onUnlock, error, busy }) {
  const [value, setValue] = useState('');
  return (
    <main className="st-page">
      <form onSubmit={(e) => { e.preventDefault(); onUnlock(value); }} aria-label="Unlock AeroHub">
        <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
          <Lock className="st-lock" aria-hidden="true" />
          <h1 className="st-mark">AeroHub</h1>
          <p className="st-sub">Enter your passcode.</p>
        </div>
        <input type="password" autoFocus autoComplete="current-password" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Passcode" aria-label="Passcode"
          aria-invalid={error ? 'true' : undefined} className={`gl-field h-12 w-full px-3 text-base ${error ? 'is-bad' : ''}`} />
        {error && <p role="alert" className="st-err"><span className="st-dot" aria-hidden="true" />{error}</p>}
        <Button size="md" disabled={busy || !value}>{busy ? 'Checking…' : 'Unlock'}</Button>
      </form>
    </main>
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
      <main className="st-page" role="alert">
        <h1 className="st-mark">AeroHub</h1>
        <p className="st-sub">Can’t reach the server right now. Anything you logged is kept on this device.</p>
        <Button size="md" fullWidth={false} variant="secondary" onClick={() => { setState('checking'); check(); }}>Retry</Button>
      </main>
    );
  }
  if (state === 'locked') return <LockScreen onUnlock={unlock} error={error} busy={busy} />;
  return children;
}
