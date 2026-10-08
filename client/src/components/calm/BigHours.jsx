import { Minus, Plus } from 'lucide-react';
import { fmtHours, parseHours } from '../../lib/hours.js';

const QUICK = ['1.0', '1.5', '2.0'];

/**
 * The flight-time control of the log-a-flight sheet: one big number you can type (1.5 or 1:30) or step by 0.1, with quick values. `value` is a string,
 * as in HoursInput; blur normalises it to two decimals.
 */
export default function BigHours({ label = 'Flight time', value, onChange, error, quick = true }) {
  const step = (delta) => onChange(fmtHours(Math.max(0, Math.round(((parseHours(value) ?? 0) + delta) * 100) / 100)));
  const normalise = () => { const n = parseHours(value); if (n !== null) onChange(fmtHours(n)); };
  return (
    <div className="f">
      <span className="ds-cap">{label}</span>
      <div className="cl-big">
        <button type="button" className="gl clear icon" aria-label={`Decrease ${label}`} onClick={() => step(-0.1)}><Minus className="ds-i" aria-hidden="true" /></button>
        <div className="v">
          <input className="cl-bigin" value={value} inputMode="decimal" aria-label={`${label} in hours`} onChange={(e) => onChange(e.target.value)} onBlur={normalise} />
        </div>
        <button type="button" className="gl clear icon" aria-label={`Increase ${label}`} onClick={() => step(0.1)}><Plus className="ds-i" aria-hidden="true" /></button>
      </div>
      {quick && (
        <div className="cl-quick" role="group" aria-label="Quick values">
          {QUICK.map((q) => <button key={q} type="button" className="gl clear gl-chip" aria-pressed={parseHours(value) === Number(q)} onClick={() => onChange(fmtHours(Number(q)))}>{q}</button>)}
          <button type="button" className="gl clear gl-chip" onClick={() => step(0.1)}>+0.1</button>
        </div>
      )}
      {error && <span className="cl-note" style={{ color: 'var(--ds-bad)' }}>{error}</span>}
    </div>
  );
}
