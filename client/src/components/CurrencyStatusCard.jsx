import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

// Shared by Dashboard (a few key cards) and the Currency page (every currency/expiration item), so the
// "current / expiring / expired" look is defined once.
export const TONE = {
  current: { Icon: CheckCircle2, text: 'text-ok', bar: 'bg-ok', label: 'Current' },
  expiring: { Icon: AlertTriangle, text: 'text-warn', bar: 'bg-warn', label: 'Expiring soon' },
  expired: { Icon: XCircle, text: 'text-bad', bar: 'bg-bad', label: 'Not current' },
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
    <section className="card relative overflow-hidden p-4">
      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-slate-400">{Icon && <Icon size={16} strokeWidth={1.75} />}{title}</div>
          <div className={`mt-2 flex items-center gap-1.5 text-sm font-medium ${tone.text}`}>
            <tone.Icon size={16} />{tone.label}
          </div>
          {detail && <p className="mt-1 text-sm text-slate-400">{detail}</p>}
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-4xl font-semibold leading-none ${tone.text}`}>{days.big}</div>
          <div className="mt-1 text-xs text-slate-400">{days.small}</div>
        </div>
      </div>
      {children && <div className="mt-3 pl-2">{children}</div>}
    </section>
  );
}
