import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Map as MapIcon } from 'lucide-react';
import { buildMapData, placeableMapData } from '../lib/mapdata.js';
import { visitedCounts, routeColorFor, passengerRouteColorFor, PASSENGER_ROUTE_DASH } from '../lib/mapstyle.js';
import { buildProjection } from '../lib/routeProjection.js';
import { buildLandPath } from '../lib/landPath.js';
import { fmtNm } from '../lib/geo.js';
import { useTheme } from '../lib/theme.js';
import { pilotFlights, roleOf } from '../lib/flightRoles.js';
import Card from './Card.jsx';
// Bundled into this already-lazy-loaded chunk (see Home.jsx), so the land outline only loads when the
// map preview itself renders. No Leaflet, no tile requests — a static, simplified outline only.
import landOutline from '../lib/landOutline.json';

// Sea matches the card background exactly in dark mode; a pale blue-gray in light mode (the card itself is
// plain white there, and a literal "sea" needs its own tone to read as water rather than page background).
// Land is one step lighter than the sea in both themes. No country borders or labels — just a shape.
const SEA_FILL = { dark: 'rgb(14 17 23)', light: 'rgb(226 232 240)' };
const LAND_FILL = { dark: 'rgb(23 28 38)', light: 'rgb(241 245 249)' };
const COASTLINE_STROKE = { dark: 'rgb(37 43 56)', light: 'rgb(203 213 225)' };

const VIEW_W = 400;
const VIEW_H = 110; // wide and low, so the preview reads as a strip rather than a second map

/**
 * A static, tile-free route overview for Home: every route drawn with the same role styling as the real
 * Map (pilot sky-blue solid, passenger violet dashed), projected with lib/routeProjection.js instead of
 * Leaflet. Deliberately lightweight — no tiles, no pan/zoom, just enough shape to invite a tap through to
 * the full Map. Code-split via React.lazy() in Home.jsx so this (and its map-data computation) only loads
 * once Home actually renders it, never blocking the rest of the page.
 *
 * The frame is computed fresh from the current flights/airports on every load (lib/routeProjection.js) —
 * nothing here is sized to any particular pilot's data. It floors how far it zooms in for a tight cluster,
 * ceilings how far it zooms out for a far outlier (see routeProjection.js's OUTLIER_RADIUS_DEG for exactly
 * which choice that is), and keeps a route that crosses the antimeridian drawn the short way.
 */
export default function MapPreviewCard({ flights, airports, homeAirportIdent }) {
  const navigate = useNavigate();
  const theme = useTheme();

  const pilotData = useMemo(() => placeableMapData(buildMapData(pilotFlights(flights), airports)), [flights, airports]);
  const passengerData = useMemo(() => placeableMapData(buildMapData(flights.filter((f) => roleOf(f) === 'passenger'), airports)), [flights, airports]);
  const allData = useMemo(() => placeableMapData(buildMapData(flights, airports)), [flights, airports]);
  const counts = useMemo(() => visitedCounts(allData.stops), [allData]);

  const allPoints = useMemo(() => allData.stops.map((s) => [s.lat, s.lon]), [allData]);
  const project = useMemo(() => buildProjection(allPoints, VIEW_W, VIEW_H), [allPoints]);
  const landPath = useMemo(() => buildLandPath(landOutline, project), [project]);
  const maxVisits = allData.stops[0]?.visits ?? 1;
  const homeIdent = airports[homeAirportIdent]?.ident;

  const routeColor = routeColorFor(theme);
  const passengerColor = passengerRouteColorFor(theme);

  if (!project) {
    return (
      <Card as="button" onClick={() => navigate('/map')} className="w-full text-left active:bg-navy-800">
        <div className="flex items-center justify-between text-sm font-medium text-slate-300">
          <span className="flex items-center gap-2"><MapIcon size={16} />Map</span><ChevronRight size={16} className="text-slate-500" />
        </div>
        <p className="mt-3 py-3 text-center text-sm text-slate-500">Log a flight with airports to see your map here.</p>
      </Card>
    );
  }

  // A route endpoint unwraps relative to the OTHER endpoint's raw longitude (not the frame's own
  // reference), so one specific line always takes its own shorter path even if the overall view is
  // centered elsewhere — see routeProjection.js's `nearLon` parameter.
  const toSegments = (routes) => routes.map((r) => {
    const [x1, y1] = project([r.a.lat, r.a.lon]);
    const [x2, y2] = project([r.b.lat, r.b.lon], r.a.lon);
    return { key: `${r.a.ident}-${r.b.ident}`, x1, y1, x2, y2 };
  });

  const omittedFlightCount = allData.omittedFlightCount;

  return (
    <Card as="button" onClick={() => navigate('/map')} className="w-full text-left active:bg-navy-800">
      <div className="flex items-center justify-between text-sm font-medium text-slate-300">
        <span className="flex items-center gap-2"><MapIcon size={16} />Map</span><ChevronRight size={16} className="text-slate-500" />
      </div>

      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="mt-2 h-auto w-full" role="img" aria-label="Route map preview">
        <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill={SEA_FILL[theme]} />
        {landPath && <path d={landPath} fill={LAND_FILL[theme]} stroke={COASTLINE_STROKE[theme]} strokeWidth="0.75" />}
        {toSegments(passengerData.routes).map((s) => (
          <line key={`pax-${s.key}`} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={passengerColor} strokeWidth="1" strokeDasharray={PASSENGER_ROUTE_DASH} opacity="0.75" />
        ))}
        {toSegments(pilotData.routes).map((s) => (
          <line key={`pilot-${s.key}`} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={routeColor} strokeWidth="1.1" opacity="0.85" />
        ))}
        {allData.stops.map((s) => {
          const [x, y] = project([s.lat, s.lon]);
          const r = 1.4 + 1 * Math.sqrt(s.visits / maxVisits); // small, sized slightly by visit count
          return (
            <g key={s.ident}>
              {s.ident === homeIdent && <circle cx={x} cy={y} r={r + 3} fill="none" stroke={routeColor} strokeWidth="0.75" opacity="0.5" />}
              <circle cx={x} cy={y} r={r} fill={routeColor} opacity="0.9" />
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <span>{counts.airports} airport{counts.airports === 1 ? '' : 's'}</span>
        {counts.countries > 1 && <span>{counts.countries} countries</span>}
        <span>{fmtNm(allData.totalDistanceNm)}</span>
      </div>
      {omittedFlightCount > 0 && (
        <p className="mt-1 text-xs text-slate-500">
          {omittedFlightCount} flight{omittedFlightCount === 1 ? '' : 's'} not shown, missing airport coordinates.
        </p>
      )}
    </Card>
  );
}
