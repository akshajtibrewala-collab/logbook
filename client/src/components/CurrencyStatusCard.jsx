import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

// Shared by Dashboard (a few key cards) and the Currency page (every currency/expiration item), so the
// "current / expiring / expired" look is defined once.
// `text` is for the large stat-value number (already AA-clear at that size, so it stays on the plain
// --ok/--warn/--bad token); `textStrong` is for the small icon+label row, which needs the darker
// text-only --ok-strong in light mode to clear 4.5:1 (--warn/--bad already clear it at either size).
export const TONE = {
  current: { Icon: CheckCircle2, text: 'text-ok', textStrong: 'text-ok-strong', bar: 'bg-ok', label: 'Current' },
  expiring: { Icon: AlertTriangle, text: 'text-warn', textStrong: 'text-warn', bar: 'bg-warn', label: 'Expiring soon' },
  expired: { Icon: XCircle, text: 'text-bad', textStrong: 'text-bad', bar: 'bg-bad', label: 'Not current' },
};

export function daysText(r) {
  if (r.daysRemaining === null) return { big: '—', small: 'no qualifying history' };
  if (r.daysRemaining < 0) return { big: Math.abs(r.daysRemaining), small: `day${r.daysRemaining === -1 ? '' : 's'} overdue` };
  return { big: r.daysRemaining, small: `day${r.daysRemaining === 1 ? '' : 's'} left` };
}

export default function CurrencyStatusCard({ title, Icon, result, detail, children }) {
  const tone = TONE[result.status];
  const days = daysText(result);
  return (
    <section className="card card-elevated relative overflow-hidden p-4">
      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-slate-400">{Icon && <Icon size={16} strokeWidth={1.75} />}{title}</div>
          <div className={`mt-2 flex items-center gap-1.5 text-sm font-medium ${tone.textStrong}`}>
            <tone.Icon size={16} />{tone.label}
          </div>
          {detail && <p className="mt-1 text-sm text-slate-400">{detail}</p>}
        </div>
        <div className="shrink-0 text-right">
          <div className={`stat-value text-4xl ${tone.text}`}>{days.big}</div>
          <div className="mt-1 text-xs text-slate-400">{days.small}</div>
        </div>
      </div>
      {children && <div className="mt-3 pl-2">{children}</div>}
    </section>
  );
}
