import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings, Plus, Trash2, DollarSign, AlertTriangle } from 'lucide-react';
import { api, fetchAllRates } from '../lib/api.js';
import {
  computeFlightCost, computeGroundSessionCost, totalSpent, spentPerCertificate, averageCostPerFlightHour,
  projectRemainingCost, fmtMoney, pickRate,
} from '../lib/cost.js';
import { certificateLabel } from '../lib/milestones.js';
import { todayISO } from '../lib/calendar.js';
import Card from '../components/Card.jsx';
import Select from '../components/Select.jsx';
import DatePicker from '../components/DatePicker.jsx';
import TextField from '../components/TextField.jsx';
import HoursInput from '../components/HoursInput.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { fmtHours } from '../lib/hours.js';

const EXPENSE_CATEGORIES = [
  { value: 'books', label: 'Books & materials' },
  { value: 'headset', label: 'Headset' },
  { value: 'medical', label: 'Medical exam' },
  { value: 'written_test', label: 'Written test' },
  { value: 'checkride_fee', label: 'Checkride fee' },
  { value: 'other', label: 'Other' },
];
const categoryLabel = (v) => EXPENSE_CATEGORIES.find((c) => c.value === v)?.label ?? v;

/** Monthly spend for the last `months` calendar months (oldest first), for the bar chart. */
function monthlySpend(flights, groundSessions, expenses, rates, months = 12) {
  const now = new Date();
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const from = d.toISOString().slice(0, 10);
    const to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    buckets.push({ label: d.toLocaleDateString(undefined, { month: 'short' }), total: totalSpent(flights, groundSessions, expenses, rates, { from, to }) });
  }
  return buckets;
}

function SpendChart({ data }) {
  const max = Math.max(1, ...data.map((b) => b.total));
  return (
    <div className="flex h-32 items-end gap-1.5">
      {data.map((b, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="w-full rounded-t bg-accent/70" style={{ height: `${Math.max(2, (b.total / max) * 100)}%` }} title={`${b.label}: ${fmtMoney(b.total)}`} />
          <span className="text-[9px] text-slate-500">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

function ExpenseModal({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  if (!open) return null;
  const submit = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setSaving(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={initial.id ? 'Edit expense' : 'Add expense'}
      footer={<>
        <button type="button" onClick={onClose} className="h-11 rounded-xl px-4 text-sm text-slate-400 active:bg-navy-800">Cancel</button>
        <button type="button" disabled={saving} onClick={submit} className="h-11 rounded-xl bg-accent px-4 text-sm font-medium text-navy-950 active:opacity-80 disabled:opacity-60">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </>}>
      <div className="space-y-3">
        <Select label="Category" value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={EXPENSE_CATEGORIES} error={errors.category} />
        <DatePicker label="Date" value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} error={errors.date} />
        <TextField label="Amount ($)" type="number" value={form.amount} onChange={(v) => setForm((f) => ({ ...f, amount: v }))} error={errors.amount} />
        <TextField label="Note (optional)" value={form.note ?? ''} onChange={(v) => setForm((f) => ({ ...f, note: v }))} />
      </div>
    </Modal>
  );
}

function GroundSessionModal({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  if (!open) return null;
  const submit = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setSaving(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={initial.id ? 'Edit ground session' : 'Add ground-only session'}
      footer={<>
        <button type="button" onClick={onClose} className="h-11 rounded-xl px-4 text-sm text-slate-400 active:bg-navy-800">Cancel</button>
        <button type="button" disabled={saving} onClick={submit} className="h-11 rounded-xl bg-accent px-4 text-sm font-medium text-navy-950 active:opacity-80 disabled:opacity-60">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </>}>
      <div className="space-y-3">
        <DatePicker label="Date" value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} error={errors.date} />
        <HoursInput label="Hours" value={form.hours} onChange={(v) => setForm((f) => ({ ...f, hours: v }))} error={errors.hours} />
        <TextField label="Instructor (optional)" value={form.instructor ?? ''} onChange={(v) => setForm((f) => ({ ...f, instructor: v }))} />
        <TextField label="Topics covered (optional)" value={form.topics ?? ''} onChange={(v) => setForm((f) => ({ ...f, topics: v }))} />
        <TextField label="Notes (optional)" value={form.notes ?? ''} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} />
      </div>
    </Modal>
  );
}

const blankExpense = () => ({ category: 'other', date: todayISO(), amount: '', note: '' });
const blankSession = () => ({ date: todayISO(), hours: '1.0', instructor: '', topics: '', notes: '' });

export default function Costs() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [expenseModal, setExpenseModal] = useState(null);
  const [sessionModal, setSessionModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [projectCert, setProjectCert] = useState('private');

  const load = useCallback(() => {
    setError('');
    Promise.all([
      api.listFlights(), api.listGroundSessions(), api.listExpenses(), fetchAllRates(),
      api.listTrainingPhases(), api.listMilestonesConfig(), api.getSettings(),
    ])
      .then(([flights, groundSessions, expenses, rates, phases, milestonesConfig, settings]) =>
        setData({ flights, groundSessions, expenses, rates, phases, milestonesConfig, settings }))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const computed = useMemo(() => {
    if (!data) return null;
    const { flights, groundSessions, expenses, rates, phases, milestonesConfig, settings } = data;
    const today = todayISO();
    const total = totalSpent(flights, groundSessions, expenses, rates);
    const perCert = spentPerCertificate(phases, flights, groundSessions, expenses, rates, today);
    const avgPerHour = averageCostPerFlightHour(flights, rates);
    const chart = monthlySpend(flights, groundSessions, expenses, rates);

    const dualReq = milestonesConfig.find((r) => r.certificate === projectCert && r.requirement_key === 'dual_received');
    const soloReq = milestonesConfig.find((r) => r.certificate === projectCert && r.requirement_key === 'solo_time');
    const totalReq = milestonesConfig.find((r) => r.certificate === projectCert && r.requirement_key === 'total_time');
    let projection = null;
    if (dualReq && soloReq && totalReq) {
      const flownDual = flights.reduce((s, f) => s + (Number(f.dual_received) || 0), 0);
      const flownSolo = flights.reduce((s, f) => s + (Number(f.solo_time) || 0), 0);
      const flownTotal = flights.reduce((s, f) => s + (Number(f.total_time) || 0), 0);
      // The aircraft flown most recently stands in for "the aircraft you'll keep training in" — with
      // more than one active aircraft this is necessarily a simplification, clearly labeled an estimate.
      const mostRecentAircraftId = [...flights].sort((a, b) => b.date.localeCompare(a.date)).find((f) => f.aircraft_id)?.aircraft_id;
      const currentAircraftRate = mostRecentAircraftId
        ? pickRate(rates.aircraft_rates.filter((r) => r.aircraft_id === mostRecentAircraftId), today)
        : pickRate(rates.aircraft_rates, today);
      const currentInstructorRate = pickRate(rates.instructor_rates, today);
      const realisticTotalHours = projectCert === 'private' && settings.private_realistic_total_hours
        ? settings.private_realistic_total_hours
        : totalReq.min_value;
      projection = projectRemainingCost({
        faaMinDualHours: dualReq.min_value, faaMinSoloHours: soloReq.min_value,
        flownDualHours: flownDual, flownSoloHours: flownSolo, flownTotalHours: flownTotal,
        realisticTotalHours, currentAircraftRate, currentInstructorRate,
      });
    }

    const missingRateFlights = flights.filter((f) => computeFlightCost(f, rates).missingRate);
    return { total, perCert, avgPerHour, chart, projection, missingRateFlights };
  }, [data, projectCert]);

  const certOptions = useMemo(() => {
    if (!data) return [];
    const certs = new Set(data.milestonesConfig.map((r) => r.certificate));
    return [...certs].map((c) => ({ value: c, label: certificateLabel(c) }));
  }, [data]);

  const saveExpense = async (form) => {
    const payload = { ...form, amount: form.amount === '' ? 0 : form.amount };
    if (form.id) await api.updateExpense(form.id, payload);
    else await api.createExpense(payload);
    setExpenseModal(null);
    load();
  };
  const saveSession = async (form) => {
    if (form.id) await api.updateGroundSession(form.id, form);
    else await api.createGroundSession(form);
    setSessionModal(null);
    load();
  };
  const doDelete = async () => {
    if (confirmDelete.kind === 'expense') await api.deleteExpense(confirmDelete.id);
    else await api.deleteGroundSession(confirmDelete.id);
    setConfirmDelete(null);
    load();
  };

  return (
    <div className="stagger space-y-4 md:mx-auto md:max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Costs</h1>
        <Link to="/costs/settings" aria-label="Rates & settings" className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800 text-slate-300 active:text-accent">
          <Settings size={20} />
        </Link>
      </div>

      {error && <ErrorNote message={error} onRetry={load} />}
      {!data && !error && <><Skeleton className="h-32" /><Skeleton className="h-40" /></>}

      {computed && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card>
              <div className="text-xs text-slate-400">Total spent</div>
              <div className="mt-1 text-xl font-semibold">{fmtMoney(computed.total)}</div>
            </Card>
            <Card>
              <div className="text-xs text-slate-400">Avg / flight hour</div>
              <div className="mt-1 text-xl font-semibold">{fmtMoney(computed.avgPerHour)}</div>
            </Card>
            {Object.entries(computed.perCert).map(([cert, spent]) => (
              <Card key={cert}>
                <div className="text-xs text-slate-400">{certificateLabel(cert)}</div>
                <div className="mt-1 text-xl font-semibold">{fmtMoney(spent)}</div>
              </Card>
            ))}
          </div>

          {computed.missingRateFlights.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl bg-bad/10 p-3 text-sm text-bad">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{computed.missingRateFlights.length} flight{computed.missingRateFlights.length === 1 ? '' : 's'} use an aircraft, simulator, instructor or ground rate that isn't set yet — those costs are shown as $0. <Link to="/costs/settings" className="underline">Set rates</Link>.</span>
            </div>
          )}

          <Card>
            <h2 className="mb-3 text-sm font-medium text-accent">Spending, last 12 months</h2>
            <SpendChart data={computed.chart} />
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-accent">Projected remaining cost</h2>
              {certOptions.length > 1 && (
                <Select value={projectCert} onChange={setProjectCert} options={certOptions} className="w-40" />
              )}
            </div>
            {computed.projection ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-400">Estimate — FAA minimum</div>
                  <div className="mt-1 text-lg font-semibold">{fmtMoney(computed.projection.faaMinEstimate.cost)}</div>
                  <div className="text-xs text-slate-500">
                    {fmtHours(computed.projection.faaMinEstimate.dualHours)}h dual, {fmtHours(computed.projection.faaMinEstimate.soloHours)}h solo
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Estimate — realistic total</div>
                  <div className="mt-1 text-lg font-semibold">{fmtMoney(computed.projection.realisticEstimate.cost)}</div>
                  <div className="text-xs text-slate-500">
                    {fmtHours(computed.projection.realisticEstimate.dualHours)}h dual, {fmtHours(computed.projection.realisticEstimate.soloHours)}h solo
                  </div>
                </div>
                <p className="col-span-2 text-xs text-slate-500">Estimates only, at current rates — not a quote. Set a realistic total-hours target on the settings screen.</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">This certificate has no dual/solo/total-time requirement data to project from.</p>
            )}
          </Card>

          <Card padded={false}>
            <div className="flex items-center justify-between p-4 pb-0">
              <h2 className="text-sm font-medium text-accent">Other expenses</h2>
              <button type="button" onClick={() => setExpenseModal(blankExpense())} aria-label="Add expense" className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-800 text-accent active:opacity-70"><Plus size={16} /></button>
            </div>
            {data.expenses.length === 0 ? (
              <EmptyState icon={DollarSign} title="No expenses logged" className="py-8" />
            ) : (
              <ul className="divide-y divide-white/5 px-4">
                {data.expenses.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                    <button type="button" onClick={() => setExpenseModal({ ...e, amount: String(e.amount) })} className="min-w-0 flex-1 text-left">
                      <div className="text-sm">{categoryLabel(e.category)}{e.note ? ` — ${e.note}` : ''}</div>
                      <div className="text-xs text-slate-500">{e.date}</div>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{fmtMoney(e.amount)}</span>
                      <button type="button" onClick={() => setConfirmDelete({ kind: 'expense', id: e.id })} aria-label="Delete expense" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 active:text-bad"><Trash2 size={16} /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card padded={false}>
            <div className="flex items-center justify-between p-4 pb-0">
              <h2 className="text-sm font-medium text-accent">Ground-only sessions</h2>
              <button type="button" onClick={() => setSessionModal(blankSession())} aria-label="Add ground session" className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-800 text-accent active:opacity-70"><Plus size={16} /></button>
            </div>
            {data.groundSessions.length === 0 ? (
              <EmptyState icon={DollarSign} title="No ground-only sessions logged" className="py-8" />
            ) : (
              <ul className="divide-y divide-white/5 px-4">
                {data.groundSessions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                    <button type="button" onClick={() => setSessionModal({ ...s, hours: fmtHours(s.hours) })} className="min-w-0 flex-1 text-left">
                      <div className="text-sm">{fmtHours(s.hours)}h{s.instructor ? ` with ${s.instructor}` : ''}{s.topics ? ` — ${s.topics}` : ''}</div>
                      <div className="text-xs text-slate-500">{s.date}</div>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{fmtMoney(computeGroundSessionCost(s, data.rates.ground_rates).total)}</span>
                      <button type="button" onClick={() => setConfirmDelete({ kind: 'session', id: s.id })} aria-label="Delete session" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 active:text-bad"><Trash2 size={16} /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {expenseModal && <ExpenseModal open onClose={() => setExpenseModal(null)} onSave={saveExpense} initial={expenseModal} />}
      {sessionModal && <GroundSessionModal open onClose={() => setSessionModal(null)} onSave={saveSession} initial={sessionModal} />}
      <ConfirmDialog open={Boolean(confirmDelete)} title="Delete this?" description="This cannot be undone."
        confirmLabel="Delete" onConfirm={doDelete} onClose={() => setConfirmDelete(null)} />
    </div>
  );
}
