import { lazy, Suspense, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plane } from 'lucide-react';
import useHomeData from '../hooks/useHomeData.js';
import { BcHero, BcItem } from '../components/bc/Bc.jsx';
import Button from '../components/Button.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import { MnEmpty, MnSkeleton } from '../components/mn/Mn.jsx';
import WeatherLine from './home/WeatherLine.jsx';
import { calmGreeting } from '../lib/logbookList.js';
import { PILOT_NAME } from '../lib/greetings.js';
import { logbookProgress } from '../lib/logbookProgress.js';
import { fmtHours } from '../lib/hours.js';
import { formatDate as fmtDate } from '../lib/calendar.js';
import '../ds/bcalm.css';

// Code-split like before: the land outline only loads once Home actually draws the map; a skeleton holds the place meanwhile.
const MapBackdrop = lazy(() => import('../ds/MapBackdrop.jsx'));

/**
 * Home (B-calm, docs/design/home-bcalm.html): one greeting line, one hero (Private Pilot total time with a thin line toward the minimum), one status line,
 * a quiet map of every flight (real land outline and routes, tap opens the Map), and four items: Passenger, weather, Quick log and the last flight.
 * Every number comes from the same lib/ functions via useHomeData (pilot figures pilot-only; passenger figures match Travel, Stats and Map).
 */
export default function Home() {
  const h = useHomeData();
  const { flights, data, error, load, status, passengerOnly, passengerHours, recentItems, map, homeAirport, milestonesConfig, aircraft, milestoneCompletions } = h;
  const hasFlights = Boolean(flights && flights.length > 0);
  const greeting = useMemo(() => calmGreeting(new Date(), PILOT_NAME), []);
  const progress = useMemo(
    () => (flights && milestonesConfig ? logbookProgress({ config: milestonesConfig, flights, aircraft, completions: milestoneCompletions }) : null),
    [flights, milestonesConfig, aircraft, milestoneCompletions],
  );
  const last = recentItems[0];

  const hero = data && (
    <BcHero to="/logbook" label={progress ? progress.label : 'Pilot'} dot="pilot" number={data.stats.total} of={progress ? `of ${progress.min} h` : undefined} percent={progress ? progress.percent : undefined}
      barLabel={progress ? `Total time ${fmtHours(progress.current)} of the ${progress.min} hour ${progress.label} total-time minimum` : undefined}
      ariaLabel={`${progress ? progress.label : 'Pilot'}: ${fmtHours(data.stats.total)} hours total time${progress ? `, ${progress.met ? 'minimum reached' : `${fmtHours(progress.remaining)} hours to the ${progress.min} hour total-time minimum`}` : ''}. Open the Logbook`} />
  );
  const statusLine = (
    <Link to={status.to} className="bc-status" aria-label={status.count === 0 ? 'All clear. Open Currency' : `${status.count} item${status.count === 1 ? '' : 's'} need attention. Open`}>
      <span className={`bc-dot ${status.count === 0 ? 'ok' : 'warn'}`} aria-hidden="true" />
      <span>{status.count === 0 ? 'All clear' : `${status.count} need${status.count === 1 ? 's' : ''} attention`}</span>
    </Link>
  );
  const mapCard = map && (
    <Link to="/map" className="bc-map" aria-label="Open the map">
      <Suspense fallback={<div className="skel" aria-hidden="true" />}><MapBackdrop routes={map.routes} stops={map.stops} home={homeAirport} fitAll width={400} height={420} /></Suspense>
    </Link>
  );
  const items = (
    <div className="bc-items">
      {passengerOnly.length > 0
        ? <BcItem to="/travel" dot="pax" title="Passenger" bold={fmtHours(passengerHours)} />
        : <BcItem to="/logbook/new?role=passenger&from=home" dot="pax" title="Passenger" value="Add" />}
      <WeatherLine />
      <BcItem to="/logbook/quick" title="Quick log" />
      {last && (
        <BcItem to={last.role === 'passenger' ? `/travel/${last.id}` : `/logbook/${last.id}`} dot={last.role === 'passenger' ? 'pax' : 'pilot'}
          title={`${fmtDate(last.date).slice(0, 5)} ${[last.tail_number, last.aircraft_type].find(Boolean) ?? ''}`.trim()} bold={fmtHours(last.hours)} />
      )}
    </div>
  );

  return (
    <div className="cl bc">
      {error && <ErrorNote message={error} onRetry={load} />}
      {!data && !error && <MnSkeleton rows={3} />}
      {data && !hasFlights && (
        <>
          <p className="bc-greet">{greeting}</p>
          <MnEmpty title="Welcome to AeroHub" icon={<Plane />} action={<div style={{ display: 'grid', gap: 8 }}><Button as={Link} to="/logbook/new" size="lg">Add your first flight</Button><Button as={Link} to="/logbook/data" variant="secondary">Import a CSV</Button></div>} />
        </>
      )}
      {data && hasFlights && (
        <div className="bc-home-cols">
          <p className="bc-greet g-greet">{greeting}</p>
          <div className="g-hero">{hero}</div>
          <div className="g-status">{statusLine}</div>
          <div className="g-map">{mapCard}</div>
          <div className="g-items">{items}</div>
        </div>
      )}
    </div>
  );
}
