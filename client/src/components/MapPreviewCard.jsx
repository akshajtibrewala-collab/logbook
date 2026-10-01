import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Map as MapIcon } from 'lucide-react';
import { buildMapData } from '../lib/mapdata.js';
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

// Land/coastline tone per theme: one step off the card background (navy-800 vs the navy-900 card), so the
// backdrop reads as a shape without competing with the route/airport colors drawn on top of it.
const LAND_FILL = { dark: 'rgb(22 26 35)', light: 'rgb(238 241 246)' };
const COASTLINE_STROKE = { dark: 'rgb(37 43 56)', light: 'rgb(217 222 232)' };

const VIEW_W = 400;
const VIEW_H = 110; // wide and low, so the preview reads as a strip rather than a second map

/**
 * A static, tile-free route overview for Home: every route drawn with the same role styling as the real
 * Map (pilot sky-blue solid, passenger violet dashed), projected with lib/routeProjection.js instead of
 * Leaflet. Deliberately lightweight — no tiles, no pan/zoom, just enough shape to invite a tap through to
 * the full Map. Code-split via React.lazy() in Home.jsx so this (and its map-data computation) only loads
 * once Home actually renders it, never blocking the rest of the page.
 */
export default function MapPreviewCard({ flights, airports }) {
  const navigate = useNavigate();
  const theme = useTheme();

  const pilotData = useMemo(() => buildMapData(pilotFlights(flights), airports), [flights, airports]);
  const passengerData = useMemo(() => buildMapData(flights.filter((f) => roleOf(f) === 'passenger'), airports), [flights, airports]);
  const allData = useMemo(() => buildMapData(flights, airports), [flights, airports]);
  const counts = useMemo(() => visitedCounts(allData.stops), [allData]);

  const allPoints = useMemo(() => allData.stops.map((s) => [s.lat, s.lon]), [allData]);
  const project = useMemo(() => buildProjection(allPoints, VIEW_W, VIEW_H, 10), [allPoints]);
  const landPath = useMemo(() => buildLandPath(landOutline, project), [project]);

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

  const toSegments = (routes) => routes.map((r) => {
    const [x1, y1] = project([r.a.lat, r.a.lon]);
    const [x2, y2] = project([r.b.lat, r.b.lon]);
    return { key: `${r.a.ident}-${r.b.ident}`, x1, y1, x2, y2 };
  });

  return (
    <Card as="button" onClick={() => navigate('/map')} className="w-full text-left active:bg-navy-800">
      <div className="flex items-center justify-between text-sm font-medium text-slate-300">
        <span className="flex items-center gap-2"><MapIcon size={16} />Map</span><ChevronRight size={16} className="text-slate-500" />
      </div>

      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="mt-2 h-auto w-full" role="img" aria-label="Route map preview">
        {landPath && <path d={landPath} fill={LAND_FILL[theme]} stroke={COASTLINE_STROKE[theme]} strokeWidth="0.75" />}
        {toSegments(passengerData.routes).map((s) => (
          <line key={`pax-${s.key}`} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={passengerColor} strokeWidth="1.5" strokeDasharray={PASSENGER_ROUTE_DASH} opacity="0.75" />
        ))}
        {toSegments(pilotData.routes).map((s) => (
          <line key={`pilot-${s.key}`} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={routeColor} strokeWidth="1.75" opacity="0.85" />
        ))}
        {allData.stops.map((s) => {
          const [x, y] = project([s.lat, s.lon]);
          return <circle key={s.ident} cx={x} cy={y} r="2.5" fill={routeColor} opacity="0.9" />;
        })}
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <span>{counts.airports} airport{counts.airports === 1 ? '' : 's'}</span>
        {counts.countries > 1 && <span>{counts.countries} countries</span>}
        <span>{fmtNm(allData.totalDistanceNm)}</span>
      </div>
    </Card>
  );
}
