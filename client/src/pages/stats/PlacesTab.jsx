import { useMemo } from 'react';
import { fmtNm } from '../../lib/geo.js';
import { hoursByAircraft, topRoutes, topAirports } from '../../lib/stats.js';
import { buildMapData } from '../../lib/mapdata.js';
import { visitedCounts } from '../../lib/mapstyle.js';
import { roleOf } from '../../lib/flightRoles.js';
import SummaryStrip from './SummaryStrip.jsx';
import RankedCard from './RankedCard.jsx';

const ROUTE_LIMIT = 25;
export const byRole = (flights, roleFilter) => (roleFilter === 'all' ? flights : flights.filter((f) => roleOf(f) === roleFilter));

export default function PlacesTab({ flights, airports, roleFilter }) {
  const scoped = useMemo(() => byRole(flights, roleFilter), [flights, roleFilter]);

  const data = useMemo(() => {
    const mapData = buildMapData(scoped, airports);
    const counts = visitedCounts(mapData.stops);
    return {
      airports: counts.airports,
      countries: counts.countries,
      aircraftTypes: hoursByAircraft(scoped).length,
      distanceNm: mapData.totalDistanceNm,
      routes: topRoutes(scoped, airports, ROUTE_LIMIT),
      places: topAirports(scoped, airports, ROUTE_LIMIT).map((a) => ({ label: a.code, sub: a.name, count: a.count })),
    };
  }, [scoped, airports]);

  return (
    <div className="stagger space-y-4">
      <SummaryStrip items={[
        { label: 'Airports', value: data.airports },
        { label: 'Countries', value: data.countries },
        { label: 'Aircraft types', value: data.aircraftTypes },
        { label: 'Distance', value: fmtNm(data.distanceNm) },
      ]} />
      <RankedCard title="Most visited airports" rows={data.places} />
      <RankedCard title="Most flown routes" rows={data.routes} />
    </div>
  );
}
