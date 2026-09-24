import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Copy } from 'lucide-react';
import { api, fetchAllRates } from '../lib/api.js';
import { fmtHours, parseHours } from '../lib/hours.js';
import { computeFlightCost, fmtMoney, isPastCostCutoff } from '../lib/cost.js';
import { formatDate } from '../lib/calendar.js';
import HoursInput from '../components/HoursInput.jsx';
import CountInput from '../components/CountInput.jsx';
import TextField from '../components/TextField.jsx';
import AirportSearchField from '../components/AirportSearchField.jsx';
import PhotoPicker, { uploadPending } from '../components/PhotoPicker.jsx';
import { OUTBOX_CHANGED } from '../components/OutboxBanner.jsx';
import { prefillFromFlight, mostRecentFlight, validateFlightPayload } from '../lib/flightDraft.js';
import { saveDraft, loadDraft, clearDraft, enqueue, outboxList, removeFromOutbox, isNetworkError } from '../lib/outbox.js';
import DatePicker from '../components/DatePicker.jsx';
import AirlineBadge from '../components/AirlineBadge.jsx';
import Button from '../components/Button.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import AircraftPicker from '../components/AircraftPicker.jsx';
import StopsEditor from '../components/StopsEditor.jsx';
import ApproachesEditor from '../components/ApproachesEditor.jsx';
import Disclosure from '../components/Disclosure.jsx';
import { AIRLINE_NAMES } from '../lib/airlines.js';

const TIME_FIELDS = [
  ['total_time', 'Total'], ['pic_time', 'PIC'], ['sic_time', 'SIC'],
  ['dual_received', 'Dual received'], ['dual_given', 'Dual given'],
  ['solo_time', 'Solo'], ['simulator_time', 'Simulator'], ['ground_time', 'Ground instruction'],
  ['night_time', 'Night'], ['cross_country_time', 'Cross-country'],
  ['instrument_actual', 'Instrument (actual)'], ['instrument_simulated', 'Instrument (simulated)'],
];
const COUNT_FIELDS = ['day_landings', 'day_landings_full_stop', 'night_landings', 'night_landings_full_stop', 'approaches', 'holds'];

const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

const blank = () => ({
  date: today(), departure_airport: '', arrival_airport: '', route: '', stops: [], aircraft_id: null, aircraft_type: '', tail_number: '',
  airline: '', flight_number: '', remarks: '', debrief_went_well: '', debrief_work_on: '', approach_types: [], cost_override: '',
  ...Object.fromEntries(TIME_FIELDS.map(([k]) => [k, fmtHours(0)])),
  ...Object.fromEntries(COUNT_FIELDS.map((k) => [k, '0'])),
});

function fromFlight(f) {
  const s = blank();
  for (const k of Object.keys(s)) {
    if (k === 'cost_override') { s[k] = f[k] == null ? '' : String(f[k]); continue; }
    if (f[k] === null || f[k] === undefined) continue;
    if (k === 'aircraft_id' || k === 'stops' || k === 'approach_types') { s[k] = f[k]; continue; } // not text-input values
    s[k] = TIME_FIELDS.some(([t]) => t === k) ? fmtHours(f[k]) : String(f[k]);
  }
  return s;
}

const DRAFT_NAME = 'flight-new';

function Section({ title, children }) {
  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-medium text-accent">{title}</h2>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

export default function FlightForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rates, setRates] = useState(null);
  const [phases, setPhases] = useState(null);
  const [defaultGroundTime, setDefaultGroundTime] = useState(null);
  const [groundTouched, setGroundTouched] = useState(false);
  const [params] = useSearchParams();
  const [notice, setNotice] = useState('');
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const draftReady = useRef(false); // autosave starts only after any restore/prefill has happened

  useEffect(() => {
    if (id) {
      api.getFlight(id).then((f) => setForm(fromFlight(f))).catch((e) => setMessage(e.message)).finally(() => { setLoading(false); draftReady.current = true; });
      return undefined;
    }
    // New flight: start from (in priority order) a queued entry being fixed, the last flight (Copy last),
    // or an unsaved draft from an earlier visit; otherwise a blank form.
    const outboxId = params.get('outbox');
    const queued = outboxId ? outboxList().find((e) => e.id === outboxId) : null;
    if (queued) {
      setForm(fromFlight(queued.payload));
      setNotice(`This flight couldn’t be saved: ${queued.rejected || 'unknown reason'}. Fix it and save again.`);
      draftReady.current = true;
      return undefined;
    }
    if (params.get('copy') === 'last') {
      setLoading(true);
      api.listFlights()
        .then(async (list) => {
          const last = mostRecentFlight(list);
          if (!last) { setNotice('There’s no previous flight to copy yet.'); return; }
          const full = await api.getFlight(last.id);
          setForm(fromFlight(prefillFromFlight(full, today())));
          setNotice('Copied from your last flight — change anything that’s different.');
        })
        .catch((e) => setMessage(e.message))
        .finally(() => { setLoading(false); draftReady.current = true; });
      return undefined;
    }
    const draft = loadDraft(DRAFT_NAME);
    if (draft?.value) {
      setForm({ ...blank(), ...draft.value });
      setNotice('Restored your unsaved flight from earlier.');
    }
    draftReady.current = true;
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, params]);

  // Autosave the in-progress new flight so a crash, refresh or failed save never loses it.
  useEffect(() => {
    if (id || !draftReady.current) return undefined;
    const timer = setTimeout(() => saveDraft(DRAFT_NAME, form), 400);
    return () => clearTimeout(timer);
  }, [form, id]);
  useEffect(() => { fetchAllRates().then(setRates).catch(() => {}); }, []);
  useEffect(() => { api.listTrainingPhases().then(setPhases).catch(() => {}); }, []);
  useEffect(() => { api.getSettings().then((s) => setDefaultGroundTime(s.default_ground_time)).catch(() => {}); }, []);

  // Auto-fills the default ground briefing time once dual is logged on a *new* flight, only while the
  // pilot hasn't touched ground_time themselves — never overwrites a value they already set or edited.
  useEffect(() => {
    if (id || groundTouched || defaultGroundTime == null) return;
    const dual = parseHours(form.dual_received) || 0;
    const ground = parseHours(form.ground_time) || 0;
    if (dual > 0 && ground === 0) setForm((f) => ({ ...f, ground_time: fmtHours(defaultGroundTime) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.dual_received, id, groundTouched, defaultGroundTime]);

  const set = (k) => (v) => {
    if (k === 'ground_time') setGroundTouched(true);
    setForm((f) => ({ ...f, [k]: v }));
  };

  const previewCost = rates && phases ? computeFlightCost({
    date: form.date, aircraft_id: form.aircraft_id,
    total_time: parseHours(form.total_time) || 0, simulator_time: parseHours(form.simulator_time) || 0,
    dual_received: parseHours(form.dual_received) || 0, ground_time: parseHours(form.ground_time) || 0,
    cost_override: form.cost_override.trim() === '' ? null : form.cost_override,
  }, rates, phases) : null;

  async function submit(e) {
    e.preventDefault();
    const approachTypes = form.approach_types.filter((a) => a.approach_type);
    const payload = { ...form, stops: form.stops.filter((s) => s.airport_code.trim()), approach_types: approachTypes };
    if (approachTypes.length) payload.approaches = String(approachTypes.reduce((s, a) => s + (Number(a.count) || 0), 0));
    payload.cost_override = form.cost_override.trim() === '' ? null : form.cost_override;
    const local = {};
    for (const [k, label] of TIME_FIELDS) {
      const n = parseHours(form[k]);
      if (n === null) local[k] = `${label}: use 1.5 or 1:30`;
      payload[k] = n;
    }
    if (Object.keys(local).length) return setErrors(local);
    const invalid = validateFlightPayload(payload, { today: today() });
    if (Object.keys(invalid).length) {
      setErrors(invalid);
      setMessage('Please fix the highlighted fields.');
      return undefined;
    }
    setSaving(true);
    setErrors({});
    setMessage('');
    try {
      let savedId = id;
      if (id) await api.updateFlight(id, payload);
      else savedId = (await api.createFlight(payload)).id;
      const outboxId = params.get('outbox');
      if (outboxId) { removeFromOutbox(outboxId); window.dispatchEvent(new Event(OUTBOX_CHANGED)); }
      if (!id) clearDraft(DRAFT_NAME);
      if (pendingPhotos.length) {
        const failed = await uploadPending(savedId, pendingPhotos);
        if (failed) {
          // The flight itself is saved; keep the person on its edit screen to add the missing photos.
          setPendingPhotos([]);
          setMessage(`Flight saved, but ${failed} photo${failed === 1 ? '' : 's'} didn’t upload. Add ${failed === 1 ? 'it' : 'them'} again below.`);
          setSaving(false);
          navigate(`/logbook/${savedId}/edit`, { replace: true });
          return undefined;
        }
      }
      navigate(id ? `/logbook/${id}` : '/logbook');
    } catch (err) {
      if (isNetworkError(err) && !id && !pendingPhotos.length && enqueue(payload)) {
        // Offline: keep the entry safely on the device and retry automatically (OutboxBanner).
        clearDraft(DRAFT_NAME);
        window.dispatchEvent(new Event(OUTBOX_CHANGED));
        navigate('/logbook');
        return undefined;
      }
      setErrors(err.fieldErrors || {});
      setMessage(err.fieldErrors ? 'Please fix the highlighted fields.'
        : isNetworkError(err) ? `${err.message} Your entry is still here — try again when you’re connected.` : err.message);
      setSaving(false);
    }
    return undefined;
  }

  async function remove() {
    setDeleting(true);
    try {
      await api.deleteFlight(id);
      navigate('/logbook');
    } catch (err) {
      setMessage(err.message);
      setDeleting(false);
    }
  }

  const costOff = Boolean(rates) && isPastCostCutoff(form.date, rates.cost_cutoff_date);

  if (loading) return <p className="text-slate-400">Loading…</p>;

  return (
    <form onSubmit={submit} className="space-y-4 md:mx-auto md:max-w-xl">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(id ? `/logbook/${id}` : '/logbook')} className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800" aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="min-w-0 flex-1 text-2xl font-semibold">{id ? 'Edit flight' : 'Add flight'}</h1>
        {!id && (
          <button type="button" onClick={() => navigate('/logbook/new?copy=last', { replace: true })}
            className="flex h-11 items-center gap-2 rounded-full bg-navy-800 px-4 text-sm text-slate-300 active:text-accent">
            <Copy size={16} />Copy last
          </button>
        )}
      </div>
      {notice && (
        <p role="status" className="flex items-center justify-between gap-3 rounded-xl bg-accent/10 p-3 text-sm text-accent">
          <span>{notice}</span>
          {!id && !params.get('outbox') && (
            <button type="button" onClick={() => { clearDraft(DRAFT_NAME); setForm(blank()); setNotice(''); }} className="h-11 shrink-0 px-2 font-medium underline">Start over</button>
          )}
        </p>
      )}

      <Section title="Flight">
        <div className="col-span-2"><DatePicker label="Date" value={form.date} onChange={set('date')} error={errors.date} /></div>
        <AirportSearchField label="From" value={form.departure_airport} onChange={set('departure_airport')} error={errors.departure_airport} placeholder="KPAO" />
        <AirportSearchField label="To" value={form.arrival_airport} onChange={set('arrival_airport')} error={errors.arrival_airport} placeholder="KSQL" />
        <div className="col-span-2">
          <StopsEditor stops={form.stops} onChange={(stops) => setForm((f) => ({ ...f, stops }))}
            from={form.departure_airport} to={form.arrival_airport} />
          {typeof errors.stops === 'object' && (
            <p className="mt-1 text-xs text-bad">Check the stop airport codes above.</p>
          )}
        </div>
        <div className="col-span-2">
          <AircraftPicker value={form.aircraft_id} error={errors.aircraft_id} onSelect={(a) => setForm((f) => ({
            ...f,
            aircraft_id: a.id,
            aircraft_type: a.is_simulator ? (a.model || '') : (a.type_designator || a.model || f.aircraft_type),
            tail_number: a.is_simulator ? '' : (a.tail_number || f.tail_number),
          }))} />
        </div>
      </Section>

      <Disclosure title="Airline / Operator" defaultOpen={Boolean(form.airline.trim() || form.flight_number.trim())}>
        <div className="col-span-2">
          <TextField label="Airline (optional, for commercial flights)" value={form.airline} onChange={set('airline')} error={errors.airline} placeholder="Delta" list="airline-names" />
          <datalist id="airline-names">{AIRLINE_NAMES.map((n) => <option key={n} value={n} />)}</datalist>
          {form.airline.trim() && <div className="mt-2"><AirlineBadge airline={form.airline} /></div>}
        </div>
        <div className="col-span-2">
          <TextField label="Flight number" upper value={form.flight_number} onChange={set('flight_number')} error={errors.flight_number} placeholder="DL123" />
        </div>
      </Disclosure>

      <Section title="Time (hours — 1.5 or 1:30)">
        {TIME_FIELDS.map(([k, label]) => (
          <div key={k} className={k === 'total_time' ? 'col-span-2' : ''}>
            <HoursInput label={label} value={form[k]} onChange={set(k)} error={errors[k]} />
          </div>
        ))}
      </Section>

      <Section title="Landings">
        <CountInput label="Day landings" value={form.day_landings} onChange={set('day_landings')} error={errors.day_landings} />
        <CountInput label="Day, full stop" value={form.day_landings_full_stop} onChange={set('day_landings_full_stop')} error={errors.day_landings_full_stop} />
        <CountInput label="Night landings" value={form.night_landings} onChange={set('night_landings')} error={errors.night_landings} />
        <CountInput label="Night, full stop" value={form.night_landings_full_stop} onChange={set('night_landings_full_stop')} error={errors.night_landings_full_stop} />
      </Section>

      {costOff ? (
        <section className="card p-4">
          <h2 className="text-sm font-medium text-accent">Cost</h2>
          <p className="mt-1 text-xs text-slate-500">Costs aren't counted for dates on or after {formatDate(rates.cost_cutoff_date)} (your "Commercial certificate date" in Cost settings), so the cost fields are hidden here. Anything already saved on this entry is kept.</p>
        </section>
      ) : (
      <>
      <section className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-accent">Cost</h2>
          <span className="text-xl font-semibold">
            {!previewCost ? '—'
              : previewCost.total !== null ? fmtMoney(previewCost.total)
              : <span className="text-sm font-normal text-slate-500">Not tracked</span>}
          </span>
        </div>
        {previewCost?.total === null && (
          <p className="mt-1 text-xs text-slate-500">This date isn't inside a cost-tracked training phase, so no cost is calculated — set an override below if you want to record one anyway.</p>
        )}
        {previewCost?.missingRate && <p className="mt-1 text-xs text-slate-500">A rate isn't set for part of this flight yet — set it on the Costs screen.</p>}
      </section>

      <Disclosure title="Manual cost override" defaultOpen={Boolean(form.cost_override.trim())}>
        <div className="col-span-2">
          <TextField label="Override (optional, e.g. to match an invoice)" type="number" value={form.cost_override}
            onChange={set('cost_override')} error={errors.cost_override} placeholder="Use calculated cost" />
          {previewCost?.override && previewCost.computedTotal !== null && (
            <p className="mt-1 text-xs text-slate-500">Calculated cost would be {fmtMoney(previewCost.computedTotal)}.</p>
          )}
        </div>
      </Disclosure>
      </>
      )}

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-medium text-accent">Approaches</h2>
        <div className="grid grid-cols-2 gap-3">
          {form.approach_types.length > 0 ? (
            <div>
              <span className="mb-1 block text-xs text-slate-400">Total approaches</span>
              <div className="flex h-12 items-center justify-center rounded-xl border border-edge bg-navy-800 text-base">
                {form.approach_types.reduce((s, a) => s + (Number(a.count) || 0), 0)}
              </div>
            </div>
          ) : (
            <CountInput label="Total approaches" value={form.approaches} onChange={set('approaches')} error={errors.approaches} />
          )}
          <CountInput label="Holds" value={form.holds} onChange={set('holds')} error={errors.holds} />
        </div>
        <div className="mt-3">
          <ApproachesEditor approaches={form.approach_types} onChange={(v) => setForm((f) => ({ ...f, approach_types: v }))} />
          {form.approach_types.length > 0 && <p className="mt-1 text-xs text-slate-500">Total approaches above is the sum of these.</p>}
          {typeof errors.approach_types === 'object' && <p className="mt-1 text-xs text-bad">Check the approach rows above.</p>}
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-medium text-accent">Note</h2>
        <textarea value={form.remarks} onChange={(e) => set('remarks')(e.target.value)} rows={3}
          className="w-full rounded-xl border border-edge bg-navy-800 p-3 text-base outline-none focus:border-accent" />
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-medium text-accent">Photos</h2>
        <PhotoPicker flightId={id} pending={pendingPhotos} onPendingChange={setPendingPhotos} />
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-medium text-accent">Debrief</h2>
        <div className="space-y-3">
          <div>
            <span className="mb-1 block text-xs text-slate-400">What went well</span>
            <textarea value={form.debrief_went_well} onChange={(e) => set('debrief_went_well')(e.target.value)} rows={2}
              className="w-full rounded-xl border border-edge bg-navy-800 p-3 text-base outline-none focus:border-accent" />
          </div>
          <div>
            <span className="mb-1 block text-xs text-slate-400">What to work on</span>
            <textarea value={form.debrief_work_on} onChange={(e) => set('debrief_work_on')(e.target.value)} rows={2}
              className="w-full rounded-xl border border-edge bg-navy-800 p-3 text-base outline-none focus:border-accent" />
          </div>
        </div>
      </section>

      {message && <p className="rounded-xl bg-bad/10 p-3 text-sm text-bad">{message}</p>}

      <Button disabled={saving}>{saving ? 'Saving…' : id ? 'Save changes' : 'Add flight'}</Button>
      {id && (
        <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>Delete flight</Button>
      )}

      <ConfirmDialog open={confirmDelete} title="Delete flight?" description="This cannot be undone."
        confirmLabel="Delete" busy={deleting} onConfirm={remove} onClose={() => setConfirmDelete(false)} />
    </form>
  );
}
