import { Fragment, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Plane, Info, X, Layers } from 'lucide-react';
import { api } from '../lib/api.js';
import { flightCodes, airportCode } from '../lib/flightpath.js';
import { useTheme } from '../lib/theme.js';
import { greatCircle } from '../lib/geo.js';
import { buildMapData } from '../lib/mapdata.js';
import { airportSummary, buildRouteColors, shouldAnimateRoutes, visitedCounts, ANIMATE_ROUTE_LIMIT } from '../lib/mapstyle.js';
import { fmtHours } from '../lib/hours.js';
import { formatDate as fmtDate } from '../lib/calendar.js';


// Frequency -> size and color (cool sky for one-offs, warming to amber for home bases).
const diameter = (visits, max) => Math.round(18 + 18 * Math.sqrt(visits / max));
const color = (visits, max) => {
  const t = max <= 1 ? 0 : (visits - 1) / (max - 1);
  return `hsl(${Math.round(199 - 160 * t)} 92% ${Math.round(60 - 5 * t)}%)`; // 199 (sky) -> 39 (amber)
};

// One icon per airport; the map's live zoom drives its look via CSS (see the .apt-* rules in
// index.css). Full marker (thin accent ring, small drop shadow, white-on-navy visit count) at zoom >= FULL_ZOOM; zooming out it
// first shrinks as the full marker, sheds its badge, becomes a plain dot, and the dot keeps shrinking.
// The busiest airport gets a slow pulsing ring.
const FULL_ZOOM = 11;

function airportIcon(visits, max) {
  const full = diameter(visits, max);
  const dot = Math.round(9 + 7 * Math.sqrt(visits / max));
  const digits = String(visits).length;
  const fs = Math.max(8, Math.round(full * (digits >= 3 ? 0.3 : digits === 2 ? 0.36 : 0.44)));
  const dotRatio = (dot / full).toFixed(4); // unitless, so the CSS scale formula never divides px by px
  const pulse = max > 1 && visits === max ? '<span class="apt-pw"><span class="apt-pulse"></span></span>' : '';
  return L.divIcon({
    className: 'apt-icon',
    iconSize: [0, 0],
    popupAnchor: [0, -10],
    html: `<div class="apt" style="--c:${color(visits, max)};--full:${full}px;--dot-ratio:${dotRatio};--fs:${fs}px">
      <span class="apt-hit"></span><span class="apt-disc">${pulse}<span class="apt-badge">${visits}</span></span></div>`,
  });
}

// Collapsed "i" button that expands the required map credits, anchored to the map's own bottom-right
// corner. This only reads right because the map container itself now ends exactly at the bottom nav
// (see MapPage's height below) — the map no longer extends underneath the nav, so this needs no
// extra offset to clear it.
function AttributionToggle() {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute bottom-3 right-3 z-[1000] flex items-end gap-2">
      {open && (
        <p id="map-credits" className="max-w-[15rem] rounded-xl border border-edge-strong bg-navy-900/95 p-3 text-[11px] leading-snug text-slate-300 backdrop-blur">
          <a href="https://leafletjs.com" target="_blank" rel="noreferrer" className="underline">Leaflet</a>
          {' | '}Tiles &copy; Esri &mdash; Esri, HERE, Garmin, OpenStreetMap contributors
        </p>
      )}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="map-credits"
        aria-label={open ? 'Hide map credits' : 'Show map credits'}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-edge-strong bg-navy-900/90 text-slate-300 backdrop-blur active:text-accent">
        {open ? <X size={16} /> : <Info size={16} />}
      </button>
    </div>
  );
}

// Publishes the live zoom as a CSS variable on the map container so marker sizes can follow it
// continuously via CSS `transform: scale()` (see the .apt-* rules in index.css).
//
// This listens to Leaflet's 'zoomanim' event rather than 'zoom'. Per Leaflet's own source, a normal
// tap/scroll-wheel zoom runs as a single ~250ms CSS transform transition on the map pane, and 'zoom'
// only fires once that transition has *finished* — so markers sat at their old size for the whole
// animation and then jumped, which read as a stutter. 'zoomanim' fires immediately with the *target*
// zoom when the animation starts (and once per frame during a pinch gesture, which is the zoom
// interaction on a phone), so setting --z from it lets the marker's own CSS transition run in step
// with the map's zoom instead of trailing behind it. 'viewreset' covers jumps too large to animate
// (e.g. the initial fit-to-bounds), which skip 'zoomanim' entirely.
function ZoomTracker() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const set = (z) => container.style.setProperty('--z', z);
    const onZoomAnim = (e) => set(e.zoom);
    const onSettled = () => set(map.getZoom());
    map.on('zoomanim', onZoomAnim);
    map.on('zoomend', onSettled);
    map.on('viewreset', onSettled);
    set(map.getZoom());
    return () => {
      map.off('zoomanim', onZoomAnim);
      map.off('zoomend', onSettled);
      map.off('viewreset', onSettled);
    };
  }, [map]);
  return null;
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) map.setView(points[0], FULL_ZOOM);
    else map.fitBounds(points, { padding: [40, 40], maxZoom: FULL_ZOOM });
  }, [map, points]);
  return null;
}

const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

const COLOR_MODES = [['none', 'Single'], ['year', 'By year'], ['aircraft', 'By aircraft']];
const HIT_LINE_LIMIT = 300; // above this many routes, skip the extra invisible tap-target line per route

// Mini-summary shown when an airport pin is tapped: visits, total hours, last visit, and (when the most
// recent flights there have them) a note snippet and a photo, fetched only when the popup is open.
function PinSummary({ stop, photoCounts }) {
  const s = airportSummary(stop);
  const withNote = stop.flights.find((f) => f.note);
  const withPhoto = stop.flights.find((f) => photoCounts[f.id] > 0);
  const [photo, setPhoto] = useState(null);
  useEffect(() => {
    if (!withPhoto) return undefined;
    let cancelled = false;
    api.listPhotos(withPhoto.id).then((p) => { if (!cancelled && p[0]) setPhoto(p[0].data_url); }).catch(() => {});
    return () => { cancelled = true; };
  }, [withPhoto?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="min-w-[12rem] max-w-[15rem]">
      <div className="text-base font-semibold">{airportCode(stop)}{stop.iata ? ` · ${stop.iata}` : ''}</div>
      <div className="text-sm text-slate-400">{stop.name}</div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div><dt className="text-[10px] uppercase tracking-wide text-slate-500">Visits</dt><dd className="text-base font-semibold">{s.visits}</dd></div>
        <div><dt className="text-[10px] uppercase tracking-wide text-slate-500">Hours</dt><dd className="text-base font-semibold">{fmtHours(s.hours)}</dd></div>
        <div><dt className="text-[10px] uppercase tracking-wide text-slate-500">Last</dt><dd className="text-sm font-semibold">{fmtDate(s.last)}</dd></div>
      </dl>
      {withNote && <p className="mt-2 line-clamp-3 text-xs text-slate-300">“{withNote.note}”</p>}
      {photo && <img src={photo} alt="From a flight here" className="mt-2 h-24 w-full rounded-lg object-cover" />}
    </div>
  );
}

function Legend({ legend, mode }) {
  if (!legend.length) return null;
  return (
    <ul aria-label={mode === 'year' ? 'Route colours by year' : 'Route colours by aircraft'}
      className="mt-2 max-h-32 space-y-1 overflow-y-auto border-t border-edge pt-2 text-xs text-slate-300">
      {legend.map((l) => (
        <li key={l.key} className="flex items-center gap-2">
          <span className="h-1 w-5 shrink-0 rounded-full" style={{ background: l.color }} />
          <span className="min-w-0 flex-1 truncate">{l.key}</span>
          <span className="text-slate-500">{l.count}</span>
        </li>
      ))}
    </ul>
  );
}

export default function MapPage() {
  const [flights, setFlights] = useState(null);
  const [airports, setAirports] = useState({});
  const [photoCounts, setPhotoCounts] = useState({});
  const [error, setError] = useState('');
  const [mode, setMode] = useState('none');
  const [animate, setAnimate] = useState(() => !prefersReducedMotion());
  const [panelOpen, setPanelOpen] = useState(true);
  const theme = useTheme();
  const tileSet = theme === 'light' ? 'World_Light_Gray' : 'World_Dark_Gray'; // both are keyless Esri canvases

  useEffect(() => {
    (async () => {
      const list = await api.listFlights();
      const codes = [...new Set(list.flatMap(flightCodes))];
      setAirports(codes.length ? await api.resolveAirports(codes) : {});
      setFlights(list);
      api.photoCounts().then(setPhotoCounts).catch(() => {});
    })().catch((e) => setError(e.message));
  }, []);

  const data = useMemo(() => (flights ? buildMapData(flights, airports) : null), [flights, airports]);
  const maxVisits = data?.stops[0]?.visits ?? 1;
  const maxRoute = Math.max(1, ...(data?.routes.map((r) => r.count) ?? []));
  const icons = useMemo(
    () => new Map(data?.stops.map((s) => [s.ident, airportIcon(s.visits, maxVisits)])),
    [data, maxVisits],
  );
  const points = useMemo(() => data?.stops.map((s) => [s.lat, s.lon]) ?? [], [data]);
  const counts = useMemo(() => visitedCounts(data?.stops ?? []), [data]);
  const { colorOf, legend } = useMemo(() => buildRouteColors(data?.routes ?? [], mode), [data, mode]);
  // Great-circle geometry is computed once per route set, not on every colour/animation toggle.
  const lines = useMemo(() => (data?.routes ?? []).map((r) => ({
    route: r,
    key: `${r.a.ident}-${r.b.ident}`,
    positions: greatCircle([r.a.lat, r.a.lon], [r.b.lat, r.b.lon]),
    label: `${airportCode(r.a)} ↔ ${airportCode(r.b)}`,
  })), [data]);
  const animated = shouldAnimateRoutes(lines.length, !animate);
  const manyRoutes = lines.length > HIT_LINE_LIMIT;

  return (
    <div className="relative isolate -mx-4 -mt-6 h-[calc(100dvh-var(--bottom-nav-h))] mb-[calc(-1*(var(--bottom-nav-h)+2rem))]">
      <MapContainer center={[39, -98]} zoom={4} zoomControl={false} attributionControl={false} zoomSnap={0.5} zoomDelta={0.5} minZoom={2} worldCopyJump className="h-full w-full bg-navy-950">
        <TileLayer key={`${tileSet}-base`} keepBuffer={4} updateWhenIdle
          url={`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${tileSet}_Base/MapServer/tile/{z}/{y}/{x}`}
          maxZoom={16}
        />
        <TileLayer key={`${tileSet}-ref`} keepBuffer={4} updateWhenIdle
          url={`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${tileSet}_Reference/MapServer/tile/{z}/{y}/{x}`}
          maxZoom={16}
        />
        <ZoomTracker />
        <FitBounds points={points} />

        {lines.map(({ route: r, key, positions, label }) => {
          const stroke = colorOf(r);
          const popup = (
            <Popup>
              <div className="min-w-[11rem]">
                <div className="text-base font-semibold">{label}</div>
                <div className="mt-1 text-sm font-medium">{r.count} flight{r.count === 1 ? '' : 's'} · {fmtHours(r.hours)} h</div>
                <div className="text-xs text-slate-500">
                  {r.first === r.last ? fmtDate(r.last) : `${fmtDate(r.first)} – ${fmtDate(r.last)}`}
                </div>
              </div>
            </Popup>
          );
          return (
            <Fragment key={key}>
              <Polyline positions={positions} interactive={manyRoutes}
                pathOptions={{ color: stroke, weight: 1.5 + 2.5 * (r.count / maxRoute), opacity: 0.7, className: animated ? 'route-flow' : '' }}>
                {manyRoutes && popup}
              </Polyline>
              {/* Wide invisible line so thin routes are easy to tap */}
              {!manyRoutes && <Polyline positions={positions} pathOptions={{ color: stroke, weight: 18, opacity: 0.01 }}>{popup}</Polyline>}
            </Fragment>
          );
        })}

        {data?.stops.map((s) => (
          <Marker key={s.ident} position={[s.lat, s.lon]} icon={icons.get(s.ident)}>
            <Popup><PinSummary stop={s} photoCounts={photoCounts} /></Popup>
          </Marker>
        ))}
      </MapContainer>

      {data && data.stops.length > 0 && (
        <section aria-label="Map summary and options" className="absolute left-3 top-3 z-[1000] w-56 rounded-2xl border border-edge-strong bg-navy-900/90 p-3 text-sm backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-4">
              <div><div className="text-lg font-semibold leading-none">{counts.airports}</div><div className="mt-1 text-[11px] text-slate-400">airports</div></div>
              {counts.regionsKnown && <div><div className="text-lg font-semibold leading-none">{counts.states}</div><div className="mt-1 text-[11px] text-slate-400">{counts.states === 1 ? 'state' : 'states'}</div></div>}
            </div>
            <button type="button" onClick={() => setPanelOpen((o) => !o)} aria-expanded={panelOpen} aria-label={panelOpen ? 'Hide map options' : 'Show map options'}
              className="flex h-11 w-11 items-center justify-center rounded-full text-slate-300 active:text-accent">
              <Layers size={18} />
            </button>
          </div>
          {panelOpen && (
            <div className="mt-2 border-t border-edge pt-2">
              <div className="flex gap-1 rounded-xl bg-navy-800 p-1" role="group" aria-label="Colour routes">
                {COLOR_MODES.map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setMode(k)} aria-pressed={mode === k}
                    className={`h-9 flex-1 rounded-lg text-xs font-medium transition-colors ${mode === k ? 'bg-accent text-ink' : 'text-slate-300'}`}>{l}</button>
                ))}
              </div>
              <label className="mt-2 flex min-h-11 items-center justify-between gap-2 text-xs text-slate-300">
                Animate routes{lines.length > ANIMATE_ROUTE_LIMIT ? ' (off: many routes)' : ''}
                <input type="checkbox" checked={animate} onChange={(e) => setAnimate(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--accent))]" />
              </label>
              <Legend legend={legend} mode={mode} />
              {!counts.regionsKnown && <p className="mt-2 text-[11px] text-slate-500">States visited appears once the airport database is re-seeded (npm run seed).</p>}
            </div>
          )}
        </section>
      )}

      <AttributionToggle />

      {error && <p role="alert" className="absolute left-4 right-4 top-4 z-[1000] rounded-xl bg-bad/90 p-3 text-sm text-white">{error}</p>}

      {!data && !error && (
        <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center p-8 text-center text-slate-300">
          <div className="rounded-2xl border border-edge-strong bg-navy-900/85 p-6 backdrop-blur">
            <Plane size={36} strokeWidth={1.5} className="mx-auto animate-pulse text-slate-500" />
            <p className="mt-3 font-medium">Loading your flights…</p>
          </div>
        </div>
      )}

      {data && data.unresolved.length > 0 && (
        <p className="absolute bottom-3 left-3 right-16 z-[1000] rounded-xl border border-edge-strong bg-navy-900/90 p-3 text-xs text-slate-300 backdrop-blur">
          Couldn’t place {data.unresolved.join(', ')} — check the airport code
          {airports && Object.keys(airports).length === 0 ? ' (has the airport database been seeded? run “npm run seed -w server”)' : ''}.
        </p>
      )}

      {data && data.stops.length === 0 && !error && (
        <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center p-8 text-center text-slate-300">
          <div className="rounded-2xl border border-edge-strong bg-navy-900/85 p-6 backdrop-blur">
            <Plane size={36} strokeWidth={1.5} className="mx-auto text-slate-500" />
            <p className="mt-3 font-medium">Nothing to plot yet</p>
            <p className="text-sm text-slate-400">Log a flight with departure and arrival airports.</p>
          </div>
        </div>
      )}
    </div>
  );
}
