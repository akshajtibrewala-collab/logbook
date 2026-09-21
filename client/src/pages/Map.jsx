import { Fragment, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Plane, Info, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { flightCodes, airportCode } from '../lib/flightpath.js';
import { useTheme } from '../lib/theme.js';
import { greatCircle } from '../lib/geo.js';
import { buildMapData } from '../lib/mapdata.js';
import { fmtHours } from '../lib/hours.js';

const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

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
  const pulse = max > 1 && visits === max ? '<span class="apt-pw"><span class="apt-pulse"></span></span>' : '';
  return L.divIcon({
    className: 'apt-icon',
    iconSize: [0, 0],
    popupAnchor: [0, -10],
    html: `<div class="apt" style="--c:${color(visits, max)};--dot:${dot}px;--full:${full}px;--fs:${fs}px">
      <span class="apt-hit"></span><span class="apt-disc">${pulse}<span class="apt-badge">${visits}</span></span></div>`,
  });
}

// Collapsed "i" button that expands the required map credits.
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
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-edge-strong bg-navy-900/90 text-slate-300 backdrop-blur active:text-accent">
        {open ? <X size={16} /> : <Info size={16} />}
      </button>
    </div>
  );
}

// Publishes the live zoom as a CSS variable on the map container so marker sizes can
// follow it continuously (and animate via CSS transitions) without re-creating icons.
function ZoomTracker() {
  const map = useMapEvents({ zoom: sync, zoomend: sync });
  function sync() { map.getContainer().style.setProperty('--z', map.getZoom()); }
  useEffect(sync, [map]); // eslint-disable-line react-hooks/exhaustive-deps
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

export default function MapPage() {
  const [flights, setFlights] = useState(null);
  const [airports, setAirports] = useState({});
  const [error, setError] = useState('');
  const theme = useTheme();
  const tileSet = theme === 'light' ? 'World_Light_Gray' : 'World_Dark_Gray'; // both are keyless Esri canvases

  useEffect(() => {
    (async () => {
      const list = await api.listFlights();
      const codes = [...new Set(list.flatMap(flightCodes))];
      setAirports(codes.length ? await api.resolveAirports(codes) : {});
      setFlights(list);
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

  return (
    <div className="relative isolate -mx-4 -mb-28 -mt-6 h-[calc(100dvh-4.5rem)]">
      <MapContainer center={[39, -98]} zoom={4} zoomControl={false} attributionControl={false} zoomSnap={0.5} zoomDelta={0.5} minZoom={2} worldCopyJump className="h-full w-full bg-navy-950">
        <TileLayer key={`${tileSet}-base`}
          url={`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${tileSet}_Base/MapServer/tile/{z}/{y}/{x}`}
          maxZoom={16}
        />
        <TileLayer key={`${tileSet}-ref`}
          url={`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${tileSet}_Reference/MapServer/tile/{z}/{y}/{x}`}
          maxZoom={16}
        />
        <ZoomTracker />
        <FitBounds points={points} />

        {data?.routes.map((r) => {
          const positions = greatCircle([r.a.lat, r.a.lon], [r.b.lat, r.b.lon]);
          const label = `${airportCode(r.a)} ↔ ${airportCode(r.b)}`;
          return (
            <Fragment key={`${r.a.ident}-${r.b.ident}`}>
              <Polyline positions={positions} interactive={false}
                pathOptions={{ color: '#38bdf8', weight: 1.5 + 2.5 * (r.count / maxRoute), opacity: 0.55 }} />
              {/* Wide invisible line so thin routes are easy to tap */}
              <Polyline positions={positions} pathOptions={{ color: '#38bdf8', weight: 18, opacity: 0.01 }}>
                <Popup>
                  <div className="min-w-[11rem]">
                    <div className="text-base font-semibold">{label}</div>
                    <div className="mt-1 text-sm font-medium">{r.count} flight{r.count === 1 ? '' : 's'} · {fmtHours(r.hours)} h</div>
                    <div className="text-xs text-slate-500">
                      {r.first === r.last ? fmtDate(r.last) : `${fmtDate(r.first)} – ${fmtDate(r.last)}`}
                    </div>
                  </div>
                </Popup>
              </Polyline>
            </Fragment>
          );
        })}

        {data?.stops.map((s) => (
          <Marker key={s.ident} position={[s.lat, s.lon]} icon={icons.get(s.ident)}>
            <Popup>
              <div className="min-w-[11rem]">
                <div className="text-base font-semibold">{airportCode(s)}{s.iata ? ` · ${s.iata}` : ''}</div>
                <div className="text-sm text-slate-400">{s.name}</div>
                <div className="mt-1 text-sm font-medium">{s.visits} visit{s.visits === 1 ? '' : 's'}</div>
                <div className="text-xs text-slate-500">
                  {s.first === s.last ? fmtDate(s.last) : `${fmtDate(s.first)} – ${fmtDate(s.last)}`}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <AttributionToggle />

      {error && <p className="absolute left-4 right-4 top-4 z-[1000] rounded-xl bg-bad/90 p-3 text-sm text-white">{error}</p>}

      {data && data.unresolved.length > 0 && (
        <p className="absolute left-4 right-4 top-4 z-[1000] rounded-xl border border-edge-strong bg-navy-900/90 p-3 text-xs text-slate-300 backdrop-blur">
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
