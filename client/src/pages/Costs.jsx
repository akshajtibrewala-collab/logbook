import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings, Plus, Trash2, DollarSign, AlertTriangle, GraduationCap } from 'lucide-react';
import { api, fetchAllRates } from '../lib/api.js';
import {
  computeFlightCost, totalSpent, spentPerCertificate, spentPerFlightHour,
  buildCertificateProjection, fmtMoney, pickRate,
} from '../lib/cost.js';
import { certificateLabel, computeMilestones, completionsByKey } from '../lib/milestones.js';
import { todayISO, formatDate } from '../lib/calendar.js';
import Card from '../components/Card.jsx';
import Select from '../components/Select.jsx';
import DatePicker from '../components/DatePicker.jsx';
import TextField from '../components/TextField.jsx';
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
function monthlySpend(flights, groundSessions, expenses, rates, phases, months = 12) {
  const now = new Date();
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const from = d.toISOString().slice(0, 10);
    const to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    buckets.push({ label: d.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' }), total: totalSpent(flights, groundSessions, expenses, rates, phases, { from, to }) });
  }
  return buckets;
}

function SpendChart({ data }) {
  const max = Math.max(1, ...data.map((b) => b.total));
  return (
    <div className="flex h-32 gap-1.5">
      {data.map((b, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
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

const blankExpense = () => ({ category: 'other', date: todayISO(), amount: '', note: '' });

export default function Costs() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [expenseModal, setExpenseModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [projectCert, setProjectCert] = useState('private');

  const load = useCallback(() => {
    setError('');
    Promise.all([
      api.listFlights(), api.listGroundSessions(), api.listExpenses(), fetchAllRates(),
      api.listTrainingPhases(), api.listMilestonesConfig(), api.getSettings(), api.listPlannedCosts(),
      api.listAircraft(true), api.listMilestoneCompletions(),
    ])
      .then(([flights, groundSessions, expenses, rates, phases, milestonesConfig, settings, plannedCosts, aircraft, completions]) =>
        setData({ flights, groundSessions, expenses, rates, phases, milestonesConfig, settings, plannedCosts, aircraft, completions }))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const computed = useMemo(() => {
    if (!data) return null;
    const { flights, groundSessions, expenses, rates, phases, milestonesConfig, settings } = data;
    const today = todayISO();
    const total = totalSpent(flights, groundSessions, expenses, rates, phases);
    const perCert = spentPerCertificate(phases, flights, groundSessions, expenses, rates, today);
    const perHour = spentPerFlightHour(total, flights);
    const groundHours = flights.reduce((sum, f) => sum + (Number(f.ground_time) || 0), 0) + groundSessions.reduce((sum, g) => sum + (Number(g.hours) || 0), 0);
    const chart = monthlySpend(flights, groundSessions, expenses, rates, phases);

    const { plannedCosts, aircraft, completions } = data;
    const aircraftById = Object.fromEntries(aircraft.map((x) => [x.id, x]));
    const requirements = computeMilestones(milestonesConfig, flights, aircraftById, completionsByKey(completions)).get(projectCert) ?? [];
    let projection = null;
    if (requirements.length) {
      // Rates come from the phase being projected; the most recently flown aircraft stands in for the one
      // you'll keep training in (a simplification, labeled as an estimate).
      const mostRecentAircraftId = [...flights].sort((x, y) => y.date.localeCompare(x.date)).find((f) => f.aircraft_id)?.aircraft_id;
      const certAircraftRates = rates.aircraft_rates.filter((r) => r.certificate === projectCert);
      projection = buildCertificateProjection({
        requirements, flights,
        aircraftRate: pickRate(mostRecentAircraftId ? certAircraftRates.filter((r) => r.aircraft_id === mostRecentAircraftId) : certAircraftRates, today),
        instructorRate: pickRate(rates.instructor_rates.filter((r) => r.certificate === projectCert), today),
        groundRate: pickRate(rates.ground_rates.filter((r) => r.certificate === projectCert), today),
        targetTotalHours: projectCert === 'private' && settings.private_realistic_total_hours ? settings.private_realistic_total_hours : undefined,
        oneTimeCostsTotal: plannedCosts.filter((c) => c.certificate === projectCert).reduce((sum, c) => sum + c.amount, 0),
        today,
      });
    }

    const missingRateFlights = flights.filter((f) => {
      const c = computeFlightCost(f, rates, phases);
      return c.tracked && c.missingRate;
    });
    return { total, perCert, perHour, groundHours, chart, projection, missingRateFlights };
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
  const doDelete = async () => {
    await api.deleteExpense(confirmDelete.id);
    setConfirmDelete(null);
    load();
  };

  return (
    <div className="stagger space-y-4 md:mx-auto md:max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Costs</h1>
        <div className="flex gap-2">
          <Link to="/logbook/ground/new" aria-label="Add ground session" className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800 text-slate-300 active:text-accent">
            <GraduationCap size={20} />
          </Link>
          <Link to="/costs/settings" aria-label="Rates & settings" className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800 text-slate-300 active:text-accent">
            <Settings size={20} />
          </Link>
        </div>
      </div>

      {error && <ErrorNote message={error} onRetry={load} />}
      {!data && !error && <><Skeleton className="h-32" /><Skeleton className="h-40" /></>}

      {computed && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <div className="text-xs text-slate-400">Total spent</div>
              <div className="mt-1 text-xl font-semibold">{fmtMoney(computed.total)}</div>
            </Card>
            <Card>
              <div className="text-xs text-slate-400">Cost per flight hour</div>
              <div className="mt-1 text-xl font-semibold">{fmtMoney(computed.perHour)}</div>
              <div className="text-[11px] text-slate-500">total spent ÷ all flight hours</div>
            </Card>
            <Card>
              <div className="text-xs text-slate-400">Total ground hours</div>
              <div className="mt-1 text-xl font-semibold">{fmtHours(computed.groundHours)}h</div>
            </Card>
          </div>

          <Card>
            <h2 className="mb-3 text-sm font-medium text-accent">Spend per training phase</h2>
            <div className="space-y-2">
              {data.phases.length === 0 ? (
                <p className="text-sm text-slate-400">No training phases set up yet. <Link to="/costs/settings" className="text-accent underline">Set one up</Link>.</p>
              ) : (
                [...data.phases].sort((a, b) => a.start_date.localeCompare(b.start_date)).map((p) => (
                  <div key={p.certificate} className="flex items-center justify-between rounded-xl bg-navy-800 px-3 py-2.5 text-sm">
                    <div>
                      <div className="font-medium">{certificateLabel(p.certificate)}</div>
                      <div className="text-xs text-slate-500">
                        {formatDate(p.start_date)} – {p.end_date ? formatDate(p.end_date) : 'ongoing'}{p.end_date ? ' · closed' : ''}{!p.track_costs ? ' · not tracked' : ''}
                      </div>
                    </div>
                    <span className="text-base font-semibold">{fmtMoney(computed.perCert[p.certificate] ?? 0)}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

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
            {computed.projection ? (() => {
              const p = computed.projection;
              const bd = p.breakdown;
              const line = (e) => `${fmtHours(e.dualHours)}h dual + ${fmtHours(e.soloHours)}h solo + ${fmtHours(e.groundHours)}h ground`;
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-slate-400">Estimate — FAA minimum</div>
                      <div className="mt-1 text-lg font-semibold">{fmtMoney(p.faaMinEstimate.cost)}</div>
                      <div className="text-xs text-slate-500">{line(p.faaMinEstimate)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Estimate — realistic ({fmtHours(bd.targetTotalHours)}h total)</div>
                      <div className="mt-1 text-lg font-semibold">{fmtMoney(p.realisticEstimate.cost)}</div>
                      <div className="text-xs text-slate-500">{line(p.realisticEstimate)}</div>
                    </div>
                  </div>
                  {p.finishDate && (
                    <p className="text-sm text-slate-300">Estimated finish: <span className="font-medium">{formatDate(p.finishDate)}</span>
                      <span className="text-xs text-slate-500"> (at your recent pace of {bd.frequency.lessonsPerWeek} flights/week)</span></p>
                  )}
                  <details className="text-xs text-slate-400">
                    <summary className="cursor-pointer text-accent">How this is calculated</summary>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      <li>Remaining hours come from your Milestones: the largest remaining dual requirement, the largest remaining solo requirement, plus 3.00h dual for checkride prep if not done.</li>
                      <li>Solo hours cost aircraft only ({fmtMoney(bd.rentalPerHr)}/h); dual hours add the instructor ({fmtMoney(bd.instructorPerHr)}/h). Rates are this phase's current rates.</li>
                      <li>Lessons = remaining flight hours ÷ your average lesson ({fmtHours(bd.avgLessonLength)}h); ground = lessons × your average ground time per flight ({fmtHours(bd.avgGroundPerLesson)}h) × {fmtMoney(bd.groundPerHr)}/h.</li>
                      <li>Realistic pads total time to {fmtHours(bd.targetTotalHours)}h (you've flown {fmtHours(bd.flownTotal)}h){bd.targetRaised ? ', raised automatically because you passed your target' : ''}; extra hours are costed as solo.</li>
                      <li>One-time costs added to both: {fmtMoney(p.faaMinEstimate.oneTimeCosts)} (editable in cost settings).</li>
                      <li>{bd.frequency ? `Finish date uses ${bd.frequency.sampleSize} flights in the last ${bd.frequency.windowDays} days.` : 'Not enough recent flights to estimate a finish date.'}</li>
                    </ul>
                  </details>
                  <p className="text-xs text-slate-500">Estimates only, at current rates — not a quote.</p>
                </div>
              );
            })() : (
              <p className="text-sm text-slate-400">This certificate has no milestone requirements to project from.</p>
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
                      <div className="text-xs text-slate-500">{formatDate(e.date)}</div>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{fmtMoney(e.amount)}</span>
                      <button type="button" onClick={() => setConfirmDelete({ id: e.id })} aria-label="Delete expense" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 active:text-bad"><Trash2 size={16} /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {expenseModal && <ExpenseModal open onClose={() => setExpenseModal(null)} onSave={saveExpense} initial={expenseModal} />}
      <ConfirmDialog open={Boolean(confirmDelete)} title="Delete this expense?" description="This cannot be undone."
        confirmLabel="Delete" onConfirm={doDelete} onClose={() => setConfirmDelete(null)} />
    </div>
  );
}
