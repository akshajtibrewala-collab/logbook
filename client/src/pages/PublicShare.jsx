import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, Plane } from 'lucide-react';
import SummaryDocument from '../components/SummaryDocument.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import Skeleton from '../components/Skeleton.jsx';
import Button from '../components/Button.jsx';

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
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-slate-400"><Plane size={16} />AeroTrail · read-only view</span>
        <div className="flex items-center gap-2">
          {state === 'ok' && <Button size="sm" fullWidth={false} variant="secondary" icon={Printer} iconSize={16} onClick={() => window.print()}>Print</Button>}
          <ThemeToggle />
        </div>
      </div>
      {state === 'loading' && <div className="space-y-4"><Skeleton className="h-16" /><Skeleton className="h-40" /></div>}
      {state === 'invalid' && (
        <div className="py-20 text-center">
          <p className="text-lg font-medium">This link isn’t active.</p>
          <p className="mt-1 text-sm text-slate-400">It may have been turned off or replaced. Ask the pilot for a new link.</p>
        </div>
      )}
      {state === 'error' && <p role="alert" className="py-20 text-center text-slate-400">Couldn’t load this summary right now. Try again in a moment.</p>}
      {state === 'ok' && (
        <SummaryDocument summary={summary} photoSrc={(id) => `/api/public/${encodeURIComponent(token)}/photos/${id}`} />
      )}
    </div>
  );
}
