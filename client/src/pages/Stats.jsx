import { useCallback, useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, LabelList, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, ReferenceLine, CartesianGrid } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { api } from '../lib/api.js';
import { flightCodes } from '../lib/flightpath.js';
import { fmtHours } from '../lib/hours.js';
import { hoursByCategory, hoursByAircraft, hoursByAirline, topRoutes, topAirports } from '../lib/stats.js';
import { hoursByMonth, hoursByTail, cumulativeHours } from '../lib/charts.js';
import { formatDate } from '../lib/calendar.js';
import Button from '../components/Button.jsx';
import AirlineBadge from '../components/AirlineBadge.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorNote from '../components/ErrorNote.jsx';

const PALETTE = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#2dd4bf', '#fb923c', '#94a3b8'];

const tooltipStyle = {
  contentStyle: { background: 'rgb(var(--navy-800))', border: '1px solid rgb(var(--edge) / var(--edge-a2))', borderRadius: 12, color: 'rgb(var(--slate-100))' },
  itemStyle: { color: 'rgb(var(--slate-100))' },
  labelStyle: { color: 'rgb(var(--slate-400))' },
};

function Card({ title, note, children }) {
  return (
    <section className="card p-4">
      <h2 className="text-sm font-medium text-slate-300">{title}</h2>
      {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

const localToday = () => new Date().toLocaleDateString('en-CA');
const axisTick = { fontSize: 11, fill: 'rgb(var(--slate-400))' };

function MonthlyChart({ flights }) {
  const rows = useMemo(() => hoursByMonth(flights, { months: 12, now: localToday() }), [flights]);
  const any = rows.some((r) => r.hours > 0);
  return (
    <Card title="Hours by month" note="The last 12 months.">
      {!any ? <p className="text-sm text-slate-500">No flying in the last 12 months.</p> : (
        <div className="h-56" role="img" aria-label={`Bar chart of hours flown per month. ${rows.map((r) => `${r.label}: ${fmtHours(r.hours)}`).join(', ')}`}>
          <ResponsiveContainer>
            <BarChart data={rows} margin={{ left: -18, right: 4, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgb(var(--edge) / var(--edge-a))" />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={14} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v) => `${fmtHours(v)} h`} />
              <Bar dataKey="hours" name="Hours" fill="rgb(var(--accent))" radius={[6, 6, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function CumulativeChart({ flights, settings, onSaveTarget }) {
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
    <Card title="Progress toward your goal" note={series.target ? `${fmtHours(series.total)} of ${fmtHours(series.target)} h (${series.percent}%)` : 'Set a target to draw a goal line.'}>
      {series.points.length === 0 ? <p className="text-sm text-slate-500">Log a flight to start the line.</p> : (
        <div className="h-56" role="img" aria-label={`Line chart of cumulative hours, now ${fmtHours(series.total)}${series.target ? ` toward ${fmtHours(series.target)}` : ''}`}>
          <ResponsiveContainer>
            <LineChart data={series.points} margin={{ left: -12, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgb(var(--edge) / var(--edge-a))" />
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
      {series.target && series.remaining === 0 && <p className="mt-2 text-sm text-ok">Goal reached.</p>}

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
    </Card>
  );
}

function Ranked({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length) return <p className="text-sm text-slate-500">Nothing to rank yet.</p>;
  return (
    <ol className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.label} className="flex items-center gap-3">
          <span className="w-5 text-sm text-slate-500">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium">{r.label}</span>
              <span className="shrink-0 text-sm text-slate-400">{r.count}×{r.hours !== undefined ? ` · ${fmtHours(r.hours)} h` : ''}</span>
            </div>
            {r.sub && <div className="truncate text-xs text-slate-500">{r.sub}</div>}
            <div className="mt-1 h-1.5 rounded-full bg-navy-800">
              <div className="h-full rounded-full bg-accent" style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function Stats() {
  const [flights, setFlights] = useState(null);
  const [airports, setAirports] = useState({});
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(null);
  const [aircraftBy, setAircraftBy] = useState('type'); // 'type' | 'tail'

  // The pilot settings PUT replaces the whole row, so a target change sends the current settings back with it.
  async function saveTarget(patch) {
    const saved = await api.updateSettings({ ...settings, ...patch });
    setSettings(saved);
  }

  const load = useCallback(() => {
    setError('');
    (async () => {
      api.getSettings().then(setSettings).catch(() => {});
      const list = await api.listFlights();
      const codes = [...new Set(list.flatMap(flightCodes))];
      setAirports(codes.length ? await api.resolveAirports(codes) : {});
      setFlights(list);
    })().catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const data = useMemo(() => {
    if (!flights) return null;
    return {
      categories: hoursByCategory(flights),
      aircraft: hoursByAircraft(flights),
      tails: hoursByTail(flights).map((t) => ({ type: t.tail, hours: t.hours })),
      airlines: hoursByAirline(flights),
      routes: topRoutes(flights, airports),
      airports: topAirports(flights, airports),
    };
  }, [flights, airports]);

  const catTotal = data?.categories.reduce((s, c) => s + c.hours, 0) ?? 0;

  return (
    <div className="stagger space-y-4">
      <h1 className="text-2xl font-semibold">Stats</h1>
      {error && <ErrorNote message={error} onRetry={load} />}
      {!data && !error && (
        <>
          <Skeleton className="h-72" /><Skeleton className="h-52" /><Skeleton className="h-52" />
        </>
      )}

      {flights && flights.length === 0 && (
        <div className="mt-16 text-center text-slate-400">
          <BarChart3 size={40} strokeWidth={1.5} className="mx-auto text-slate-600" />
          <p className="mt-3">No stats yet.</p>
          <p className="text-sm">Log a few flights and charts will appear here.</p>
        </div>
      )}

      {data && flights.length > 0 && (
        <>
          <MonthlyChart flights={flights} />
          <CumulativeChart flights={flights} settings={settings} onSaveTarget={saveTarget} />

          <Card title="Hours by category" note="Categories overlap — night PIC counts toward both.">
            {data.categories.length === 0 ? <p className="text-sm text-slate-500">No category time logged yet.</p> : (
              <>
                <div className="h-56">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={data.categories} dataKey="hours" nameKey="label" innerRadius="58%" outerRadius="90%"
                        paddingAngle={2} stroke="none">
                        {data.categories.map((c, i) => <Cell key={c.key} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <Tooltip {...tooltipStyle} formatter={(v) => `${fmtHours(v)} h`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-2 space-y-2">
                  {data.categories.map((c, i) => (
                    <li key={c.key} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />{c.label}
                      </span>
                      <span className="text-slate-400">{fmtHours(c.hours)} h · {Math.round((c.hours / catTotal) * 100)}%</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card title={aircraftBy === 'type' ? 'Hours by Aircraft Type' : 'Hours by Aircraft (tail number)'}>
            <div className="mb-3 flex gap-1 rounded-xl bg-navy-800 p-1" role="group" aria-label="Group aircraft by">
              {[['type', 'By type'], ['tail', 'By tail number']].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setAircraftBy(k)} aria-pressed={aircraftBy === k}
                  className={`h-10 flex-1 rounded-lg text-sm font-medium transition-colors ${aircraftBy === k ? 'bg-accent text-ink' : 'text-slate-400'}`}>{l}</button>
              ))}
            </div>
            <div style={{ height: Math.max(120, (aircraftBy === 'type' ? data.aircraft : data.tails).length * 44 + 24) }}>
              <ResponsiveContainer>
                <BarChart data={aircraftBy === 'type' ? data.aircraft : data.tails} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="type" width={72} axisLine={false} tickLine={false}
                    tick={{ fontSize: 12 }} />
                  <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v) => `${fmtHours(v)} h`} />
                  <Bar dataKey="hours" fill="rgb(var(--accent))" radius={[0, 6, 6, 0]} barSize={20} isAnimationActive={false}>
                    <LabelList dataKey="hours" position="right" fontSize={12} formatter={(v) => fmtHours(v)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {data.airlines.length > 0 && (
            <Card title="Airlines">
              <ul className="space-y-3">
                {data.airlines.map((a) => (
                  <li key={a.name} className="flex items-center gap-3">
                    <AirlineBadge airline={a.name} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.name}</span>
                    <span className="shrink-0 text-sm text-slate-400">{a.flights} flight{a.flights === 1 ? '' : 's'} · {fmtHours(a.hours)} h</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Most Flown Routes"><Ranked rows={data.routes} /></Card>
          <Card title="Most Visited Airports">
            <Ranked rows={data.airports.map((a) => ({ label: a.code, sub: a.name, count: a.count }))} />
          </Card>
        </>
      )}
    </div>
  );
}
