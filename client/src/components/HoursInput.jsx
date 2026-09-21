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
      <div className={`flex items-center rounded-xl border bg-navy-800 ${error ? 'border-bad' : 'border-edge'}`}>
        <button type="button" onClick={() => step(-0.1)} aria-label={`Decrease ${label}`}
          className="flex h-12 w-12 items-center justify-center text-slate-400 active:text-accent"><Minus size={18} /></button>
        <input value={value} inputMode="decimal" onChange={(e) => onChange(e.target.value)} onBlur={normalise}
          className="min-w-0 flex-1 bg-transparent text-center text-base outline-none" />
        <button type="button" onClick={() => step(0.1)} aria-label={`Increase ${label}`}
          className="flex h-12 w-12 items-center justify-center text-slate-400 active:text-accent"><Plus size={18} /></button>
      </div>
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
    </label>
  );
}
