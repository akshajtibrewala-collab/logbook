// A labeled-elsewhere progress bar — used by Milestones for "current / required" per requirement.
const TONES = { accent: 'bg-accent', ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' };

export default function ProgressBar({ value, max, tone = 'accent', className = '' }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div role="progressbar" aria-valuenow={Math.round(value * 100) / 100} aria-valuemin={0} aria-valuemax={max}
      className={`h-1.5 w-full overflow-hidden rounded-full bg-navy-800 ${className}`}>
      <div className={`h-full rounded-full transition-[width] duration-300 ${TONES[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
