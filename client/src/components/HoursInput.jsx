import { Minus, Plus } from 'lucide-react';
import { fmtHours, parseHours } from '../lib/hours.js';

// Text input that accepts 1.5 or 1:30, with +/- steppers. `value` is a string.
export default function HoursInput({ label, value, onChange, error }) {
  const step = (delta) => {
    const cur = parseHours(value) ?? 0;
    onChange(fmtHours(Math.max(0, Math.round((cur + delta) * 100) / 100)));
  };
  const normalise = () => {
    const n = parseHours(value);
    if (n !== null) onChange(fmtHours(n));
  };
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <div className="gl-stepbox"><div className={`gl-field gl-step ${error ? 'is-bad' : ''}`}>
        <button type="button" onClick={() => step(-0.1)} aria-label={`Decrease ${label}`}
          className="gl clear icon sm"><Minus size={18} /></button>
        <input value={value} inputMode="decimal" onChange={(e) => onChange(e.target.value)} onBlur={normalise}
          className="" />
        <button type="button" onClick={() => step(0.1)} aria-label={`Increase ${label}`}
          className="gl clear icon sm"><Plus size={18} /></button>
      </div></div>
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
    </label>
  );
}
