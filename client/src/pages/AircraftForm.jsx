import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../lib/api.js';
import TextField from '../components/TextField.jsx';
import Select from '../components/Select.jsx';
import Toggle from '../components/Toggle.jsx';
import Button from '../components/Button.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { AIRCRAFT_CATEGORIES, AIRCRAFT_CLASSES, SIMULATOR_DEVICE_TYPES } from '../lib/aviationEnums.js';

const blank = () => ({
  tail_number: '', make: '', model: '', type_designator: '', category: '', class: '',
  is_complex: false, is_high_performance: false, is_tailwheel: false, is_turbine: false, is_taa: false,
  type_rating_required: false, type_rating_designation: '', is_simulator: false, simulator_device_type: '', notes: '',
});

function Section({ title, children }) {
  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-medium text-accent">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function AircraftForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getAircraft(id)
      .then((a) => {
        const s = blank();
        // The API returns null (not '') for unset text fields — keep blank()'s '' default for those
        // rather than passing null into a controlled <input>, which React (rightly) warns about.
        for (const k of Object.keys(s)) {
          if (a[k] === null || a[k] === undefined) continue;
          s[k] = typeof s[k] === 'boolean' ? Boolean(a[k]) : a[k];
        }
        setForm(s);
      })
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setMessage('');
    try {
      if (id) await api.updateAircraft(id, form);
      else await api.createAircraft(form);
      navigate('/aircraft');
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setMessage(err.fieldErrors ? 'Please fix the highlighted fields.' : err.message);
      setSaving(false);
    }
  }

  async function archive() {
    setArchiving(true);
    try {
      await api.archiveAircraft(id);
      navigate('/aircraft');
    } catch (err) {
      setMessage(err.message);
      setArchiving(false);
    }
  }

  if (loading) return <p className="text-slate-400">Loading…</p>;

  return (
    <form onSubmit={submit} className="space-y-4 md:mx-auto md:max-w-xl">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/aircraft')} className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800" aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-semibold">{id ? 'Edit aircraft' : 'Add aircraft'}</h1>
      </div>

      <Section title="Identity">
        <Toggle label="This is a simulator or training device" checked={form.is_simulator} onChange={set('is_simulator')} />
        {form.is_simulator ? (
          <>
            <TextField label="Name" value={form.model} onChange={set('model')} placeholder="Redbird FMX" />
            <Select label="Device type" value={form.simulator_device_type} onChange={set('simulator_device_type')}
              options={SIMULATOR_DEVICE_TYPES} error={errors.simulator_device_type} />
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <TextField label="Tail number" upper value={form.tail_number} onChange={set('tail_number')} error={errors.tail_number} placeholder="N123AB" />
            </div>
            <TextField label="Make" value={form.make} onChange={set('make')} placeholder="Cessna" />
            <TextField label="Model" value={form.model} onChange={set('model')} placeholder="172S" />
            <div className="col-span-2">
              <TextField label="ICAO type designator" upper value={form.type_designator} onChange={set('type_designator')} placeholder="C172" />
            </div>
          </div>
        )}
      </Section>

      {!form.is_simulator && (
        <Section title="Category & class">
          <Select label="Category" value={form.category} onChange={set('category')} options={AIRCRAFT_CATEGORIES} />
          <Select label="Class" value={form.class} onChange={set('class')} options={AIRCRAFT_CLASSES} />
        </Section>
      )}

      <Section title="Attributes">
        <Toggle label="Complex" description="Retractable gear, flaps, and a controllable-pitch propeller" checked={form.is_complex} onChange={set('is_complex')} />
        <Toggle label="High performance" description="Over 200 horsepower" checked={form.is_high_performance} onChange={set('is_high_performance')} />
        <Toggle label="Tailwheel" checked={form.is_tailwheel} onChange={set('is_tailwheel')} />
        <Toggle label="Turbine" checked={form.is_turbine} onChange={set('is_turbine')} />
        <Toggle label="Technically advanced (TAA)" description="Installed GPS with a moving map, plus an autopilot" checked={form.is_taa} onChange={set('is_taa')} />
        <Toggle label="Type rating required" checked={form.type_rating_required} onChange={set('type_rating_required')} />
        {form.type_rating_required && (
          <TextField label="Type rating" upper value={form.type_rating_designation} onChange={set('type_rating_designation')}
            error={errors.type_rating_designation} placeholder="B737" />
        )}
      </Section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-medium text-accent">Notes</h2>
        <textarea value={form.notes} onChange={(e) => set('notes')(e.target.value)} rows={3}
          className="w-full rounded-xl border border-edge bg-navy-800 p-3 text-base outline-none focus:border-accent" />
      </section>

      {message && <p className="rounded-xl bg-bad/10 p-3 text-sm text-bad">{message}</p>}

      <Button disabled={saving}>{saving ? 'Saving…' : id ? 'Save changes' : 'Add aircraft'}</Button>
      {id && (
        <Button type="button" variant="danger" onClick={() => setConfirmArchive(true)}>Archive aircraft</Button>
      )}

      <ConfirmDialog open={confirmArchive} title="Archive this aircraft?"
        description="It will no longer appear when logging a new flight, but existing flights and their history are untouched. You can unarchive it later."
        confirmLabel="Archive" busy={archiving} onConfirm={archive} onClose={() => setConfirmArchive(false)} />
    </form>
  );
}
