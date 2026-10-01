import { useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { LineChart, Line, ReferenceLine, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fmtHours } from '../../lib/hours.js';
import { cumulativeHours } from '../../lib/charts.js';
import { formatDate } from '../../lib/calendar.js';
import Button from '../../components/Button.jsx';
import { axisTick, tooltipStyle, gridStroke } from './chartStyle.js';
import CollapsibleStatCard from './CollapsibleStatCard.jsx';

const localToday = () => new Date().toLocaleDateString('en-CA');

export default function CumulativeChart({ flights, settings, onSaveTarget, note, defaultOpen = true }) {
  const today = localToday();
  const series = useMemo(() => cumulativeHours(flights, { target: settings?.hours_target, now: today }), [flights, settings, today]);
  const [editing, setEditing] = useState(false);
  const [hours, setHours] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function startEdit() { setHours(settings?.hours_target ? String(settings.hours_target) : ''); setLabel(settings?.hours_target_label || ''); setErr(''); setEditing(true); }
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try { await onSaveTarget({ hours_target: hours.trim() === '' ? null : hours, hours_target_label: label }); setEditing(false); } catch (ex) { setErr(ex.fieldErrors?.hours_target || ex.fieldErrors?.hours_target_label || ex.message); } finally { setSaving(false); }
  }

  const name = settings?.hours_target_label || 'goal';
  return (
    <CollapsibleStatCard title="Progress toward your goal" icon={Target}
      note={note ?? (series.target ? `${fmtHours(series.total)} of ${fmtHours(series.target)} h (${series.percent}%)` : 'Set a target to draw a goal line.')}
      defaultOpen={defaultOpen}>
      {series.points.length === 0 ? <p className="text-sm text-slate-500">Log a flight to start the line.</p> : (
        <div className="h-56" role="img" aria-label={`Line chart of cumulative hours, now ${fmtHours(series.total)}${series.target ? ` toward ${fmtHours(series.target)}` : ''}`}>
          <ResponsiveContainer>
            <LineChart data={series.points} margin={{ left: -12, right: 16, top: 8, bottom: 0 }}>
              <CartesianGrid {...gridStroke} />
              <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(d) => formatDate(d).slice(0, 5)} minTickGap={28} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} domain={[0, (max) => Math.ceil(Math.max(max, series.target ?? 0))]} allowDecimals={false} />
              <Tooltip {...tooltipStyle} labelFormatter={formatDate} formatter={(v) => [`${fmtHours(v)} h`, 'Total']} />
              {series.target && <ReferenceLine y={series.target} stroke="rgb(var(--warn))" strokeDasharray="5 5" label={{ value: name, fill: 'rgb(var(--warn))', fontSize: 11, position: 'insideTopLeft' }} />}
              <Line type="monotone" dataKey="hours" stroke="rgb(var(--accent))" strokeWidth={2.5} dot={series.points.length < 40} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {series.target && series.remaining > 0 && (
        <p className="mt-2 text-sm text-slate-400">
          {fmtHours(series.remaining)} h to go{series.projectedDate ? ` · at your recent pace, about ${formatDate(series.projectedDate)}` : ''}.
        </p>
      )}
      {series.target && series.remaining === 0 && <p className="mt-2 text-sm text-ok-strong">Goal reached.</p>}

      {editing ? (
        <form onSubmit={save} className="mt-3 space-y-2">
          <label className="block text-xs text-slate-400">Goal name (optional)
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Private certificate" maxLength={40}
              className="mt-1 h-12 w-full rounded-xl border border-edge bg-navy-800 px-3 text-base outline-none focus:border-accent" />
          </label>
          <label className="block text-xs text-slate-400">Target total hours (leave blank for none)
            <input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" placeholder="40"
              className="mt-1 h-12 w-full rounded-xl border border-edge bg-navy-800 px-3 text-base outline-none focus:border-accent" />
          </label>
          {err && <p role="alert" className="text-sm text-bad">{err}</p>}
          <div className="flex gap-2">
            <Button size="md" disabled={saving} fullWidth={false} className="flex-1">{saving ? 'Saving…' : 'Save target'}</Button>
            <Button type="button" variant="ghost" size="md" fullWidth={false} onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="secondary" size="md" className="mt-3" onClick={startEdit}>{series.target ? 'Change target' : 'Set a target'}</Button>
      )}
    </CollapsibleStatCard>
  );
}
