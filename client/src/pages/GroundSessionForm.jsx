import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api, fetchAllRates } from '../lib/api.js';
import { fmtHours, parseHours } from '../lib/hours.js';
import { computeGroundSessionCost, fmtMoney } from '../lib/cost.js';
import HoursInput from '../components/HoursInput.jsx';
import TextField from '../components/TextField.jsx';
import DatePicker from '../components/DatePicker.jsx';
import Button from '../components/Button.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Disclosure from '../components/Disclosure.jsx';

const today = () => new Date().toLocaleDateString('en-CA');

const blank = () => ({ date: today(), hours: fmtHours(1), instructor: '', topics: '', notes: '', cost_override: '' });

function fromSession(s) {
  return {
    date: s.date, hours: fmtHours(s.hours), instructor: s.instructor ?? '', topics: s.topics ?? '',
    notes: s.notes ?? '', cost_override: s.cost_override == null ? '' : String(s.cost_override),
  };
}

function Section({ title, children }) {
  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-medium text-accent">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function GroundSessionForm() {
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

  useEffect(() => {
    if (!id) return;
    api.getGroundSession(id).then((s) => setForm(fromSession(s))).catch((e) => setMessage(e.message)).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { fetchAllRates().then(setRates).catch(() => {}); }, []);
  useEffect(() => { api.listTrainingPhases().then(setPhases).catch(() => {}); }, []);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const previewCost = rates && phases ? computeGroundSessionCost({
    date: form.date, hours: parseHours(form.hours) || 0,
    cost_override: form.cost_override.trim() === '' ? null : form.cost_override,
  }, rates, phases) : null;

  async function submit(e) {
    e.preventDefault();
    const hours = parseHours(form.hours);
    if (hours === null || hours <= 0) return setErrors({ hours: 'Use 1.5 or 1:30, greater than 0' });
    const payload = {
      date: form.date, hours, instructor: form.instructor, topics: form.topics, notes: form.notes,
      cost_override: form.cost_override.trim() === '' ? null : form.cost_override,
    };
    setSaving(true);
    setErrors({});
    setMessage('');
    try {
      if (id) await api.updateGroundSession(id, payload);
      else await api.createGroundSession(payload);
      navigate('/logbook');
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setMessage(err.fieldErrors ? 'Please fix the highlighted fields.' : err.message);
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await api.deleteGroundSession(id);
      navigate('/logbook');
    } catch (err) {
      setMessage(err.message);
      setDeleting(false);
    }
  }

  if (loading) return <p className="text-slate-400">Loading…</p>;

  return (
    <form onSubmit={submit} className="space-y-4 md:mx-auto md:max-w-xl">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/logbook')} className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800" aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-semibold">{id ? 'Edit ground session' : 'Log ground session'}</h1>
      </div>

      <Section title="Session">
        <DatePicker label="Date" value={form.date} onChange={set('date')} error={errors.date} />
        <HoursInput label="Hours" value={form.hours} onChange={set('hours')} error={errors.hours} />
        <TextField label="Instructor (optional)" value={form.instructor} onChange={set('instructor')} placeholder="Jane Smith" />
        <TextField label="Topics covered (optional)" value={form.topics} onChange={set('topics')} placeholder="Weather, airspace" />
        <div>
          <span className="mb-1 block text-xs text-slate-400">Notes (optional)</span>
          <textarea value={form.notes} onChange={(e) => set('notes')(e.target.value)} rows={3}
            className="w-full rounded-xl border border-edge bg-navy-800 p-3 text-base outline-none focus:border-accent" />
        </div>
      </Section>

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
        {previewCost?.missingRate && <p className="mt-1 text-xs text-slate-500">The ground rate isn't set yet — set it on the Costs screen.</p>}
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

      {message && <p className="rounded-xl bg-bad/10 p-3 text-sm text-bad">{message}</p>}

      <Button disabled={saving}>{saving ? 'Saving…' : id ? 'Save changes' : 'Log ground session'}</Button>
      {id && (
        <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>Delete ground session</Button>
      )}

      <ConfirmDialog open={confirmDelete} title="Delete ground session?" description="This cannot be undone."
        confirmLabel="Delete" busy={deleting} onConfirm={remove} onClose={() => setConfirmDelete(false)} />
    </form>
  );
}
