import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Plane, Info, X, ChevronDown, RotateCcw } from 'lucide-react';
import { api } from '../lib/api.js';
import { flightCodes, airportCode } from '../lib/flightpath.js';
import { useTheme } from '../lib/theme.js';
import { greatCircle, fmtNm } from '../lib/geo.js';
import { buildMapData } from '../lib/mapdata.js';
import { airportSummary, routeColorFor, passengerRouteColorFor, PASSENGER_ROUTE_DASH, shouldAnimateRoutes, visitedCounts, loadAnimatePref, saveAnimatePref, orientedPositions, ANIMATE_ROUTE_LIMIT } from '../lib/mapstyle.js';
import { fmtHours } from '../lib/hours.js';
import { PhotoImage } from '../components/PhotoGrid.jsx';
import { formatDate as fmtDate } from '../lib/calendar.js';
import { pilotFlights, roleOf } from '../lib/flightRoles.js';
import Toggle from '../components/Toggle.jsx';

// Each role filter's active-state tint: sky blue for Pilot, violet for Passenger (same tokens as the
// route lines and FlightRoleTabs), neutral navy for All so it doesn't read as either role.
const ROLE_FILTERS = [
  ['all', 'All', 'bg-navy-700 text-slate-100'],
  ['pilot', 'Pilot', 'bg-accent text-ink'],
  ['passenger', 'Passenger', 'bg-[rgb(var(--role-pax))] text-ink'],
];


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
        className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-edge-strong bg-navy-900/90 text-slate-300 backdrop-blur active:text-accent">
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

// Leaflet closes a popup on an outside tap/click by default, but not on Escape — this adds that.
function EscapePopupCloser() {
  const map = useMap();
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') map.closePopup(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
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

const HIT_LINE_LIMIT = 300; // above this many routes, skip the extra invisible tap-target line per route

/**
 * One route's animated line. The animation classes are put on the line's own SVG <path> imperatively:
 * react-leaflet applies `pathOptions` *after* the Leaflet layer is created, and Leaflet reads `className`
 * only at creation, so a className passed through pathOptions never reaches the element (which is why
 * the earlier version never animated).
 *
 * mode: 'loop'  draw in from departure, then dashes flow along the flight direction, forever
 *       'once'  draw in, then settle (the replay button while "Animate routes" is off)
 *       null    a plain static line
 * `playKey` re-runs the draw-in; `delay` staggers routes so they don't all start in the same instant.
 */
function RouteLine({ positions, pathOptions, mode, playKey, delay, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current?.getElement?.();
    if (!el) return undefined;
    const reset = () => { el.classList.remove('route-draw', 'route-flow'); el.removeAttribute('pathLength'); el.style.animationDelay = ''; };
    reset();
    if (!mode) return reset;
    el.setAttribute('pathLength', '100');
    el.style.animationDelay = `${delay}ms`;
    void el.getBoundingClientRect(); // commit the reset so the draw-in restarts from the start
    el.classList.add('route-draw');
    const onEnd = (e) => {
      if (e.animationName !== 'route-draw') return;
      el.classList.remove('route-draw');
      el.removeAttribute('pathLength'); // the dashes flow in real pixels, not path-length units
      el.style.animationDelay = '';
      if (mode === 'loop') el.classList.add('route-flow');
      else { el.style.strokeDasharray = 'none'; el.style.strokeDashoffset = '0'; }
    };
    el.addEventListener('animationend', onEnd);
    return () => { el.removeEventListener('animationend', onEnd); reset(); el.style.strokeDasharray = ''; el.style.strokeDashoffset = ''; };
  }, [mode, playKey, delay, positions]);
  return <Polyline ref={ref} positions={positions} interactive={false} pathOptions={pathOptions}>{children}</Polyline>;
}

// Mini-summary shown when an airport pin is tapped: visits, total hours, last visit, and (when a recent
// flight there has one) a photo, fetched only when the popup is open. Deliberately no note/remarks
// snippet here — the flight's note still shows on Flight Detail and the printable/share summary as before.
function PinSummary({ stop, photoCounts }) {
  const s = airportSummary(stop);
  const withPhoto = stop.flights.find((f) => photoCounts[f.id] > 0);
  const [photo, setPhoto] = useState(null); // { data_url, width, height }
  useEffect(() => {
    if (!withPhoto) return undefined;
    let cancelled = false;
    api.listPhotos(withPhoto.id).then((p) => { if (!cancelled && p[0]) setPhoto(p[0]); }).catch(() => {});
    return () => { cancelled = true; };
  }, [withPhoto?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const code = airportCode(stop);
  // Only show the IATA/local code separately when it's not already implied by the ICAO code (e.g. K + SUS
  // -> KSUS shouldn't also show "· SUS").
  const extraCode = stop.iata && stop.iata !== code && !(code.length === 4 && code.slice(1) === stop.iata) ? stop.iata : null;
  const pilotCount = stop.flights.filter((f) => roleOf(f) === 'pilot').length;
  const passengerCount = stop.flights.filter((f) => roleOf(f) === 'passenger').length;

  return (
    <div className="w-[15.5rem] max-w-[calc(100vw-3.5rem)] p-0.5">
      <div className="text-base font-semibold leading-tight">{code}{extraCode ? ` · ${extraCode}` : ''}</div>
      <div className="text-sm text-slate-400">{stop.name}</div>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {pilotCount > 0 && (
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">Pilot · {pilotCount}</span>
        )}
        {passengerCount > 0 && (
          <span className="rounded-full bg-[rgb(var(--role-pax))]/15 px-2 py-0.5 text-[10px] font-medium text-[rgb(var(--role-pax-strong))]">Passenger · {passengerCount}</span>
        )}
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 text-center">
        <div><div className="text-[10px] uppercase tracking-wide text-slate-500">Visits</div><div className="text-base font-semibold">{s.visits}</div></div>
        <div><div className="text-[10px] uppercase tracking-wide text-slate-500">Hours</div><div className="text-base font-semibold">{fmtHours(s.hours)}</div></div>
      </div>
      <div className="mt-2 flex items-baseline justify-between border-t border-edge pt-2 text-sm">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">Last visit</span>
        <span className="whitespace-nowrap font-semibold">{fmtDate(s.last)}</span>
      </div>

      {photo && <PhotoImage className="mt-2.5" src={photo.data_url} width={photo.width} height={photo.height} alt="From a flight here" maxHeight={140} />}
    </div>
  );
}

const Stat = ({ label, value, unit }) => (
  <div className="flex flex-col items-center text-center">
    <div className="whitespace-nowrap text-base font-semibold leading-tight">
      {value}{unit && <span className="ml-0.5 text-[10px] font-medium text-slate-400">{unit}</span>}
    </div>
    <div className="mt-0.5 min-h-[1.5rem] text-[11px] leading-tight text-slate-400">{label}</div>
  </div>
);

export default function MapPage() {
  const [flights, setFlights] = useState(null);
  const [airports, setAirports] = useState({});
  const [photoCounts, setPhotoCounts] = useState({});
  const [error, setError] = useState('');
  const [animate, setAnimate] = useState(() => loadAnimatePref(prefersReducedMotion()));
  const [plays, setPlays] = useState(0); // bumped by the replay button; also re-runs the draw-in
  const [playOnce, setPlayOnce] = useState(false); // a replay while "Animate routes" is off
  const [open, setOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'pilot' | 'passenger'
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

  // Stops, visit counts, distance and the unresolved-airport note all follow the role filter directly —
  // one filtered flight list drives every one of them.
  const filteredFlights = useMemo(() => {
    if (!flights) return [];
    return roleFilter === 'all' ? flights : flights.filter((f) => roleOf(f) === roleFilter);
  }, [flights, roleFilter]);
  const data = useMemo(() => (flights ? buildMapData(filteredFlights, airports) : null), [flights, filteredFlights, airports]);

  // Route *lines* are built separately, by role, from the full (unfiltered) flight list — never from
  // `data.routes` above, which (when the filter is "All") would merge a pilot flight and a passenger
  // flight on the same leg into one entry, making the two impossible to style differently. Each bucket
  // keeps its own count/hours, and only the bucket(s) matching the current filter are ever rendered.
  const pilotMapData = useMemo(() => (flights ? buildMapData(pilotFlights(flights), airports) : null), [flights, airports]);
  const passengerMapData = useMemo(
    () => (flights ? buildMapData(flights.filter((f) => roleOf(f) === 'passenger'), airports) : null),
    [flights, airports],
  );
  const hasPassengerRoutes = (passengerMapData?.routes.length ?? 0) > 0;

  const maxVisits = data?.stops[0]?.visits ?? 1;
  const icons = useMemo(
    () => new Map(data?.stops.map((s) => [s.ident, airportIcon(s.visits, maxVisits)])),
    [data, maxVisits],
  );
  const points = useMemo(() => data?.stops.map((s) => [s.lat, s.lon]) ?? [], [data]);
  const counts = useMemo(() => visitedCounts(data?.stops ?? []), [data]);
  const totalHours = useMemo(() => filteredFlights.reduce((s, f) => s + (Number(f.total_time) || 0), 0), [filteredFlights]);
  const routeColor = routeColorFor(theme); // one route colour, tuned for the current map tiles
  const passengerRouteColor = passengerRouteColorFor(theme);

  // Great-circle geometry, oriented along the flight direction, computed once per route set (not on
  // every colour/animation change) — one array per role bucket, so each can carry its own style.
  const toLines = (routes) => routes.map((r) => ({
    route: r,
    key: `${r.a.ident}-${r.b.ident}`,
    positions: orientedPositions(r, greatCircle([r.a.lat, r.a.lon], [r.b.lat, r.b.lon])),
    label: `${airportCode(r.a)} ↔ ${airportCode(r.b)}`,
  }));
  const pilotLines = useMemo(() => toLines(pilotMapData?.routes ?? []), [pilotMapData]);
  const passengerLines = useMemo(() => toLines(passengerMapData?.routes ?? []), [passengerMapData]);
  const showPilotLines = roleFilter !== 'passenger';
  const showPassengerLines = roleFilter !== 'pilot';
  const visiblePilotLines = showPilotLines ? pilotLines : [];
  const visiblePassengerLines = showPassengerLines ? passengerLines : [];
  const maxRoute = Math.max(1, ...visiblePilotLines.map((l) => l.route.count), ...visiblePassengerLines.map((l) => l.route.count));
  // Only pilot routes ever animate (passenger routes are always a plain static dashed line, much cheaper
  // to render), so the affordability cap only needs to weigh the pilot line count.
  const affordable = shouldAnimateRoutes(visiblePilotLines.length, true);
  const animMode = affordable ? (animate ? 'loop' : playOnce ? 'once' : null) : null;
  const manyRoutes = (visiblePilotLines.length + visiblePassengerLines.length) > HIT_LINE_LIMIT;

  const toggleAnimate = (on) => { setAnimate(on); setPlayOnce(false); saveAnimatePref(on); if (on) setPlays((n) => n + 1); };
  const replay = () => { if (!animate) setPlayOnce(true); setPlays((n) => n + 1); };

  // "All" mixes pilot and passenger time, so the hours stat is labeled to say so explicitly; filtered to
  // one role, the role name alone is unambiguous.
  const hoursLabel = roleFilter === 'all' ? 'hours (pilot + passenger)' : `${roleFilter} hours`;
  const distanceNm = Math.round(data?.totalDistanceNm ?? 0).toLocaleString();

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
        <EscapePopupCloser />
        <FitBounds points={points} />

        {visiblePilotLines.map(({ route: r, key, positions, label }, i) => {
          const stroke = routeColor;
          const weight = 1.5 + 2.5 * (r.count / maxRoute);
          const popup = (
            <Popup>
              <div className="min-w-[11rem]">
                <div className="text-base font-semibold">{label}</div>
                <div className="mt-1 text-sm font-medium">{r.count} flight{r.count === 1 ? '' : 's'} · {fmtHours(r.hours)} h · {fmtNm(r.distanceNm)}</div>
                <div className="text-xs text-slate-500">
                  {r.first === r.last ? fmtDate(r.last) : `${fmtDate(r.first)} – ${fmtDate(r.last)}`}
                </div>
              </div>
            </Popup>
          );
          return (
            <Fragment key={key}>
              {/* While animating, a faint full line underneath keeps the route readable as it draws in above it. */}
              {animMode && <Polyline positions={positions} interactive={false} pathOptions={{ color: stroke, weight, opacity: 0.2 }} />}
              <RouteLine positions={positions} mode={animMode} playKey={plays} delay={Math.min(i * 70, 1200)}
                pathOptions={{ color: stroke, weight, opacity: animMode ? 0.85 : 0.7 }} />
              {/* Wide invisible line so thin routes are easy to tap */}
              <Polyline positions={positions} pathOptions={{ color: stroke, weight: manyRoutes ? weight : 18, opacity: manyRoutes ? 0.01 : 0.01 }}>{popup}</Polyline>
            </Fragment>
          );
        })}

        {/* Passenger routes: always a plain static dashed line (never animated) — a distinct color AND
            dash pattern from pilot routes, per the app's flight-role legend below. */}
        {visiblePassengerLines.map(({ route: r, key, positions, label }) => {
          const weight = 1.5 + 2.5 * (r.count / maxRoute);
          const popup = (
            <Popup>
              <div className="min-w-[11rem]">
                <div className="text-base font-semibold">{label}</div>
                <div className="mt-1 text-sm font-medium">{r.count} flight{r.count === 1 ? '' : 's'} (passenger) · {fmtHours(r.hours)} h · {fmtNm(r.distanceNm)}</div>
                <div className="text-xs text-slate-500">
                  {r.first === r.last ? fmtDate(r.last) : `${fmtDate(r.first)} – ${fmtDate(r.last)}`}
                </div>
              </div>
            </Popup>
          );
          return (
            <Fragment key={key}>
              <Polyline positions={positions} interactive={false}
                pathOptions={{ color: passengerRouteColor, weight, opacity: 0.75, dashArray: PASSENGER_ROUTE_DASH }} />
              <Polyline positions={positions} pathOptions={{ color: passengerRouteColor, weight: manyRoutes ? weight : 18, opacity: 0.01 }}>{popup}</Polyline>
            </Fragment>
          );
        })}

        {data?.stops.map((s) => (
          <Marker key={s.ident} position={[s.lat, s.lon]} icon={icons.get(s.ident)}>
            {/* Extra top-left padding keeps the popup clear of the floating stats panel/legend; extra
                bottom-right padding keeps it clear of the attribution toggle. */}
            <Popup autoPanPaddingTopLeft={[16, 170]} autoPanPaddingBottomRight={[16, 70]}>
              <PinSummary stop={s} photoCounts={photoCounts} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {flights && flights.length > 0 && (
        <div className="absolute left-3 top-3 z-[1000] flex max-w-[calc(100%-1.5rem)] flex-col items-start">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="map-stats"
              className="pressable flex h-10 items-center gap-1.5 rounded-full border border-edge-strong bg-navy-900/90 px-3.5 text-xs font-medium text-slate-100 backdrop-blur active:bg-navy-800">
              <span>{counts.airports} airport{counts.airports === 1 ? '' : 's'}</span>
              {counts.regionsKnown && <><span aria-hidden="true" className="text-slate-500">·</span><span>{counts.states} state{counts.states === 1 ? '' : 's'}</span></>}
              <ChevronDown size={14} aria-hidden="true" className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            <button type="button" onClick={replay} aria-label="Replay route animation" disabled={!affordable}
              className="pressable flex h-10 w-10 items-center justify-center rounded-full border border-edge-strong bg-navy-900/90 text-slate-300 backdrop-blur active:text-accent disabled:opacity-40">
              <RotateCcw size={16} />
            </button>
          </div>

          <section id="map-stats" aria-label="Map details and options" aria-hidden={!open} inert={open ? undefined : ''}
            className={`grid w-64 max-w-full overflow-hidden rounded-[1.25rem] border border-edge-strong bg-navy-900/95 text-sm shadow-[var(--shadow-card)] backdrop-blur transition-[grid-template-rows,opacity,margin-top] duration-200 ease-out ${open ? 'mt-2 opacity-100' : 'mt-0 pointer-events-none opacity-0'}`}
            style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
            <div className="min-h-0 overflow-hidden p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Map details</h2>

              <div className="mt-3 flex gap-1 rounded-xl bg-navy-800 p-1" role="group" aria-label="Filter by role">
                {ROLE_FILTERS.map(([k, l, activeClass]) => (
                  <button key={k} type="button" onClick={() => setRoleFilter(k)} aria-pressed={roleFilter === k}
                    className={`pressable h-11 flex-1 rounded-lg text-xs font-medium transition-colors ${roleFilter === k ? activeClass : 'text-slate-400'}`}>{l}</button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-x-2 gap-y-3">
                <Stat label={counts.airports === 1 ? 'airport' : 'airports'} value={counts.airports} />
                {counts.regionsKnown && <Stat label={counts.states === 1 ? 'state' : 'states'} value={counts.states} />}
                {counts.countries > 1 && <Stat label="countries" value={counts.countries} />}
                <Stat label="routes" value={visiblePilotLines.length + visiblePassengerLines.length} />
                <Stat label="flights" value={filteredFlights.length} />
                <Stat label={hoursLabel} value={fmtHours(totalHours)} />
                <Stat label="distance" value={distanceNm} unit="nm" />
              </div>

              <div className="mt-3 border-t border-edge pt-1">
                <Toggle label="Animate routes"
                  description={!affordable && visiblePilotLines.length > ANIMATE_ROUTE_LIMIT ? 'Off: many routes' : undefined}
                  checked={animate} onChange={toggleAnimate} />
              </div>
            </div>
          </section>

          {hasPassengerRoutes && (
            <div className="mt-2 flex items-center gap-3 rounded-full border border-edge-strong bg-navy-900/90 px-3.5 py-2 text-[11px] text-slate-300 shadow-[var(--shadow-card)] backdrop-blur">
              <span className="flex items-center gap-1.5"><svg width="16" height="2" aria-hidden="true"><line x1="0" y1="1" x2="16" y2="1" stroke={routeColor} strokeWidth="2" /></svg>Pilot</span>
              <span className="flex items-center gap-1.5"><svg width="16" height="2" aria-hidden="true"><line x1="0" y1="1" x2="16" y2="1" stroke={passengerRouteColor} strokeWidth="2" strokeDasharray={PASSENGER_ROUTE_DASH} /></svg>Passenger</span>
            </div>
          )}
        </div>
      )}

      <AttributionToggle />

      {data && (data.unresolved.length > 0 || data.unresolvedFlightCount > 0) && (
        <p className="absolute bottom-3 left-3 right-16 z-[1000] rounded-xl border border-edge-strong bg-navy-900/90 p-3 text-xs text-slate-300 backdrop-blur">
          {data.unresolved.length > 0 && (
            <>Couldn’t place {data.unresolved.join(', ')} — check the airport code
            {airports && Object.keys(airports).length === 0 ? ' (has the airport database been seeded? run “npm run seed -w server”)' : ''}.</>
          )}
          {data.unresolvedFlightCount > 0 && (
            <span className={data.unresolved.length > 0 ? 'mt-1 block' : ''}>
              {data.unresolvedFlightCount} flight{data.unresolvedFlightCount === 1 ? '' : 's'} not shown, missing airport data.
            </span>
          )}
        </p>
      )}

      {error && <p role="alert" className="absolute left-4 right-4 top-4 z-[1000] rounded-xl bg-bad/90 p-3 text-sm text-white">{error}</p>}

      {!data && !error && (
        <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center p-8 text-center text-slate-300">
          <div className="card-elevated border border-edge-strong bg-navy-900/85 p-6 backdrop-blur">
            <Plane size={36} strokeWidth={1.5} className="mx-auto animate-pulse text-slate-500" />
            <p className="mt-3 font-medium">Loading your flights…</p>
          </div>
        </div>
      )}

      {data && data.stops.length === 0 && flights?.length === 0 && !error && (
        <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center p-8 text-center text-slate-300">
          <div className="card-elevated border border-edge-strong bg-navy-900/85 p-6 backdrop-blur">
            <Plane size={36} strokeWidth={1.5} className="mx-auto text-slate-500" />
            <p className="mt-3 font-medium">Nothing to plot yet</p>
            <p className="text-sm text-slate-400">Log a flight with departure and arrival airports.</p>
          </div>
        </div>
      )}

      {data && data.stops.length === 0 && flights?.length > 0 && !error && (
        <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center p-8 text-center text-slate-300">
          <div className="card-elevated border border-edge-strong bg-navy-900/85 p-6 backdrop-blur">
            <Plane size={36} strokeWidth={1.5} className="mx-auto text-slate-500" />
            <p className="mt-3 font-medium">Nothing to plot for this filter</p>
            <p className="text-sm text-slate-400">Try "All" — no {roleFilter} flights have a placeable airport yet.</p>
          </div>
        </div>
      )}
    </div>
  );
}
