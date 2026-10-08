import { useEffect, useRef, useState } from 'react';
import SaveBar from '../components/SaveBar.jsx';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, Copy, Luggage } from 'lucide-react';
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
import { followTotal, prefillFromFlight, prefillPassengerFrom, mostRecentFlight, validateFlightPayload } from '../lib/flightDraft.js';
import { saveDraft, loadDraft, clearDraft, enqueue, outboxList, removeFromOutbox, isNetworkError } from '../lib/outbox.js';
import DatePicker from '../components/DatePicker.jsx';
import AirlineBadge from '../components/AirlineBadge.jsx';
import Button from '../components/Button.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import AircraftPicker from '../components/AircraftPicker.jsx';
import PassengerTimeFields from '../components/PassengerTimeFields.jsx';
import StopsEditor from '../components/StopsEditor.jsx';
import ApproachesEditor from '../components/ApproachesEditor.jsx';
import BigHours from '../components/calm/BigHours.jsx';
import Select from '../components/Select.jsx';
import useInstructorNames from '../hooks/useInstructorNames.js';
import { Segmented } from '../ds/Controls.jsx';
import { AIRLINE_NAMES } from '../lib/airlines.js';
import { FLIGHT_ROLES, pilotFlights } from '../lib/flightRoles.js';
import { SEAT_CLASSES } from '../lib/aviationEnums.js';
import '../ds/logbook.css';

const TIME_FIELDS = [
  ['total_time', 'Total'], ['pic_time', 'PIC'], ['sic_time', 'SIC'],
  ['dual_received', 'Dual received'], ['dual_given', 'Dual given'],
  ['solo_time', 'Solo'], ['simulator_time', 'Simulator'], ['ground_time', 'Ground instruction'],
  ['night_time', 'Night'], ['cross_country_time', 'Cross-country'],
  ['instrument_actual', 'Instrument (actual)'], ['instrument_simulated', 'Instrument (simulated)'],
];
const COUNT_FIELDS = ['day_landings', 'day_landings_full_stop', 'night_landings', 'night_landings_full_stop', 'approaches', 'holds'];
// Fields under "More details" (an error on any of them opens it, so a problem is never hidden).
const MORE_PILOT = ['stops', 'pic_time', 'sic_time', 'dual_received', 'dual_given', 'solo_time', 'simulator_time', 'ground_time', 'night_time', 'cross_country_time', 'instrument_actual', 'instrument_simulated',
  'day_landings_full_stop', 'night_landings', 'night_landings_full_stop', 'approaches', 'holds', 'approach_types', 'cost_override', 'airline', 'flight_number', 'remarks', 'debrief_went_well', 'debrief_work_on'];
const MORE_PAX = ['seat_class', 'confirmation_code', 'aircraft_id', 'remarks', 'stops'];

const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

const blank = (role) => ({
  date: today(), role: role === 'passenger' ? 'passenger' : 'pilot', departure_airport: '', arrival_airport: '', route: '', stops: [], aircraft_id: null, aircraft_type: '', tail_number: '',
  airline: '', flight_number: '', seat_class: '', confirmation_code: '', remarks: '', debrief_went_well: '', debrief_work_on: '', approach_types: [], cost_override: '',
  instructor: '', invoice_ref: '', // carried through unchanged on edit: the server replaces the whole row, so leaving them out would erase them
  dep_time: '', arr_time: '', arr_day_offset: '',
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

/** A titled block inside "More details". */
function MoreBlock({ title, children }) {
  return <div className="cl-grp"><h3>{title}</h3>{children}</div>;
}

/**
 * Log a flight, or edit one: a focused, step-light screen with the Save bar always in reach. ONE form for both roles: the Pilot / Passenger switch
 * swaps the fields and the accent. The first screen asks only for what changes flight to flight (date, route, time, landings) and is prefilled from
 * the last flight; everything else is under "More details". ?role=passenger preselects the role and ?from=travel returns to Travel.
 */
export default function FlightForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  // ?role=passenger preselects the role for a brand-new flight (the Passenger flights page's add
  // button); read eagerly from the raw URL so the first render already shows the right selection,
  // rather than flashing Pilot and then switching once useSearchParams settles.
  const [form, setForm] = useState(() => blank(new URLSearchParams(window.location.search).get('role')));
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
  const instructors = useInstructorNames(); // names already used, offered as suggestions so a spelling can't drift
  const [notice, setNotice] = useState('');
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [more, setMore] = useState(Boolean(id)); // editing shows everything; a new flight starts with the short form
  // ?from=travel means this form was opened from the Passenger flights page, so back/save/delete should
  // return there instead of the pilot logbook.
  const base = params.get('from') === 'travel' ? '/travel' : '/logbook';
  const draftReady = useRef(false); // autosave starts only after any restore/prefill has happened
  const pristine = useRef(null); // JSON of the prefilled form: while the form still equals it, switching role re-prefills for the new role
  const lastFlights = useRef(null); // { pilot, passenger }: the most recent flight of each role, loaded once

  /** The last flight of each role, once (the pilot one in full, with its stops and approaches). */
  async function loadLast() {
    if (lastFlights.current) return lastFlights.current;
    const list = await api.listFlights();
    const lastPilot = mostRecentFlight(pilotFlights(list));
    const lastPax = mostRecentFlight(list.filter((f) => f.role === 'passenger'));
    lastFlights.current = { pilot: lastPilot ? await api.getFlight(lastPilot.id) : null, passenger: lastPax };
    return lastFlights.current;
  }
  const prefillFor = (role, last) => {
    if (role === 'passenger') {
      const d = prefillPassengerFrom(last.passenger, today());
      return d ? { form: { ...blank('passenger'), ...fromFlight(d), role: 'passenger' }, note: `Prefilled the airline and seat class from your last passenger flight on ${formatDate(last.passenger.date)}. Change anything.` } : null;
    }
    if (!last.pilot) return null;
    const d = prefillFromFlight(last.pilot, today());
    const what = [last.pilot.aircraft_type, last.pilot.tail_number].filter(Boolean).join(' ');
    return { form: { ...fromFlight(d), role: 'pilot' }, note: `Prefilled from your last flight on ${formatDate(last.pilot.date)}${what ? `: ${what}` : ''}${last.pilot.instructor ? `, ${last.pilot.instructor}` : ''}. Change anything.` };
  };

  useEffect(() => {
    if (id) {
      api.getFlight(id).then((f) => setForm(fromFlight(f))).catch((e) => setMessage(e.message)).finally(() => { setLoading(false); draftReady.current = true; });
      return undefined;
    }
    // New flight: start from (in priority order) a queued entry being fixed, the last flight (Copy last),
    // an unsaved draft from an earlier visit, or the last flight of the chosen role; otherwise a blank form.
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
      loadLast()
        .then((last) => {
          // Copy last is for repeating your own flying — the most recent PILOT flight, never a
          // passenger one, so an airline/flight_number/aircraft from a commercial trip never
          // leaks into what's meant to become a new logged-time flight.
          const p = prefillFor('pilot', last);
          if (!p) { setNotice('There’s no previous flight to copy yet.'); return; }
          setForm(p.form); pristine.current = JSON.stringify(p.form);
          setNotice(p.note.replace('Prefilled from', 'Copied from'));
        })
        .catch((e) => setMessage(e.message))
        .finally(() => { setLoading(false); draftReady.current = true; });
      return undefined;
    }
    const draft = loadDraft(DRAFT_NAME);
    const wantedRole = params.get('role'); // an explicit ?role= wins over a draft of the other role
    if (draft?.value && (!wantedRole || (draft.value.role ?? 'pilot') === wantedRole)) {
      setForm({ ...blank(params.get('role')), ...draft.value });
      setNotice('Restored your unsaved flight from earlier.');
      draftReady.current = true;
      return undefined;
    }
    // Nothing to restore: prefill from the last flight of this role (a quiet failure leaves the blank form).
    const role = params.get('role') === 'passenger' ? 'passenger' : 'pilot';
    setLoading(true);
    loadLast()
      .then((last) => {
        const p = prefillFor(role, last);
        if (p) { setForm(p.form); pristine.current = JSON.stringify(p.form); setNotice(p.note); }
      })
      .catch(() => {})
      .finally(() => { setLoading(false); draftReady.current = true; });
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

  /** Switching role on an untouched, prefilled new flight re-prefills for the new role; otherwise only the role changes. */
  async function chooseRole(role) {
    if (role === form.role) return;
    if (!id && pristine.current !== null && JSON.stringify(form) === pristine.current) {
      try {
        const p = prefillFor(role, await loadLast());
        const next = p ? p.form : blank(role);
        setForm(next); pristine.current = JSON.stringify(next); setNotice(p ? p.note : '');
        return;
      } catch { /* fall through to a plain switch */ }
    }
    set('role')(role);
  }

  const previewCost = rates && phases ? computeFlightCost({
    date: form.date, aircraft_id: form.aircraft_id,
    total_time: parseHours(form.total_time) || 0, simulator_time: parseHours(form.simulator_time) || 0,
    dual_received: parseHours(form.dual_received) || 0, ground_time: parseHours(form.ground_time) || 0,
    cost_override: form.cost_override.trim() === '' ? null : form.cost_override,
  }, rates, phases) : null;

  const showErrors = (errs) => {
    setErrors(errs);
    if (Object.keys(errs).some((k) => (form.role === 'pilot' ? MORE_PILOT : MORE_PAX).includes(k))) setMore(true); // never hide a problem
  };

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
    if (Object.keys(local).length) return showErrors(local);
    const invalid = validateFlightPayload(payload, { today: today() });
    if (Object.keys(invalid).length) {
      showErrors(invalid);
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
          navigate(`/logbook/${savedId}/edit${base === '/travel' ? '?from=travel' : ''}`, { replace: true });
          return undefined;
        }
      }
      navigate(id ? `${base}/${id}` : base);
    } catch (err) {
      if (isNetworkError(err) && !id && !pendingPhotos.length && enqueue(payload)) {
        // Offline: keep the entry safely on the device and retry automatically (OutboxBanner).
        clearDraft(DRAFT_NAME);
        window.dispatchEvent(new Event(OUTBOX_CHANGED));
        navigate(base);
        return undefined;
      }
      showErrors(err.fieldErrors || {});
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
      navigate(base);
    } catch (err) {
      setMessage(err.message);
      setDeleting(false);
    }
  }

  const costOff = Boolean(rates) && isPastCostCutoff(form.date, rates.cost_cutoff_date);
  const pilot = form.role === 'pilot';

  if (loading) return <p className="ds-sub" role="status">Loading…</p>;

  return (
    <form onSubmit={submit} className={`cl mn mn-form md:mx-auto md:max-w-xl ${pilot ? '' : 'pax role-pax-scope'}`}>
      <div className="cl-form">
        <Segmented label="Flight role" scope={pilot ? 'pilot' : 'pax'} value={form.role} onChange={chooseRole}
          options={FLIGHT_ROLES.map((r) => ({ value: r.value, label: r.label, role: r.value === 'passenger' ? 'pax' : 'pilot' }))} />

        {notice && (
          <p role="status" className="cl-pre">
            {pilot ? <Copy aria-hidden="true" /> : <Luggage aria-hidden="true" />}
            <span>{notice}</span>
            {!id && !params.get('outbox') && <button type="button" onClick={() => { clearDraft(DRAFT_NAME); setForm(blank(form.role)); pristine.current = null; setNotice(''); }} className="gl link sm" style={{ marginLeft: 'auto' }}>Start over</button>}
          </p>
        )}
        {!pilot && !notice && <p className="cl-pre"><Luggage aria-hidden="true" /><span>A passenger flight doesn’t count toward your logbook hours, currency or milestones — just the map and your travel history.</span></p>}

        {/* ---- the short form: what changes flight to flight ---- */}
        {pilot ? (
          <>
            <div className="cl-two">
              <DatePicker label="Date" value={form.date} onChange={set('date')} error={errors.date} />
              <div>
                <TextField label="Instructor" value={form.instructor} onChange={set('instructor')} error={errors.instructor} placeholder="Optional" list="instructor-names" />
                <datalist id="instructor-names">{instructors.map((n) => <option key={n} value={n} />)}</datalist>
              </div>
            </div>
            <AircraftPicker value={form.aircraft_id} error={errors.aircraft_id} onSelect={(a) => setForm((f) => ({
              ...f,
              aircraft_id: a.id,
              aircraft_type: a.is_simulator ? (a.model || '') : (a.type_designator || a.model || f.aircraft_type),
              tail_number: a.is_simulator ? '' : (a.tail_number || f.tail_number),
            }))} />
            <div className="cl-two">
              <AirportSearchField label="From" value={form.departure_airport} onChange={set('departure_airport')} error={errors.departure_airport} placeholder="KPAO" />
              <AirportSearchField label="To" value={form.arrival_airport} onChange={set('arrival_airport')} error={errors.arrival_airport} placeholder="KSQL" />
            </div>
            <BigHours value={form.total_time} onChange={(v) => setForm((f) => ({ ...f, total_time: v, ...followTotal(f, v, parseHours) }))} error={errors.total_time} />
            <CountInput label="Day landings" value={form.day_landings} onChange={set('day_landings')} error={errors.day_landings} />
          </>
        ) : (
          <>
            <div className="cl-two">
              <DatePicker label="Date" value={form.date} onChange={set('date')} error={errors.date} />
              <div>
                <TextField label="Airline" value={form.airline} onChange={set('airline')} error={errors.airline} placeholder="Delta" list="airline-names" />
                <datalist id="airline-names">{AIRLINE_NAMES.map((n) => <option key={n} value={n} />)}</datalist>
              </div>
            </div>
            {form.airline.trim() && <AirlineBadge airline={form.airline} />}
            <div className="cl-two">
              <AirportSearchField label="From" value={form.departure_airport} onChange={set('departure_airport')} error={errors.departure_airport} placeholder="KPAO" />
              <AirportSearchField label="To" value={form.arrival_airport} onChange={set('arrival_airport')} error={errors.arrival_airport} placeholder="KSQL" />
            </div>
            <TextField label="Flight number" upper value={form.flight_number} onChange={set('flight_number')} error={errors.flight_number} placeholder="DL123" />
            <div className="cl-grp">
              <span className="ds-cap">Times and flight time</span>
              <PassengerTimeFields
                value={{
                  date: form.date, departure_airport: form.departure_airport, arrival_airport: form.arrival_airport,
                  dep_time: form.dep_time, arr_time: form.arr_time, arr_day_offset: form.arr_day_offset, total_time: form.total_time,
                }}
                onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                errors={errors}
              />
            </div>
          </>
        )}

        {/* ---- everything else, one tap down ---- */}
        <div className="cl-grp" style={{ gap: 0 }}>
          <button type="button" className={`cl-disc ${more ? 'open' : ''}`} aria-expanded={more} onClick={() => setMore((m) => !m)}>
            <span>More details</span>{more ? <ChevronUp className="cl-chev" aria-hidden="true" /> : <ChevronDown className="cl-chev" aria-hidden="true" />}
          </button>
          {more && (pilot ? (
            <div className="cl-open">
              <MoreBlock title="Via stops">
                <StopsEditor stops={form.stops} onChange={(stops) => setForm((f) => ({ ...f, stops }))} from={form.departure_airport} to={form.arrival_airport} />
                {typeof errors.stops === 'object' && <p className="cl-note" style={{ color: 'var(--ds-bad)' }}>Check the stop airport codes above.</p>}
              </MoreBlock>
              <MoreBlock title="Time (hours — 1.5 or 1:30)">
                {TIME_FIELDS.filter(([k]) => k !== 'total_time').map(([k, label]) => <HoursInput key={k} label={label} value={form[k]} onChange={set(k)} error={errors[k]} />)}
              </MoreBlock>
              <MoreBlock title="Landings and approaches">
                <CountInput label="Day, full stop" value={form.day_landings_full_stop} onChange={set('day_landings_full_stop')} error={errors.day_landings_full_stop} />
                <CountInput label="Night landings" value={form.night_landings} onChange={set('night_landings')} error={errors.night_landings} />
                <CountInput label="Night, full stop" value={form.night_landings_full_stop} onChange={set('night_landings_full_stop')} error={errors.night_landings_full_stop} />
                {form.approach_types.length > 0 ? (
                  <div className="cl-dl"><div><span className="k">Total approaches</span><span className="v">{form.approach_types.reduce((s, a) => s + (Number(a.count) || 0), 0)}</span></div></div>
                ) : (
                  <CountInput label="Total approaches" value={form.approaches} onChange={set('approaches')} error={errors.approaches} />
                )}
                <CountInput label="Holds" value={form.holds} onChange={set('holds')} error={errors.holds} />
                <ApproachesEditor approaches={form.approach_types} onChange={(v) => setForm((f) => ({ ...f, approach_types: v }))} />
                {form.approach_types.length > 0 && <p className="cl-note">Total approaches above is the sum of these.</p>}
                {typeof errors.approach_types === 'object' && <p className="cl-note" style={{ color: 'var(--ds-bad)' }}>Check the approach rows above.</p>}
              </MoreBlock>
              <MoreBlock title="Airline or operator (commercial flights)">
                <div>
                  <TextField label="Airline" value={form.airline} onChange={set('airline')} error={errors.airline} placeholder="Delta" list="airline-names" />
                  <datalist id="airline-names">{AIRLINE_NAMES.map((n) => <option key={n} value={n} />)}</datalist>
                  {form.airline.trim() && <div style={{ marginTop: 8 }}><AirlineBadge airline={form.airline} /></div>}
                </div>
                <TextField label="Flight number" upper value={form.flight_number} onChange={set('flight_number')} error={errors.flight_number} placeholder="DL123" />
              </MoreBlock>
              <MoreBlock title="Invoice">
                <TextField label="Invoice reference (optional)" value={form.invoice_ref} onChange={set('invoice_ref')} error={errors.invoice_ref} placeholder="00-000000" />
              </MoreBlock>
              <MoreBlock title="Cost">
                {costOff ? (
                  <p className="cl-note">Costs aren’t counted for dates on or after {formatDate(rates.cost_cutoff_date)} (your “Commercial certificate date” in Cost settings), so the cost fields are hidden here. Anything already saved on this entry is kept.</p>
                ) : (
                  <>
                    <div className="cl-dl"><div><span className="k">Calculated cost</span><span className="v">{!previewCost ? '—' : previewCost.total !== null ? fmtMoney(previewCost.total) : 'Not tracked'}</span></div></div>
                    {previewCost?.total === null && <p className="cl-note">This date isn’t inside a cost-tracked training phase, so no cost is calculated — set an override below if you want to record one anyway.</p>}
                    {previewCost?.missingRate && <p className="cl-note">A rate isn’t set for part of this flight yet — set it on the Costs screen.</p>}
                    <TextField label="Manual override (optional, e.g. to match an invoice)" type="number" value={form.cost_override} onChange={set('cost_override')} error={errors.cost_override} placeholder="Use calculated cost" />
                    {previewCost?.override && previewCost.computedTotal !== null && <p className="cl-note">Calculated cost would be {fmtMoney(previewCost.computedTotal)}.</p>}
                  </>
                )}
              </MoreBlock>
              <MoreBlock title="Notes">
                <label className="block"><span className="mb-1 block text-xs text-slate-400">Remarks</span>
                  <textarea value={form.remarks} onChange={(e) => set('remarks')(e.target.value)} rows={3} className="gl-field w-full p-3 text-base" /></label>
                <label className="block"><span className="mb-1 block text-xs text-slate-400">What went well</span>
                  <textarea value={form.debrief_went_well} onChange={(e) => set('debrief_went_well')(e.target.value)} rows={2} className="gl-field w-full p-3 text-base" /></label>
                <label className="block"><span className="mb-1 block text-xs text-slate-400">What to work on</span>
                  <textarea value={form.debrief_work_on} onChange={(e) => set('debrief_work_on')(e.target.value)} rows={2} className="gl-field w-full p-3 text-base" /></label>
              </MoreBlock>
              <MoreBlock title="Photos"><PhotoPicker flightId={id} pending={pendingPhotos} onPendingChange={setPendingPhotos} /></MoreBlock>
            </div>
          ) : (
            <div className="cl-open">
              <Select label="Seat class" value={form.seat_class} onChange={set('seat_class')} options={SEAT_CLASSES} placeholder="Not set" />
              <TextField label="Confirmation code" upper value={form.confirmation_code} onChange={set('confirmation_code')} placeholder="ABC123" />
              <AircraftPicker value={form.aircraft_id} error={errors.aircraft_id} onSelect={(a) => setForm((f) => ({
                ...f,
                aircraft_id: a.id,
                aircraft_type: a.is_simulator ? (a.model || '') : (a.type_designator || a.model || f.aircraft_type),
                tail_number: a.is_simulator ? '' : (a.tail_number || f.tail_number),
              }))} />
              <MoreBlock title="Via stops">
                <StopsEditor stops={form.stops} onChange={(stops) => setForm((f) => ({ ...f, stops }))} from={form.departure_airport} to={form.arrival_airport} />
              </MoreBlock>
              <label className="block"><span className="mb-1 block text-xs text-slate-400">Note</span>
                <textarea value={form.remarks} onChange={(e) => set('remarks')(e.target.value)} rows={3} className="gl-field w-full p-3 text-base" /></label>
              <MoreBlock title="Photos"><PhotoPicker flightId={id} pending={pendingPhotos} onPendingChange={setPendingPhotos} /></MoreBlock>
            </div>
          ))}
        </div>

        {message && <p className="cl-error" role="alert">{message}</p>}
      </div>

      <SaveBar>
        <Button disabled={saving} variant={pilot ? 'primary' : 'pax'} size="lg">{saving ? 'Saving…' : id ? 'Save changes' : 'Add flight'}</Button>
        {id && (
          <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>Delete flight</Button>
        )}
      </SaveBar>

      <ConfirmDialog open={confirmDelete} title="Delete flight?" description="This cannot be undone."
        confirmLabel="Delete" busy={deleting} onConfirm={remove} onClose={() => setConfirmDelete(false)} />
    </form>
  );
}
