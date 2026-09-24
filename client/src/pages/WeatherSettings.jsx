import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api, saveSettingsMerged } from '../lib/api.js';
import TextField from '../components/TextField.jsx';
import Button from '../components/Button.jsx';
import Skeleton from '../components/Skeleton.jsx';

const blank = () => ({
  home_airport_ident: '', min_ceiling_ft: '', min_visibility_sm: '', max_wind_kt: '', max_gust_kt: '', max_crosswind_kt: '',
  night_min_ceiling_ft: '', night_min_visibility_sm: '', night_max_wind_kt: '', night_max_gust_kt: '', night_max_crosswind_kt: '',
});

// Server fields are numbers or null; the form works in strings (including '') so a field can sit empty
// while being edited, rather than snapping to 0.
const toForm = (s) => Object.fromEntries(Object.keys(blank()).map((k) => [k, s[k] == null ? '' : String(s[k])]));

function Minimum({ label, field, form, set, errors, unit }) {
  return (
    <TextField label={`${label} (${unit})`} type="number" value={form[field]} onChange={set(field)} error={errors[field]} placeholder="Not set" />
  );
}

export default function WeatherSettings() {
  const navigate = useNavigate();
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.getSettings().then((s) => setForm(toForm(s))).catch((err) => setMessage(err.message)).finally(() => setLoading(false));
  }, []);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setMessage('');
    try {
      const saved = await saveSettingsMerged(form);
      setForm(toForm(saved));
      navigate('/weather');
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setMessage(err.fieldErrors ? 'Please fix the highlighted fields.' : err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <><Skeleton className="h-8 w-40" /><Skeleton className="mt-4 h-64" /></>;

  return (
    <form onSubmit={submit} className="space-y-4 md:mx-auto md:max-w-xl">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/weather')} className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800" aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-semibold">Weather settings</h1>
      </div>

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-medium text-slate-400">Home airport</h2>
        <TextField label="Airport code" value={form.home_airport_ident} onChange={set('home_airport_ident')} upper
          error={errors.home_airport_ident} placeholder="KPAO" />
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-medium text-slate-400">Day minimums</h2>
        <p className="text-xs text-slate-500">Leave a field blank to skip that check entirely.</p>
        <Minimum label="Min. ceiling" field="min_ceiling_ft" unit="ft" form={form} set={set} errors={errors} />
        <Minimum label="Min. visibility" field="min_visibility_sm" unit="SM" form={form} set={set} errors={errors} />
        <Minimum label="Max wind" field="max_wind_kt" unit="kt" form={form} set={set} errors={errors} />
        <Minimum label="Max gust" field="max_gust_kt" unit="kt" form={form} set={set} errors={errors} />
        <Minimum label="Max crosswind" field="max_crosswind_kt" unit="kt" form={form} set={set} errors={errors} />
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-medium text-slate-400">Night minimums</h2>
        <p className="text-xs text-slate-500">Often tighter than your day minimums — used whenever the checked time falls between sunset and sunrise at that airport.</p>
        <Minimum label="Min. ceiling" field="night_min_ceiling_ft" unit="ft" form={form} set={set} errors={errors} />
        <Minimum label="Min. visibility" field="night_min_visibility_sm" unit="SM" form={form} set={set} errors={errors} />
        <Minimum label="Max wind" field="night_max_wind_kt" unit="kt" form={form} set={set} errors={errors} />
        <Minimum label="Max gust" field="night_max_gust_kt" unit="kt" form={form} set={set} errors={errors} />
        <Minimum label="Max crosswind" field="night_max_crosswind_kt" unit="kt" form={form} set={set} errors={errors} />
      </section>

      {message && <p className="rounded-xl bg-bad/10 p-3 text-sm text-bad">{message}</p>}

      <Button disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button>
    </form>
  );
}
