import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { fmtMoney } from '../lib/cost.js';
import { certificateLabel } from '../lib/milestones.js';
import { todayISO, formatDate } from '../lib/calendar.js';
import TextField from '../components/TextField.jsx';
import DatePicker from '../components/DatePicker.jsx';
import Toggle from '../components/Toggle.jsx';
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
function HourlyRateHistory({ certificate, rows, onCreate, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [rate, setRate] = useState('');
  const sorted = [...rows].sort((a, b) => b.effective_date.localeCompare(a.effective_date));

  const add = async () => {
    await onCreate({ certificate, effective_date: date, hourly_rate: rate });
    setAdding(false);
    setRate('');
  };

  return (
    <div className="space-y-2">
      {sorted.length === 0 && !adding && <p className="text-sm text-slate-500">No rate set yet.</p>}
      {sorted.map((r) => (
        <div key={r.id} className="flex items-center justify-between rounded-xl bg-navy-800 px-3 py-2 text-sm">
          <span className="text-slate-400">Effective {formatDate(r.effective_date)}</span>
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

function PlannedCosts({ certificate, rows, onCreate, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const add = async () => {
    await onCreate({ certificate, label, amount });
    setAdding(false); setLabel(''); setAmount('');
  };
  return (
    <div className="space-y-2">
      {rows.length === 0 && !adding && <p className="text-sm text-slate-500">None yet — e.g. checkride examiner fee, written test fee.</p>}
      {rows.map((r) => (
        <div key={r.id} className="flex items-center justify-between rounded-xl bg-navy-800 px-3 py-2 text-sm">
          <span className="text-slate-300">{r.label}</span>
          <div className="flex items-center gap-2">
            <span className="font-medium">{fmtMoney(r.amount)}</span>
            <button type="button" onClick={() => onDelete(r.id)} aria-label="Delete planned cost" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 active:text-bad"><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
      {adding ? (
        <div className="space-y-2 rounded-xl border border-edge p-3">
          <TextField label="What is it?" value={label} onChange={setLabel} placeholder="Checkride examiner fee" />
          <TextField label="Amount ($)" type="number" value={amount} onChange={setAmount} />
          <div className="flex gap-2">
            <Button size="sm" fullWidth={false} onClick={add}>Add</Button>
            <Button size="sm" fullWidth={false} variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-sm text-accent"><Plus size={14} /> Add a one-time cost</button>
      )}
    </div>
  );
}

function AircraftRateHistory({ certificate, aircraft, rows, onCreate, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [rental, setRental] = useState('');
  const [fuel, setFuel] = useState('0');
  const sorted = [...rows].sort((a, b) => b.effective_date.localeCompare(a.effective_date));

  const add = async () => {
    await onCreate({ certificate, aircraft_id: aircraft.id, effective_date: date, rental_rate_per_hr: rental, fuel_surcharge_per_hr: fuel });
    setAdding(false);
    setRental('');
  };

  return (
    <div className="space-y-2 border-t border-edge pt-3 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-medium">{aircraft.tail_number || aircraft.model || `Aircraft #${aircraft.id}`}</h3>
      {sorted.length === 0 && !adding && <p className="text-xs text-slate-500">No rate set yet.</p>}
      {sorted.map((r) => (
        <div key={r.id} className="flex items-center justify-between rounded-xl bg-navy-800 px-3 py-2 text-sm">
          <span className="text-slate-400">Effective {formatDate(r.effective_date)}</span>
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

/**
 * One training phase: its own date range, a cost-tracking toggle, and its own complete rate history
 * (instructor/ground/simulator/per-aircraft) — nothing here is shared with any other phase, which is what
 * lets ending a phase (an end date) freeze its totals: a later rate change is always a *different*
 * phase's row.
 */
function PhaseCard({
  certificate, phase, aircraft, aircraftRates, instructorRates, groundRates, simulatorRates, plannedCosts,
  onSavePhase, onCreateRate, onDeleteRate, onCreatePlanned, onDeletePlanned, defaultOpen,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [start, setStart] = useState(phase?.start_date ?? todayISO());
  const [end, setEnd] = useState(phase?.end_date ?? '');
  const [trackCosts, setTrackCosts] = useState(phase?.track_costs !== 0);
  const [saving, setSaving] = useState(false);

  const savePhase = async () => {
    setSaving(true);
    try { await onSavePhase(certificate, { start_date: start, end_date: end || null, track_costs: trackCosts }); } finally { setSaving(false); }
  };

  return (
    <section className="card p-0">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between p-4 text-left">
        <div>
          <h2 className="text-base font-semibold">{certificateLabel(certificate)}</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {phase ? `${formatDate(phase.start_date)} – ${phase.end_date ? formatDate(phase.end_date) : 'ongoing'}${phase.track_costs ? '' : ' · costs not tracked'}` : 'Not started'}
          </p>
        </div>
        <ChevronDown size={18} className={`shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-edge p-4">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <DatePicker label="Start" value={start} onChange={setStart} />
              <DatePicker label="End (blank = still in progress)" value={end} onChange={setEnd} clearable />
            </div>
            <Toggle label="Track costs for this phase" description="Flights and ground sessions in this date range get a calculated cost, using this phase's own rates below."
              checked={trackCosts} onChange={setTrackCosts} />
            <Button size="sm" fullWidth={false} onClick={savePhase} disabled={saving}>{saving ? 'Saving…' : 'Save phase'}</Button>
          </div>

          <div className="space-y-3 border-t border-edge pt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Instructor rate</h3>
            <HourlyRateHistory certificate={certificate} rows={instructorRates}
              onCreate={(r) => onCreateRate('instructor', r)} onDelete={(id) => onDeleteRate('instructor', id)} />
          </div>
          <div className="space-y-3 border-t border-edge pt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Ground instruction rate</h3>
            <HourlyRateHistory certificate={certificate} rows={groundRates}
              onCreate={(r) => onCreateRate('ground', r)} onDelete={(id) => onDeleteRate('ground', id)} />
          </div>
          <div className="space-y-3 border-t border-edge pt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Simulator rate</h3>
            <p className="text-xs text-slate-500">Leave blank if you don't fly a simulator in this phase.</p>
            <HourlyRateHistory certificate={certificate} rows={simulatorRates}
              onCreate={(r) => onCreateRate('simulator', r)} onDelete={(id) => onDeleteRate('simulator', id)} />
          </div>
          <div className="space-y-3 border-t border-edge pt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">One-time costs still ahead</h3>
            <p className="text-xs text-slate-500">Added to both projection estimates on the Costs page.</p>
            <PlannedCosts certificate={certificate} rows={plannedCosts} onCreate={onCreatePlanned} onDelete={onDeletePlanned} />
          </div>
          <div className="space-y-3 border-t border-edge pt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Aircraft rental rates</h3>
            {aircraft.length === 0 ? (
              <p className="text-sm text-slate-500">Add an aircraft first, on the Aircraft screen.</p>
            ) : (
              aircraft.map((a) => (
                <AircraftRateHistory key={a.id} certificate={certificate} aircraft={a}
                  rows={aircraftRates.filter((r) => r.aircraft_id === a.id)}
                  onCreate={(r) => onCreateRate('aircraft', r)} onDelete={(id) => onDeleteRate('aircraft', id)} />
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}

const RATE_API = {
  instructor: { create: api.createInstructorRate, delete: api.deleteInstructorRate },
  ground: { create: api.createGroundRate, delete: api.deleteGroundRate },
  simulator: { create: api.createSimulatorRate, delete: api.deleteSimulatorRate },
  aircraft: { create: api.createAircraftRate, delete: api.deleteAircraftRate },
};

export default function CostSettings() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');
  const [settingsForm, setSettingsForm] = useState({ default_ground_time: '', private_realistic_total_hours: '' });
  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api.listAircraft(true), api.listAircraftRates(), api.listInstructorRates(), api.listGroundRates(),
      api.listSimulatorRates(), api.listTrainingPhases(), api.listMilestonesConfig(), api.getSettings(), api.listPlannedCosts(),
    ])
      .then(([aircraft, aircraftRates, instructorRates, groundRates, simulatorRates, phases, milestonesConfig, settings, plannedCosts]) => {
        setData({ aircraft, aircraftRates, instructorRates, groundRates, simulatorRates, phases, milestonesConfig, plannedCosts });
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

  // Every certificate a phase could exist for: ones with a milestone config (private/instrument/commercial)
  // plus any certificate a phase already exists for (covers cfi/atp/etc. once those get milestones too).
  const certs = [...new Set([...data.milestonesConfig.map((r) => r.certificate), ...data.phases.map((p) => p.certificate)])];
  const phaseByCert = Object.fromEntries(data.phases.map((p) => [p.certificate, p]));

  return (
    <div className="space-y-4 md:mx-auto md:max-w-xl">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/costs')} className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800" aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-semibold">Cost settings</h1>
      </div>

      {message && <p className="rounded-xl bg-bad/10 p-3 text-sm text-bad">{message}</p>}

      <Section title="Default settings">
        <TextField label="Default ground briefing time (hrs)" type="number" value={settingsForm.default_ground_time}
          onChange={(v) => setSettingsForm((f) => ({ ...f, default_ground_time: v }))} placeholder="Not set" />
        <TextField label="Private pilot: realistic total hours target (raised automatically if you pass it)" type="number" value={settingsForm.private_realistic_total_hours}
          onChange={(v) => setSettingsForm((f) => ({ ...f, private_realistic_total_hours: v }))} placeholder="Defaults to 50" />
        <Button size="sm" fullWidth={false} onClick={saveSettings} disabled={savingSettings}>{savingSettings ? 'Saving…' : 'Save'}</Button>
      </Section>

      <div>
        <h2 className="mb-2 px-1 text-sm font-medium text-slate-400">Training phases & rates</h2>
        <div className="space-y-3">
          {certs.map((c, i) => (
            <PhaseCard key={c} certificate={c} phase={phaseByCert[c]} defaultOpen={i === 0}
              aircraft={data.aircraft}
              aircraftRates={data.aircraftRates.filter((r) => r.certificate === c)}
              instructorRates={data.instructorRates.filter((r) => r.certificate === c)}
              groundRates={data.groundRates.filter((r) => r.certificate === c)}
              simulatorRates={data.simulatorRates.filter((r) => r.certificate === c)}
              plannedCosts={data.plannedCosts.filter((r) => r.certificate === c)}
              onCreatePlanned={async (r) => { await api.createPlannedCost(r); load(); }}
              onDeletePlanned={async (id) => { await api.deletePlannedCost(id); load(); }}
              onSavePhase={async (cert, phase) => { await api.setTrainingPhase(cert, phase); load(); }}
              onCreateRate={async (kind, r) => { await RATE_API[kind].create(r); load(); }}
              onDeleteRate={async (kind, id) => { await RATE_API[kind].delete(id); load(); }} />
          ))}
        </div>
      </div>
    </div>
  );
}
