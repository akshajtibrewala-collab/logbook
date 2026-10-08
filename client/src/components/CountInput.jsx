import { Minus, Plus } from 'lucide-react';

export default function CountInput({ label, value, onChange, error }) {
  const n = Number(value) || 0;
  return (
    <div>
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <div className="gl-stepbox"><div className={`gl-field gl-step ${error ? 'is-bad' : ''}`}>
        <button type="button" onClick={() => onChange(String(Math.max(0, n - 1)))} aria-label={`Decrease ${label}`}
          className="gl clear icon sm"><Minus size={18} /></button>
        <span className="v">{n}</span>
        <button type="button" onClick={() => onChange(String(n + 1))} aria-label={`Increase ${label}`}
          className="gl clear icon sm"><Plus size={18} /></button>
      </div></div>
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
    </div>
  );
}
