import { useMemo } from 'react';
import { Luggage, Route } from 'lucide-react';
import { fmtHours } from '../../lib/hours.js';
import { fmtNm } from '../../lib/geo.js';
import { hoursByAircraft, hoursByAirline, topRoutes } from '../../lib/stats.js';
import { flightsByYear } from '../../lib/charts.js';
import { buildMapData } from '../../lib/mapdata.js';
import { visitedCounts } from '../../lib/mapstyle.js';
import EmptyState from '../../components/EmptyState.jsx';
import SummaryStrip from './SummaryStrip.jsx';
import AircraftBarChart from './AircraftBarChart.jsx';
import AirlinesCard from './AirlinesCard.jsx';
import RankedCard from './RankedCard.jsx';
import FlightsPerYearChart from './FlightsPerYearChart.jsx';

const ROUTE_LIMIT = 25;

export default function TravelTab({ passengerFlights, airports }) {
  const data = useMemo(() => {
    const mapData = buildMapData(passengerFlights, airports);
    const counts = visitedCounts(mapData.stops);
    const hours = passengerFlights.reduce((s, f) => s + (Number(f.total_time) || 0), 0);
    return {
      flights: passengerFlights.length,
      hours,
      airports: counts.airports,
      countries: counts.countries,
      distanceNm: mapData.totalDistanceNm,
      aircraft: hoursByAircraft(passengerFlights),
      airlines: hoursByAirline(passengerFlights),
      routes: topRoutes(passengerFlights, airports, ROUTE_LIMIT),
      byYear: flightsByYear(passengerFlights),
    };
  }, [passengerFlights, airports]);

  if (passengerFlights.length === 0) {
    return (
      <EmptyState icon={Luggage} title="No passenger flights yet."
        description="Riding along, not flying — commercial trips, anything you weren't the pilot on. Log one from the Travel page and it'll show up here." />
    );
  }

  return (
    <div className="bc-stack">
      <SummaryStrip scope="Passenger" tint="pax" primary={{ label: 'Total hours', value: fmtHours(data.hours) }} items={[
        { label: 'Flights', value: data.flights },
        { label: 'Airports', value: data.airports },
        { label: 'Countries', value: data.countries },
      ]} />
      <FlightsPerYearChart rows={data.byYear} note={`By calendar year · ${fmtNm(data.distanceNm)} flown in total.`} />
      <AirlinesCard airlines={data.airlines} />
      <AircraftBarChart title="Aircraft types" byType={data.aircraft} tint="pax" defaultOpen={false} />
      <RankedCard title="Most flown routes" icon={Route} tint="pax" rows={data.routes} />
    </div>
  );
}
