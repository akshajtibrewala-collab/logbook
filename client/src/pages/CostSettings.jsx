import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { fmtMoney } from '../lib/cost.js';
import { certificateLabel } from '../lib/milestones.js';
import { todayISO } from '../lib/calendar.js';
import TextField from '../components/TextField.jsx';
import DatePicker from '../components/DatePicker.jsx';
import Button from '../components/Button.jsx';
import Skeleton from '../components/Skeleton.jsx';

function Section({ title, description, children }) {
  return (
    <section className="card space-y-3 p-4">
      <div>
        <h2 className="text-sm font-medium text-slate-400">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** An effective-dated hourly-rate history (instructor/ground/simulator), with an inline add row. */
function HourlyRateHistory({ rows, onCreate, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [rate, setRate] = useState('');
  const sorted = [...rows].sort((a, b) => b.effective_date.localeCompare(a.effective_date));

  const add = async () => {
    await onCreate({ effective_date: date, hourly_rate: rate });
    setAdding(false);
    setRate('');
  };

  return (
    <div className="space-y-2">
      {sorted.length === 0 && !adding && <p className="text-sm text-slate-500">No rate set yet.</p>}
      {sorted.map((r) => (
        <div key={r.id} className="flex items-center justify-between rounded-xl bg-navy-800 px-3 py-2 text-sm">
          <span className="text-slate-400">Effective {r.effective_date}</span>
          <div className="flex items-center gap-2">
            <span className="font-medium">{fmtMoney(r.hourly_rate)}/hr</span>
            <button type="button" onClick={() => onDelete(r.id)} aria-label="Delete rate" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 active:text-bad"><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
      {adding ? (
        <div className="space-y-2 rounded-xl border border-edge p-3">
          <DatePicker label="Effective date" value={date} onChange={setDate} />
          <TextField label="Hourly rate ($)" type="number" value={rate} onChange={setRate} />
          <div className="flex gap-2">
            <Button size="sm" fullWidth={false} onClick={add}>Add</Button>
            <Button size="sm" fullWidth={false} variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-sm text-accent"><Plus size={14} /> Add a rate change</button>
      )}
    </div>
  );
}

function AircraftRateHistory({ aircraft, rows, onCreate, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [rental, setRental] = useState('');
  const [fuel, setFuel] = useState('0');
  const sorted = [...rows].sort((a, b) => b.effective_date.localeCompare(a.effective_date));

  const add = async () => {
    await onCreate({ aircraft_id: aircraft.id, effective_date: date, rental_rate_per_hr: rental, fuel_surcharge_per_hr: fuel });
    setAdding(false);
    setRental('');
  };

  return (
    <div className="space-y-2 border-t border-edge pt-3 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-medium">{aircraft.tail_number || aircraft.model || `Aircraft #${aircraft.id}`}</h3>
      {sorted.length === 0 && !adding && <p className="text-xs text-slate-500">No rate set yet.</p>}
      {sorted.map((r) => (
        <div key={r.id} className="flex items-center justify-between rounded-xl bg-navy-800 px-3 py-2 text-sm">
          <span className="text-slate-400">Effective {r.effective_date}</span>
          <div className="flex items-center gap-2">
            <span className="font-medium">{fmtMoney(r.rental_rate_per_hr)}/hr + {fmtMoney(r.fuel_surcharge_per_hr)}/hr fuel</span>
            <button type="button" onClick={() => onDelete(r.id)} aria-label="Delete rate" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 active:text-bad"><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
      {adding ? (
        <div className="space-y-2 rounded-xl border border-edge p-3">
          <DatePicker label="Effective date" value={date} onChange={setDate} />
          <TextField label="Rental rate ($/hr)" type="number" value={rental} onChange={setRental} />
          <TextField label="Fuel surcharge ($/hr)" type="number" value={fuel} onChange={setFuel} />
          <div className="flex gap-2">
            <Button size="sm" fullWidth={false} onClick={add}>Add</Button>
            <Button size="sm" fullWidth={false} variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-sm text-accent"><Plus size={14} /> Add a rate change</button>
      )}
    </div>
  );
}

function TrainingPhase({ certificate, phase, onSave, onDelete }) {
  const [start, setStart] = useState(phase?.start_date ?? todayISO());
  const [end, setEnd] = useState(phase?.end_date ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try { await onSave(certificate, { start_date: start, end_date: end || null }); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-2 border-t border-edge pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{certificateLabel(certificate)}</h3>
        {phase && <button type="button" onClick={() => onDelete(certificate)} aria-label="Clear phase" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 active:text-bad"><Trash2 size={14} /></button>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <DatePicker label="Start" value={start} onChange={setStart} />
        <DatePicker label="End (blank = ongoing)" value={end} onChange={setEnd} clearable />
      </div>
      <Button size="sm" fullWidth={false} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save phase'}</Button>
    </div>
  );
}

export default function CostSettings() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');
  const [settingsForm, setSettingsForm] = useState({ default_ground_time: '', private_realistic_total_hours: '' });
  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api.listAircraft(true), api.listAircraftRates(), api.listInstructorRates(), api.listGroundRates(),
      api.listSimulatorRates(), api.listTrainingPhases(), api.listMilestonesConfig(), api.getSettings(),
    ])
      .then(([aircraft, aircraftRates, instructorRates, groundRates, simulatorRates, phases, milestonesConfig, settings]) => {
        setData({ aircraft, aircraftRates, instructorRates, groundRates, simulatorRates, phases, milestonesConfig });
        setSettingsForm({
          default_ground_time: settings.default_ground_time == null ? '' : String(settings.default_ground_time),
          private_realistic_total_hours: settings.private_realistic_total_hours == null ? '' : String(settings.private_realistic_total_hours),
        });
      })
      .catch((e) => setMessage(e.message));
  }, []);
  useEffect(load, [load]);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.updateSettings(settingsForm);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  if (!data) return <><Skeleton className="h-8 w-40" /><Skeleton className="mt-4 h-64" /></>;

  const certs = [...new Set(data.milestonesConfig.map((r) => r.certificate))];
  const phaseByCert = Object.fromEntries(data.phases.map((p) => [p.certificate, p]));

  return (
    <div className="space-y-4 md:mx-auto md:max-w-xl">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/costs')} className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800" aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-semibold">Cost settings</h1>
      </div>

      {message && <p className="rounded-xl bg-bad/10 p-3 text-sm text-bad">{message}</p>}

      <Section title="Instructor rate">
        <HourlyRateHistory rows={data.instructorRates}
          onCreate={async (r) => { await api.createInstructorRate(r); load(); }}
          onDelete={async (id) => { await api.deleteInstructorRate(id); load(); }} />
      </Section>

      <Section title="Ground instruction rate">
        <HourlyRateHistory rows={data.groundRates}
          onCreate={async (r) => { await api.createGroundRate(r); load(); }}
          onDelete={async (id) => { await api.deleteGroundRate(id); load(); }} />
      </Section>

      <Section title="Simulator rate" description="Leave blank if you don't fly a simulator yet.">
        <HourlyRateHistory rows={data.simulatorRates}
          onCreate={async (r) => { await api.createSimulatorRate(r); load(); }}
          onDelete={async (id) => { await api.deleteSimulatorRate(id); load(); }} />
      </Section>

      <Section title="Aircraft rental rates" description="One rate history per aircraft — a new flight uses whichever rate is effective on its own date.">
        {data.aircraft.length === 0 ? (
          <p className="text-sm text-slate-500">Add an aircraft first, on the Aircraft screen.</p>
        ) : (
          data.aircraft.map((a) => (
            <AircraftRateHistory key={a.id} aircraft={a} rows={data.aircraftRates.filter((r) => r.aircraft_id === a.id)}
              onCreate={async (r) => { await api.createAircraftRate(r); load(); }}
              onDelete={async (id) => { await api.deleteAircraftRate(id); load(); }} />
          ))
        )}
      </Section>

      <Section title="Default settings">
        <TextField label="Default ground briefing time (hrs)" type="number" value={settingsForm.default_ground_time}
          onChange={(v) => setSettingsForm((f) => ({ ...f, default_ground_time: v }))} placeholder="Not set" />
        <TextField label="Private pilot: realistic total hours target" type="number" value={settingsForm.private_realistic_total_hours}
          onChange={(v) => setSettingsForm((f) => ({ ...f, private_realistic_total_hours: v }))} placeholder="Defaults to the 40hr FAA minimum" />
        <Button size="sm" fullWidth={false} onClick={saveSettings} disabled={savingSettings}>{savingSettings ? 'Saving…' : 'Save'}</Button>
      </Section>

      <Section title="Training phases" description="Each certificate's own date range, used to split total spend per certificate. A blank end date means still in progress.">
        {certs.map((c) => (
          <TrainingPhase key={c} certificate={c} phase={phaseByCert[c]}
            onSave={async (cert, phase) => { await api.setTrainingPhase(cert, phase); load(); }}
            onDelete={async (cert) => { await api.deleteTrainingPhase(cert); load(); }} />
        ))}
      </Section>
    </div>
  );
}
