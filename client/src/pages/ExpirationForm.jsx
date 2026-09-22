import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../lib/api.js';
import TextField from '../components/TextField.jsx';
import Select from '../components/Select.jsx';
import DatePicker from '../components/DatePicker.jsx';
import Button from '../components/Button.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const KINDS = [
  { value: 'medical', label: 'Medical certificate' },
  { value: 'custom', label: 'Other' },
];

const blank = () => ({ kind: 'custom', label: '', issued_date: '', expires_date: '', notes: '' });

export default function ExpirationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.listExpirations()
      .then((list) => {
        const e = list.find((x) => String(x.id) === id);
        if (!e) { setMessage('Not found'); return; }
        setForm({ kind: e.kind, label: e.label, issued_date: e.issued_date || '', expires_date: e.expires_date, notes: e.notes || '' });
      })
      .catch((err) => setMessage(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setMessage('');
    try {
      if (id) await api.updateExpiration(id, form);
      else await api.createExpiration(form);
      navigate('/currency');
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setMessage(err.fieldErrors ? 'Please fix the highlighted fields.' : err.message);
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await api.deleteExpiration(id);
      navigate('/currency');
    } catch (err) {
      setMessage(err.message);
      setDeleting(false);
    }
  }

  if (loading) return <p className="text-slate-400">Loading…</p>;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/currency')} className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800" aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-semibold">{id ? 'Edit expiration' : 'Add expiration'}</h1>
      </div>

      <section className="card space-y-3 p-4">
        <Select label="Type" value={form.kind} onChange={set('kind')} options={KINDS} />
        <TextField label="Label" value={form.label} onChange={set('label')} error={errors.label}
          placeholder={form.kind === 'medical' ? '3rd Class Medical' : 'Passport'} />
        <DatePicker label="Issued (optional)" value={form.issued_date} onChange={set('issued_date')} clearable />
        <DatePicker label="Expires" value={form.expires_date} onChange={set('expires_date')} error={errors.expires_date} />
        <div>
          <span className="mb-1 block text-xs text-slate-400">Notes</span>
          <textarea value={form.notes} onChange={(e) => set('notes')(e.target.value)} rows={3}
            className="w-full rounded-xl border border-edge bg-navy-800 p-3 text-base outline-none focus:border-accent" />
        </div>
      </section>

      {message && <p className="rounded-xl bg-bad/10 p-3 text-sm text-bad">{message}</p>}

      <Button disabled={saving}>{saving ? 'Saving…' : id ? 'Save changes' : 'Add expiration'}</Button>
      {id && (
        <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
      )}

      <ConfirmDialog open={confirmDelete} title="Delete this expiration?"
        description="This cannot be undone."
        confirmLabel="Delete" busy={deleting} onConfirm={remove} onClose={() => setConfirmDelete(false)} />
    </form>
  );
}
