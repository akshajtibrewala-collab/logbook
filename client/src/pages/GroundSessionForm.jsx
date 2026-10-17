import { useEffect, useState } from 'react';
import SaveBar from '../components/SaveBar.jsx';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../lib/api.js';
import { fmtHours, parseHours } from '../lib/hours.js';
import { formatDate } from '../lib/calendar.js';
import HoursInput from '../components/HoursInput.jsx';
import TextField from '../components/TextField.jsx';
import DatePicker from '../components/DatePicker.jsx';
import Button from '../components/Button.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Disclosure from '../components/Disclosure.jsx';
import useInstructorNames from '../hooks/useInstructorNames.js';

const today = () => new Date().toLocaleDateString('en-CA');

const blank = () => ({ date: today(), hours: fmtHours(1), instructor: '', topics: '', notes: '', cost_override: '' }); // cost_override has no input any more but is carried through unchanged on edit

function fromSession(s) {
  return {
    date: s.date, hours: fmtHours(s.hours), instructor: s.instructor ?? '', topics: s.topics ?? '',
    notes: s.notes ?? '', cost_override: s.cost_override == null ? '' : String(s.cost_override),
  };
}

function Section({ title, children }) {
  return (
    <section className="card card-elevated p-4">
      <h2 className="stat-title mb-3 text-sm text-accent-strong">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function GroundSessionForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const instructors = useInstructorNames();
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getGroundSession(id).then((s) => setForm(fromSession(s))).catch((e) => setMessage(e.message)).finally(() => setLoading(false));
  }, [id]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

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
    <form onSubmit={submit} className="cl mn mn-form md:mx-auto md:max-w-xl">
      <Section title="Session">
        <DatePicker label="Date" value={form.date} onChange={set('date')} error={errors.date} />
        <HoursInput label="Hours" value={form.hours} onChange={set('hours')} error={errors.hours} />
        <div>
          <TextField label="Instructor (optional)" value={form.instructor} onChange={set('instructor')} placeholder="Jane Smith" list="instructor-names" />
          <datalist id="instructor-names">{instructors.map((n) => <option key={n} value={n} />)}</datalist>
        </div>
        <TextField label="Topics covered (optional)" value={form.topics} onChange={set('topics')} placeholder="Weather, airspace" />
        <div>
          <span className="mb-1 block text-xs text-slate-400">Notes (optional)</span>
          <textarea value={form.notes} onChange={(e) => set('notes')(e.target.value)} rows={3}
            className="gl-field w-full p-3 text-base" />
        </div>
      </Section>

      {message && <p className="rounded-xl bg-bad/10 p-3 text-sm text-bad">{message}</p>}

      <SaveBar>
        <Button disabled={saving}>{saving ? 'Saving…' : id ? 'Save changes' : 'Log ground session'}</Button>
        {id && (
          <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>Delete ground session</Button>
        )}
      </SaveBar>

      <ConfirmDialog open={confirmDelete} title="Delete ground session?" description="This cannot be undone."
        confirmLabel="Delete" busy={deleting} onConfirm={remove} onClose={() => setConfirmDelete(false)} />
    </form>
  );
}
