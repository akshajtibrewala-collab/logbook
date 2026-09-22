// A small status pill (Current / Expiring / Expired, Ready / Duplicate / Error, and so on). Distinct
// from AirlineBadge, which has its own per-brand coloring — this is for the app's own status tones.
const TONES = {
  ok: 'bg-ok/10 text-ok',
  warn: 'bg-warn/10 text-warn',
  bad: 'bg-bad/10 text-bad',
  accent: 'bg-accent/10 text-accent',
  neutral: 'bg-navy-800 text-slate-300',
};

export default function Badge({ tone = 'neutral', icon: Icon, className = '', children }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${TONES[tone]} ${className}`}>
      {Icon && <Icon size={13} strokeWidth={2} />}
      {children}
    </span>
  );
}
