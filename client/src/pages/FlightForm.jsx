import { useEffect, useRef, useState } from 'react';
import SaveBar from '../components/SaveBar.jsx';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, Copy, Luggage } from 'lucide-react';
import { api } from '../lib/api.js';
import { parseHours } from '../lib/hours.js';
import { formatDate } from '../lib/calendar.js';
import HoursInput from '../components/HoursInput.jsx';
import CountInput from '../components/CountInput.jsx';
import TextField from '../components/TextField.jsx';
import AirportSearchField from '../components/AirportSearchField.jsx';
import { OUTBOX_CHANGED } from '../components/OutboxBanner.jsx';
import { approachTotal, followTotal, prefillFromFlight, prefillPassengerFrom, mostRecentFlight, validateFlightPayload } from '../lib/flightDraft.js';
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
import { Segmented } from '../ds/Controls.jsx';
import { AIRLINE_NAMES } from '../lib/airlines.js';
import { FLIGHT_ROLES, pilotFlights } from '../lib/flightRoles.js';
import { SEAT_CLASSES } from '../lib/aviationEnums.js';
import { TIME_FIELDS, HIDDEN_TIME, HIDDEN_FIELDS, blank, fromFlight, toPayload, todayLocal as today } from '../lib/flightFormState.js';
import '../ds/logbook.css';

// Fields under "More details" (an error on any of them opens it, so a problem is never hidden).
const MORE_PILOT = ['stops', 'pic_time', 'dual_received', 'solo_time', 'night_time', 'cross_country_time', 'instrument_actual', 'instrument_simulated',
  'day_landings_full_stop', 'night_landings', 'night_landings_full_stop', 'approaches', 'holds', 'approach_types', 'cost_override', 'remarks'];
const MORE_PAX = ['seat_class', 'confirmation_code', 'aircraft_id', 'remarks', 'stops'];

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
  const [allFlights, setAllFlights] = useState(null); // for the pilot aircraft picker: null while loading, false if it could not be loaded (then it lists everything)
  const [params] = useSearchParams();
  const [notice, setNotice] = useState('');
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
    return { form: { ...fromFlight(d), role: 'pilot' }, note: `Prefilled from your last flight on ${formatDate(last.pilot.date)}${what ? `: ${what}` : ''}. Change anything.` };
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
  useEffect(() => { api.listFlights().then(setAllFlights).catch(() => setAllFlights(false)); }, []);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

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

  const showErrors = (errs) => {
    setErrors(errs);
    if (Object.keys(errs).some((k) => (form.role === 'pilot' ? MORE_PILOT : MORE_PAX).includes(k))) setMore(true); // never hide a problem
  };

  async function submit(e) {
    e.preventDefault();
    const { payload, errors: local } = toPayload(form);
    if (local) return showErrors(local);
    const invalid = validateFlightPayload(payload, { today: today(), skip: payload.role === 'pilot' ? HIDDEN_FIELDS : [] });
    if (Object.keys(invalid).length) {
      showErrors(invalid);
      setMessage('Please fix the highlighted fields.');
      return undefined;
    }
    setSaving(true);
    setErrors({});
    setMessage('');
    try {
      if (id) await api.updateFlight(id, payload);
      else await api.createFlight(payload);
      const outboxId = params.get('outbox');
      if (outboxId) { removeFromOutbox(outboxId); window.dispatchEvent(new Event(OUTBOX_CHANGED)); }
      if (!id) clearDraft(DRAFT_NAME);
      navigate(id ? `${base}/${id}` : base);
    } catch (err) {
      if (isNetworkError(err) && !id && enqueue(payload)) {
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

  const pilot = form.role === 'pilot';
  const typedApproaches = form.approach_types.some((a) => a.approach_type);

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
            </div>
            <AircraftPicker value={form.aircraft_id} error={errors.aircraft_id} pilotFlights={allFlights} onSelect={(a) => setForm((f) => ({
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
                {TIME_FIELDS.filter(([k]) => k !== 'total_time' && !HIDDEN_TIME.has(k)).map(([k, label]) => <HoursInput key={k} label={label} value={form[k]} onChange={set(k)} error={errors[k]} />)}
              </MoreBlock>
              <MoreBlock title="Landings and approaches">
                <CountInput label="Day, full stop" value={form.day_landings_full_stop} onChange={set('day_landings_full_stop')} error={errors.day_landings_full_stop} />
                <CountInput label="Night landings" value={form.night_landings} onChange={set('night_landings')} error={errors.night_landings} />
                <CountInput label="Night, full stop" value={form.night_landings_full_stop} onChange={set('night_landings_full_stop')} error={errors.night_landings_full_stop} />
                {typedApproaches ? (
                  <div className="cl-dl"><div><span className="k">Total approaches</span><span className="v">{approachTotal(form.approach_types)}</span></div></div>
                ) : (
                  <CountInput label="Total approaches" value={form.approaches} onChange={set('approaches')} error={errors.approaches} />
                )}
                <CountInput label="Holds" value={form.holds} onChange={set('holds')} error={errors.holds} />
                <ApproachesEditor approaches={form.approach_types} onChange={(v) => setForm((f) => ({ ...f, approach_types: v }))} />
                {typedApproaches && <p className="cl-note">Total approaches above is the sum of these.</p>}
                {typeof errors.approach_types === 'object' && <p className="cl-note" style={{ color: 'var(--ds-bad)' }}>Check the approach rows above.</p>}
              </MoreBlock>
              <MoreBlock title="Notes">
                <label className="block"><span className="mb-1 block text-xs text-slate-400">Remarks</span>
                  <textarea value={form.remarks} onChange={(e) => set('remarks')(e.target.value)} rows={3} className="gl-field w-full p-3 text-base" /></label>
              </MoreBlock>
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
