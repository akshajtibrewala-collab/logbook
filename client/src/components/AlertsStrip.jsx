import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * Home's single status line (see lib/homeAlerts.js for what counts): a calm "All clear" or "N need
 * attention", always one tappable row — never the four stacked cards this replaced. `to` is wherever the
 * top issue is actually explained (the Currency page for any currency/review/medical item, otherwise the
 * one other page that covers the sole alert present). With nothing to flag, it still links to `to`
 * (Currency by default) so that path stays reachable from Home even when everything's healthy.
 */
export default function AlertsStrip({ count, to }) {
  if (count === 0) {
    return (
      <Link to={to} className="flex items-center gap-2 rounded-xl bg-navy-900 px-3 py-2.5 text-sm text-slate-300 active:opacity-70">
        <CheckCircle2 size={16} className="shrink-0 text-ok" />
        <span>All clear</span>
      </Link>
    );
  }
  return (
    <Link to={to} className="flex items-center gap-2 rounded-xl bg-warn/10 px-3 py-2.5 text-sm font-medium text-warn active:opacity-70">
      <AlertTriangle size={16} className="shrink-0" />
      <span>{count} need{count === 1 ? 's' : ''} attention</span>
    </Link>
  );
}
