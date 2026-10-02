import { useMemo } from 'react';
import { MapPin, Route } from 'lucide-react';
import { fmtNm } from '../../lib/geo.js';
import { topRoutes, topAirports } from '../../lib/stats.js';
import { distinctAircraftTypeCount } from '../../lib/aircraftTypes.js';
import { buildMapData } from '../../lib/mapdata.js';
import { visitedCounts } from '../../lib/mapstyle.js';
import { roleOf } from '../../lib/flightRoles.js';
import SummaryStrip from './SummaryStrip.jsx';
import RankedCard from './RankedCard.jsx';

const ROUTE_LIMIT = 25;
export const byRole = (flights, roleFilter) => (roleFilter === 'all' ? flights : flights.filter((f) => roleOf(f) === roleFilter));

// Places mixes both roles by default; once the pilot narrows the role filter, its tint follows along so
// the same role-color convention as the Pilot/Travel tabs still applies here.
const TINT_FOR_ROLE = { all: 'neutral', pilot: 'pilot', passenger: 'pax' };

export default function PlacesTab({ flights, airports, roleFilter }) {
  const scoped = useMemo(() => byRole(flights, roleFilter), [flights, roleFilter]);
  const tint = TINT_FOR_ROLE[roleFilter];

  const data = useMemo(() => {
    const mapData = buildMapData(scoped, airports);
    const counts = visitedCounts(mapData.stops);
    return {
      airports: counts.airports,
      countries: counts.countries,
      aircraftTypes: distinctAircraftTypeCount(scoped),
      distanceNm: mapData.totalDistanceNm,
      routes: topRoutes(scoped, airports, ROUTE_LIMIT),
      places: topAirports(scoped, airports, ROUTE_LIMIT).map((a) => ({ label: a.code, sub: a.name, count: a.count })),
    };
  }, [scoped, airports]);

  return (
    <div className="stagger space-y-4">
      <SummaryStrip icon={MapPin} tint={tint} primary={{ label: 'Airports', value: data.airports }} items={[
        { label: 'Countries', value: data.countries },
        { label: 'Aircraft types', value: data.aircraftTypes },
        { label: 'Distance', value: fmtNm(data.distanceNm) },
      ]} />
      <RankedCard title="Most visited airports" icon={MapPin} tint={tint === 'neutral' ? undefined : tint} rows={data.places} />
      <RankedCard title="Most flown routes" icon={Route} tint={tint === 'neutral' ? undefined : tint} rows={data.routes} />
    </div>
  );
}
