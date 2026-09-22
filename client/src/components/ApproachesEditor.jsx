import { Plus, X } from 'lucide-react';
import { APPROACH_TYPES } from '../lib/aviationEnums.js';

const empty = () => ({ approach_type: '', count: '1' });

/**
 * Optional typed-approach breakdown (ILS x2, RNAV x1, ...). When any rows are entered, the flight's
 * plain "Approaches" total is derived from their sum instead of typed in separately — see FlightForm.
 */
export default function ApproachesEditor({ approaches, onChange }) {
  const set = (i, patch) => onChange(approaches.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const remove = (i) => onChange(approaches.filter((_, j) => j !== i));
  const add = () => onChange([...approaches, empty()]);

  return (
    <div>
      <span className="mb-1 block text-xs text-slate-400">Approach types (optional)</span>

      {approaches.length > 0 && (
        <div className="space-y-2">
          {approaches.map((a, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-edge bg-navy-800 p-2">
              <select value={a.approach_type} onChange={(e) => set(i, { approach_type: e.target.value })}
                className="h-11 min-w-0 flex-1 rounded-lg border border-edge bg-navy-900 px-2 text-base outline-none focus:border-accent">
                <option value="">Type…</option>
                {APPROACH_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input type="number" inputMode="numeric" min="1" max="99" value={a.count}
                onChange={(e) => set(i, { count: e.target.value })}
                className="h-11 w-16 min-w-0 rounded-lg border border-edge bg-navy-900 px-2 text-center text-base outline-none focus:border-accent" />
              <button type="button" onClick={() => remove(i)} aria-label="Remove approach"
                className="flex h-9 w-9 shrink-0 items-center justify-center text-bad"><X size={18} /></button>
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={add}
        className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-edge-strong text-sm text-accent active:bg-navy-800">
        <Plus size={16} />Add approach
      </button>
    </div>
  );
}
