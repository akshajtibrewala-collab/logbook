import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, Plane } from 'lucide-react';
import SummaryDocument from '../components/SummaryDocument.jsx';
import Skeleton from '../components/Skeleton.jsx';
import Button from '../components/Button.jsx';
import '../ds/tokens.css';
import '../ds/summary.css';

/**
 * The read-only public summary. It deliberately does not use lib/api.js (no passcode, no edit calls):
 * the only request it can make is a GET to /api/public/<token>, and the server exposes nothing else
 * without the app passcode.
 */
export default function PublicShare() {
  const { token } = useParams();
  const [summary, setSummary] = useState(null);
  const [state, setState] = useState('loading'); // loading | ok | invalid | error

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) return setState('invalid');
        if (!res.ok) return setState('error');
        setSummary(await res.json());
        setState('ok');
      })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  return (
    <div className="sd-page">
      <div className="no-print sd-bar">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Plane size={16} aria-hidden="true" />AeroHub · read-only view</span>
        <div className="flex items-center gap-2">
          {state === 'ok' && <Button size="sm" fullWidth={false} variant="secondary" icon={Printer} iconSize={16} onClick={() => window.print()}>Print</Button>}
        </div>
      </div>
      {state === 'loading' && <div role="status" aria-label="Loading" style={{ display: 'grid', gap: 16 }}><Skeleton className="h-16" /><Skeleton className="h-40" /></div>}
      {state === 'invalid' && (
        <div className="sd-state">
          <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>This link isn’t active.</p>
          <p className="mut">It may have been turned off or replaced. Ask the pilot for a new link.</p>
        </div>
      )}
      {state === 'error' && <div role="alert" className="sd-state"><p>Couldn’t load this summary right now.</p><p className="mut">Try again in a moment.</p></div>}
      {state === 'ok' && (
        <SummaryDocument summary={summary} photoSrc={(id) => `/api/public/${encodeURIComponent(token)}/photos/${id}`} />
      )}
    </div>
  );
}
