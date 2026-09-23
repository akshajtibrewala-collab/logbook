import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';

const empty = () => ({ airport_code: '', stop_type: 'full_stop' });

/** Ordered, editable list of intermediate stops between a flight's departure and arrival. */
export default function StopsEditor({ stops, onChange, from, to }) {
  const set = (i, patch) => onChange(stops.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= stops.length) return;
    const next = [...stops];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (i) => onChange(stops.filter((_, j) => j !== i));
  const add = () => onChange([...stops, empty()]);

  const routeCodes = [from, ...stops.map((s) => s.airport_code), to].filter(Boolean);

  return (
    <div>
      <span className="mb-1 block text-xs text-slate-400">Stops (optional)</span>
      {routeCodes.length > 1 && (
        <p className="mb-2 text-sm text-slate-300">{routeCodes.join(' → ')}</p>
      )}

      {stops.length > 0 && (
        <div className="space-y-2">
          {stops.map((s, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-edge bg-navy-800 p-2">
              <div className="flex flex-col">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"
                  className="flex h-9 w-9 items-center justify-center text-slate-400 disabled:opacity-30"><ArrowUp size={14} /></button>
                <button type="button" disabled={i === stops.length - 1} onClick={() => move(i, 1)} aria-label="Move down"
                  className="flex h-9 w-9 items-center justify-center text-slate-400 disabled:opacity-30"><ArrowDown size={14} /></button>
              </div>
              <input value={s.airport_code} placeholder="KFYG" maxLength={4}
                onChange={(e) => set(i, { airport_code: e.target.value.toUpperCase() })}
                className="h-11 w-24 min-w-0 rounded-lg border border-edge bg-navy-900 px-2 text-center text-base outline-none focus:border-accent" />
              <div className="flex flex-1 rounded-lg bg-navy-900 p-0.5 text-xs">
                {[['full_stop', 'Full stop'], ['touch_and_go', 'Touch & go']].map(([value, label]) => (
                  <button key={value} type="button" onClick={() => set(i, { stop_type: value })}
                    className={`h-9 flex-1 rounded-md font-medium transition-colors ${s.stop_type === value ? 'bg-accent text-ink' : 'text-slate-400'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => remove(i)} aria-label="Remove stop"
                className="flex h-11 w-11 shrink-0 items-center justify-center text-bad"><X size={18} /></button>
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={add}
        className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-edge-strong text-sm text-accent active:bg-navy-800">
        <Plus size={16} />Add stop
      </button>
    </div>
  );
}
