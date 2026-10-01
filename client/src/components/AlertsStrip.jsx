import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

// One compact strip under the greeting: when everything is healthy it's a single calm line, never four
// currency cards' worth of "all good" noise. When something needs attention, each item gets its own
// tappable row instead — still far less than the old four-card layout, and only for what's actually due.
const TONE_ICON = { warn: AlertTriangle, bad: XCircle };
const TONE_TEXT = { warn: 'text-warn', bad: 'text-bad' };

export default function AlertsStrip({ alerts }) {
  if (!alerts.length) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-navy-900 px-3 py-2.5 text-sm text-slate-300">
        <CheckCircle2 size={16} className="shrink-0 text-ok" />
        <span>Everything's current — nothing needs attention.</span>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {alerts.map((a, i) => {
        const Icon = TONE_ICON[a.tone] ?? AlertTriangle;
        return (
          <Link key={i} to={a.to} className={`flex items-start gap-2 rounded-xl bg-navy-900 px-3 py-2.5 text-sm ${TONE_TEXT[a.tone] ?? 'text-warn'} active:opacity-70`}>
            <Icon size={16} className="mt-0.5 shrink-0" />
            <span>{a.text}</span>
          </Link>
        );
      })}
    </div>
  );
}
