import { lazy, Suspense, useMemo } from 'react';
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
import { heroText, logbookProgress } from '../lib/logbookProgress.js';
import { fmtHours } from '../lib/hours.js';
import '../ds/bcalm.css';
import '../ds/hub.css';

// Code-split like before: the land outline only loads once Home actually draws the map; a skeleton holds the place meanwhile.
const MapBackdrop = lazy(() => import('../ds/MapBackdrop.jsx'));

/**
 * Home (the hub, direction A "Board", docs/design/home-hub.html): one greeting line, one hero (Private Pilot total time with a thin line toward the goal), one
 * status line, a short band of the map of every flight (real land outline and routes, tap opens the Map), then one tile per module that exists, each with one live value.
 * Every number comes from the same lib/ functions via useHomeData (pilot figures pilot-only; passenger figures match Travel, Stats and Map).
 */
export default function Home() {
  const h = useHomeData();
  const { flights, data, error, load, status, pilotOnly, passengerOnly, passengerHours, allCounts, closest, map, homeAirport, milestonesConfig, aircraft, milestoneCompletions, goal } = h;
  const hasFlights = Boolean(flights && flights.length > 0);
  const greeting = useMemo(() => calmGreeting(new Date(), PILOT_NAME), []);
  const progress = useMemo(
    () => (flights && milestonesConfig ? logbookProgress({ config: milestonesConfig, flights, aircraft, completions: milestoneCompletions, goal }) : null),
    [flights, milestonesConfig, aircraft, milestoneCompletions, goal],
  );

  const heroWords = data ? heroText(progress, data.stats.total, fmtHours) : null;
  const hero = data && (
    <BcHero to="/logbook" label={progress ? progress.label : 'Pilot'} dot="pilot" number={data.stats.total} of={heroWords.of} percent={progress ? progress.percent : undefined} tick={progress ? progress.tickPercent : undefined}
      barLabel={heroWords.barLabel} ariaLabel={`${heroWords.ariaLabel}. Open the Logbook`} />
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
