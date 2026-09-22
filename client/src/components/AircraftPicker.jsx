import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plane, Search } from 'lucide-react';
import { api } from '../lib/api.js';
import Modal from './Modal.jsx';
import TextField from './TextField.jsx';
import Button from './Button.jsx';

const aircraftLabel = (a) => (a.is_simulator ? (a.model || 'Simulator') : [a.tail_number, a.model].filter(Boolean).join(' · ') || 'Aircraft');

/** Pick an existing aircraft, or quickly add a new one without leaving the flight form. */
export default function AircraftPicker({ label = 'Aircraft', value, onSelect, error }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [newTail, setNewTail] = useState('');
  const [newModel, setNewModel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open && !list) api.listAircraft().then(setList).catch((e) => setErr(e.message));
  }, [open, list]);

  const selected = useMemo(() => list?.find((a) => a.id === value) ?? (value?.id ? value : null), [list, value]);
  const filtered = useMemo(() => {
    if (!list) return [];
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((a) => [a.tail_number, a.make, a.model, a.type_designator].filter(Boolean).join(' ').toLowerCase().includes(s));
  }, [list, q]);

  function pick(a) {
    onSelect(a);
    setOpen(false);
  }

  async function quickAdd(e) {
    e.preventDefault();
    if (!newTail.trim() && !newModel.trim()) return setErr('Enter at least a tail number or model.');
    setBusy(true);
    setErr('');
    try {
      const a = await api.createAircraft({ tail_number: newTail, model: newModel });
      setList((prev) => [...(prev ?? []), a]);
      setNewTail('');
      setNewModel('');
      setAdding(false);
      pick(a);
    } catch (err) {
      setErr(err.fieldErrors?.tail_number || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <button type="button" onClick={() => setOpen(true)}
        className={`flex h-12 w-full items-center justify-between gap-2 rounded-xl border bg-navy-800 px-3 text-left text-base outline-none ${error ? 'border-bad' : 'border-edge'}`}>
        <span className={selected ? '' : 'text-slate-500'}>{selected ? aircraftLabel(selected) : 'Choose aircraft'}</span>
        <ChevronDown size={18} className="shrink-0 text-slate-400" />
      </button>
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}

      <Modal open={open} onClose={() => setOpen(false)} title="Choose aircraft">
        {!adding ? (
          <>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your aircraft"
                className="h-11 w-full rounded-xl border border-edge bg-navy-800 pl-9 pr-3 text-base outline-none focus:border-accent" />
            </div>
            <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
              {!list && <p className="py-4 text-center text-sm text-slate-400">Loading…</p>}
              {list && filtered.length === 0 && <p className="py-4 text-center text-sm text-slate-400">No matches.</p>}
              {filtered.map((a) => (
                <button key={a.id} type="button" onClick={() => pick(a)}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left active:bg-navy-800">
                  <Plane size={16} className="shrink-0 text-slate-500" />
                  <span className="min-w-0 flex-1 truncate text-sm">{aircraftLabel(a)}</span>
                </button>
              ))}
            </div>
            {err && <p className="mt-2 text-sm text-bad">{err}</p>}
            <Button type="button" variant="secondary" size="md" className="mt-3" onClick={() => setAdding(true)}>+ Add new aircraft</Button>
          </>
        ) : (
          <form onSubmit={quickAdd} className="space-y-3">
            <TextField label="Tail number" upper value={newTail} onChange={setNewTail} placeholder="N123AB" />
            <TextField label="Model" value={newModel} onChange={setNewModel} placeholder="C172" />
            {err && <p className="text-sm text-bad">{err}</p>}
            <p className="text-xs text-slate-500">You can set category, class and flags like complex or tailwheel later from the Aircraft screen.</p>
            <div className="flex gap-2">
              <Button type="submit" size="md" disabled={busy}>{busy ? 'Adding…' : 'Add & select'}</Button>
              <Button type="button" variant="ghost" size="md" fullWidth={false} onClick={() => setAdding(false)}>Back</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
