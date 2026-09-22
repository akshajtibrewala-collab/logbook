// A small circular progress indicator for a summary card (e.g. one certificate's overall completion),
// distinct from the linear ProgressBar used for individual requirement rows so the two granularities
// (summary vs. per-requirement) read as visually different at a glance.
const TONE_TEXT = { accent: 'text-accent', ok: 'text-ok', warn: 'text-warn', bad: 'text-bad', neutral: 'text-slate-500' };

export default function RingProgress({ percent, size = 44, strokeWidth = 4, tone = 'accent', children }) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, percent));
  const offset = c * (1 - pct / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={strokeWidth} className="stroke-navy-800" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          className={`stroke-current transition-[stroke-dashoffset] duration-500 ${TONE_TEXT[tone]}`} />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold">{children}</div>}
    </div>
  );
}
