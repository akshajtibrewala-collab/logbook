import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Minus, Plus } from 'lucide-react';
import { api } from '../lib/api.js';
import { fmtHours } from '../lib/hours.js';
import { getRecents, recordRecent, sortByRecency } from '../lib/recents.js';
import { mostRecentFlight, quickFlightPayload, stepHours, validateQuickFlight } from '../lib/flightDraft.js';
import { clearDraft, enqueue, isNetworkError, loadDraft, saveDraft } from '../lib/outbox.js';
import { OUTBOX_CHANGED } from '../components/OutboxBanner.jsx';
import AirportSearchField from '../components/AirportSearchField.jsx';
import AircraftPicker from '../components/AircraftPicker.jsx';
import Button from '../components/Button.jsx';
import DatePicker from '../components/DatePicker.jsx';
import { formatDate } from '../lib/calendar.js';

const DRAFT = 'flight-quick';
const iso = (d) => d.toLocaleDateString('en-CA');
const today = () => iso(new Date());
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return iso(d); };
const CHIPS = ['0.5', '1.0', '1.5', '2.0'];

const bigBtn = 'flex h-14 items-center justify-center rounded-2xl border text-base font-medium transition-colors active:scale-[0.98]';

/**
 * Log a flight in a few taps, right after landing: date, route, aircraft, time. Everything else takes
 * a sensible default (PIC time = flight time, one full-stop landing) and can be filled in later from the
 * flight's edit screen. Airports, aircraft and date default from the last flight.
 */
export default function QuickFlight() {
  const navigate = useNavigate();
  const [aircraftList, setAircraftList] = useState([]);
  const [form, setForm] = useState({ date: today(), departure_airport: '', arrival_airport: '', aircraft: null, total_time: '1.00', dual: false });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null); // { id } once created
  const [notice, setNotice] = useState('');
  const ready = useRef(false);

  // Defaults from the last flight (or a restored draft, which wins).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [flights, aircraft] = await Promise.all([api.listFlights().catch(() => []), api.listAircraft().catch(() => [])]);
      if (cancelled) return;
      setAircraftList(aircraft);
      const draft = loadDraft(DRAFT)?.value;
      if (draft) {
        setForm((f) => ({ ...f, ...draft }));
        setNotice('Restored your unsaved entry.');
      } else {
        const last = mostRecentFlight(flights);
        const ordered = sortByRecency(aircraft, getRecents('aircraft'));
        const byLast = last?.aircraft_id ? aircraft.find((a) => a.id === last.aircraft_id) : null;
        setForm((f) => ({
          ...f,
          departure_airport: last?.departure_airport || '',
          arrival_airport: last?.arrival_airport || '',
          aircraft: byLast || ordered[0] || null,
        }));
      }
      ready.current = true;
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready.current || saved) return undefined;
    const t = setTimeout(() => saveDraft(DRAFT, form), 400);
    return () => clearTimeout(t);
  }, [form, saved]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const recentAircraft = useMemo(() => sortByRecency(aircraftList, getRecents('aircraft')).slice(0, 3), [aircraftList]);

  async function submit(e) {
    e.preventDefault();
    const found = validateQuickFlight(form, { today: today() });
    setErrors(found);
    if (Object.keys(found).length) return;
    const payload = quickFlightPayload(form);
    setSaving(true);
    setMessage('');
    try {
      const created = await api.createFlight(payload);
      if (form.aircraft) recordRecent('aircraft', form.aircraft.id);
      clearDraft(DRAFT);
      setSaved({ id: created.id });
    } catch (err) {
      if (isNetworkError(err) && enqueue(payload)) {
        clearDraft(DRAFT);
        window.dispatchEvent(new Event(OUTBOX_CHANGED));
        navigate('/logbook');
        return;
      }
      setErrors(err.fieldErrors || {});
      setMessage(err.fieldErrors ? 'Please check the highlighted fields.' : err.message);
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="space-y-4 md:mx-auto md:max-w-xl">
        <div className="card p-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ok/15 text-ok"><Check size={28} /></span>
          <h1 className="mt-3 text-2xl font-semibold">Flight logged</h1>
          <p className="mt-1 text-sm text-slate-400">{formatDate(form.date)} · {fmtHours(form.total_time)} h</p>
        </div>
        <Button onClick={() => navigate(`/logbook/${saved.id}/edit`)}>Add details now</Button>
        <Button variant="secondary" onClick={() => { setSaved(null); setSaving(false); setForm((f) => ({ ...f, date: today(), total_time: '1.00' })); }}>Log another</Button>
        <Button variant="ghost" onClick={() => navigate('/logbook')}>Done</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 md:mx-auto md:max-w-xl">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/logbook')} className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800" aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-semibold">Quick log</h1>
      </div>
      {notice && <p role="status" className="rounded-xl bg-accent/10 p-3 text-sm text-accent">{notice}</p>}

      <section className="card space-y-3 p-4">
        <span className="block text-xs text-slate-400">Date</span>
        <div className="grid grid-cols-2 gap-2">
          {[['Today', today()], ['Yesterday', yesterday()]].map(([label, value]) => (
            <button key={label} type="button" onClick={() => set({ date: value })} aria-pressed={form.date === value}
              className={`${bigBtn} ${form.date === value ? 'border-accent bg-accent text-ink' : 'border-edge bg-navy-800 text-slate-300'}`}>{label}</button>
          ))}
        </div>
        <DatePicker label="Other date" value={form.date} onChange={(v) => set({ date: v })} error={errors.date} />
      </section>

      <section className="card space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <AirportSearchField label="From" value={form.departure_airport} onChange={(v) => set({ departure_airport: v })} error={errors.departure_airport} />
          <AirportSearchField label="To" value={form.arrival_airport} onChange={(v) => set({ arrival_airport: v })} error={errors.arrival_airport} placeholder="KSQL" />
        </div>
        <button type="button" onClick={() => set({ departure_airport: form.arrival_airport, arrival_airport: form.departure_airport })}
          className="h-11 text-sm text-accent">Swap From and To</button>
      </section>

      <section className="card space-y-3 p-4">
        {recentAircraft.length > 0 && (
          <div>
            <span className="mb-1 block text-xs text-slate-400">Recent aircraft</span>
            <div className="grid gap-2">
              {recentAircraft.map((a) => (
                <button key={a.id} type="button" onClick={() => set({ aircraft: a })} aria-pressed={form.aircraft?.id === a.id}
                  className={`${bigBtn} ${form.aircraft?.id === a.id ? 'border-accent bg-accent/15 text-accent' : 'border-edge bg-navy-800 text-slate-300'}`}>
                  {[a.tail_number, a.model].filter(Boolean).join(' · ') || 'Aircraft'}
                </button>
              ))}
            </div>
          </div>
        )}
        <AircraftPicker label={recentAircraft.length ? 'Another aircraft' : 'Aircraft'} value={form.aircraft?.id ?? null} onSelect={(a) => set({ aircraft: a })} />
      </section>

      <section className="card space-y-3 p-4">
        <span className="block text-xs text-slate-400">Flight time (hours)</span>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="0.1 hour less" onClick={() => set({ total_time: stepHours(form.total_time, -0.1) })}
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-edge bg-navy-800 active:bg-navy-700"><Minus size={24} /></button>
          <input aria-label="Flight time in hours" inputMode="decimal" value={form.total_time}
            onChange={(e) => set({ total_time: e.target.value })} onBlur={() => { const n = Number(String(form.total_time).replace(',', '.')); if (Number.isFinite(n) && n >= 0) set({ total_time: n.toFixed(2) }); }}
            className={`h-16 min-w-0 flex-1 rounded-2xl border bg-navy-800 text-center text-3xl font-semibold outline-none focus:border-accent ${errors.total_time ? 'border-bad' : 'border-edge'}`} />
          <button type="button" aria-label="0.1 hour more" onClick={() => set({ total_time: stepHours(form.total_time, 0.1) })}
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-edge bg-navy-800 active:bg-navy-700"><Plus size={24} /></button>
        </div>
        {errors.total_time && <p role="alert" className="text-sm text-bad">{errors.total_time}</p>}
        <div className="grid grid-cols-4 gap-2">
          {CHIPS.map((c) => (
            <button key={c} type="button" onClick={() => set({ total_time: Number(c).toFixed(2) })}
              className={`${bigBtn} h-12 ${Number(form.total_time) === Number(c) ? 'border-accent text-accent' : 'border-edge bg-navy-800 text-slate-300'}`}>{c}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[[false, 'Pilot in command'], [true, 'Dual received']].map(([value, label]) => (
            <button key={label} type="button" onClick={() => set({ dual: value })} aria-pressed={form.dual === value}
              className={`${bigBtn} h-12 text-sm ${form.dual === value ? 'border-accent bg-accent text-ink' : 'border-edge bg-navy-800 text-slate-300'}`}>{label}</button>
          ))}
        </div>
      </section>

      {message && <p role="alert" className="rounded-xl bg-bad/10 p-3 text-sm text-bad">{message}</p>}
      <Button size="lg" disabled={saving}>{saving ? 'Saving…' : 'Save flight'}</Button>
      <p className="text-center text-xs text-slate-500">Landings default to one full stop. Add night time, approaches, notes and photos later from the flight.</p>
    </form>
  );
}
