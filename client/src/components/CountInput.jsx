import { Minus, Plus } from 'lucide-react';

export default function CountInput({ label, value, onChange, error }) {
  const n = Number(value) || 0;
  return (
    <div>
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <div className={`flex items-center rounded-xl border bg-navy-800 ${error ? 'border-bad' : 'border-edge'}`}>
        <button type="button" onClick={() => onChange(String(Math.max(0, n - 1)))} aria-label={`Decrease ${label}`}
          className="flex h-12 w-12 items-center justify-center text-slate-400 active:text-accent"><Minus size={18} /></button>
        <span className="flex-1 text-center text-base">{n}</span>
        <button type="button" onClick={() => onChange(String(n + 1))} aria-label={`Increase ${label}`}
          className="flex h-12 w-12 items-center justify-center text-slate-400 active:text-accent"><Plus size={18} /></button>
      </div>
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
    </div>
  );
}
