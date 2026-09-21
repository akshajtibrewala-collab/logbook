import { useCallback, useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, LabelList, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { api } from '../lib/api.js';
import { flightCodes } from '../lib/flightpath.js';
import { fmtHours } from '../lib/hours.js';
import { hoursByCategory, hoursByAircraft, hoursByAirline, topRoutes, topAirports } from '../lib/stats.js';
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

  const load = useCallback(() => {
    setError('');
    (async () => {
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

          <Card title="Hours by Aircraft Type">
            <div style={{ height: Math.max(120, data.aircraft.length * 44 + 24) }}>
              <ResponsiveContainer>
                <BarChart data={data.aircraft} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="type" width={64} axisLine={false} tickLine={false}
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
