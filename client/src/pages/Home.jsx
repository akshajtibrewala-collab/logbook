import { lazy, Suspense, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plane } from 'lucide-react';
import useHomeData from '../hooks/useHomeData.js';
import { BcHero } from '../components/bc/Bc.jsx';
import Button from '../components/Button.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import { MnEmpty, MnSkeleton } from '../components/mn/Mn.jsx';
import HubTiles from './home/HubTiles.jsx';
import { calmGreeting } from '../lib/logbookList.js';
import { PILOT_NAME } from '../lib/greetings.js';
import { fmtHours } from '../lib/hours.js';
import { LONG_GAP_DAYS } from '../lib/homeAlerts.js';
import '../ds/bcalm.css';
import '../ds/hub.css';

// Code-split like before: the land outline only loads once Home actually draws the map; a skeleton holds the place meanwhile.
const MapBackdrop = lazy(() => import('../ds/MapBackdrop.jsx'));

/**
 * Home (the hub, direction A "Board", docs/design/home-hub.html): one greeting line, one hero (Total flight hours: pilot + passenger, no progress line), one
 * status line, a short band of the map of every flight (real land outline and routes, tap opens the Map), then one tile per module that exists, each with one live value.
 * Every number comes from the same lib/ functions via useHomeData (pilot figures pilot-only; passenger figures match Travel, Stats and Map).
 */
export default function Home() {
  const h = useHomeData();
  // The Map tab's code and Leaflet's stylesheet are fetched while Home sits idle, so opening the Map does not start with a download.
  useEffect(() => {
    const run = () => { import('./Map.jsx').catch(() => {}); };
    const idle = typeof requestIdleCallback === 'function';
    const id = idle ? requestIdleCallback(run, { timeout: 4000 }) : setTimeout(run, 2000);
    return () => (idle ? cancelIdleCallback(id) : clearTimeout(id));
  }, []);
  const { flights, data, error, load, status, pilotOnly, passengerOnly, passengerHours, allHours, allCounts, closest, map, homeAirport, aircraft } = h;
  const hasFlights = Boolean(flights && flights.length > 0);
  const greeting = useMemo(() => calmGreeting(new Date(), PILOT_NAME), []);

  // Every role together (pilot + passenger flights): the one place Home mixes roles, so the label says so and no scope dot is shown.
  const hero = data && (
    <BcHero to="/logbook" label="Total flight hours" number={allHours} ariaLabel={`Total flight hours: ${fmtHours(allHours)}, pilot and passenger. Open the Logbook`} />
  );
  const gapDays = status.daysSinceLastFlight;
  const statusLine = (
    <>
      <Link to={status.to} className="bc-status" aria-label={status.count === 0 ? 'All clear. Open Currency' : `${status.count} item${status.count === 1 ? '' : 's'} need attention. Open`}>
        <span className={`bc-dot ${status.count === 0 ? 'ok' : 'warn'}`} aria-hidden="true" />
        <span>{status.count === 0 ? 'All clear' : `${status.count} need${status.count === 1 ? 's' : ''} attention`}</span>
      </Link>
      {gapDays !== null && gapDays >= LONG_GAP_DAYS && <p className="bc-gap">{gapDays} days since your last flight</p>}
    </>
  );
  const mapCard = map && (
    <Link to="/map" className="bc-map" aria-label="Open the map">
      <Suspense fallback={<div className="skel" aria-hidden="true" />}><MapBackdrop routes={map.routes} stops={map.stops} home={homeAirport} fitAll width={400} height={420} /></Suspense>
    </Link>
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
        <div className="hub-home">
          <p className="bc-greet">{greeting}</p>
          {hero}
          {statusLine}
          <div className="hub-band">{mapCard}</div>
          <HubTiles pilotCount={pilotOnly.length} passengerCount={passengerOnly.length} passengerHours={passengerHours} airports={allCounts.airports} aircraftCount={aircraft.filter((a) => !a.archived_at).length} status={status}
            milestonePercent={closest ? Math.round(closest.percent) : null} />
        </div>
      )}
    </div>
  );
}
