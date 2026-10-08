import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AppShell from './shell/AppShell.jsx';
import Home from './pages/Home.jsx';
import Skeleton from './components/Skeleton.jsx';
import ChunkBoundary from './components/ChunkBoundary.jsx';

// Home is the only page in the first load. Everything else loads on demand behind the skeleton below: the Logbook and its Ledger, the log-a-flight form, flight and
// ground-session detail, Map, Stats, Costs, the CSV and Aircraft screens, and (in main.jsx) the hidden /design lab.
const Logbook = lazy(() => import('./pages/Logbook.jsx'));
const FlightForm = lazy(() => import('./pages/FlightForm.jsx'));
const FlightDetail = lazy(() => import('./pages/FlightDetail.jsx'));
const GroundSessionDetail = lazy(() => import('./pages/GroundSessionDetail.jsx'));
const MapPage = lazy(() => import('./pages/Map.jsx'));
const Stats = lazy(() => import('./pages/Stats.jsx'));
const ImportExport = lazy(() => import('./pages/ImportExport.jsx'));
const Aircraft = lazy(() => import('./pages/Aircraft.jsx'));
const AircraftForm = lazy(() => import('./pages/AircraftForm.jsx'));
const Milestones = lazy(() => import('./pages/Milestones.jsx'));
const Currency = lazy(() => import('./pages/Currency.jsx'));
const ExpirationForm = lazy(() => import('./pages/ExpirationForm.jsx'));
const Weather = lazy(() => import('./pages/Weather.jsx'));
const WeatherSettings = lazy(() => import('./pages/WeatherSettings.jsx'));
const Costs = lazy(() => import('./pages/Costs.jsx'));
const CostSettings = lazy(() => import('./pages/CostSettings.jsx'));
const CostsSpending = lazy(() => import('./pages/CostsSpending.jsx'));
const CostsPhases = lazy(() => import('./pages/CostsPhases.jsx'));
const CostsExpenses = lazy(() => import('./pages/CostsExpenses.jsx'));
const CostsProjection = lazy(() => import('./pages/CostsProjection.jsx'));
const GroundSessionForm = lazy(() => import('./pages/GroundSessionForm.jsx'));
const QuickFlight = lazy(() => import('./pages/QuickFlight.jsx'));
const ShareSettings = lazy(() => import('./pages/ShareSettings.jsx'));
const PrintSummary = lazy(() => import('./pages/PrintSummary.jsx'));
const PassengerFlights = lazy(() => import('./pages/PassengerFlights.jsx'));
const More = lazy(() => import('./pages/More.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));

/** After the first screen has painted and the browser is idle, fetch the pages people open next (never on a Save-Data connection), so a tap on a row or the Logbook is instant and never flashes the skeleton. */
function usePrefetchNextPages() {
  useEffect(() => {
    if (navigator.connection?.saveData) return undefined;
    const quiet = () => {}; // a failed prefetch is not an error: the page loads (or the boundary recovers) when it is really opened
    const run = () => { import('./pages/Logbook.jsx').catch(quiet); import('./pages/FlightDetail.jsx').catch(quiet); import('./pages/GroundSessionDetail.jsx').catch(quiet); import('./pages/FlightForm.jsx').catch(quiet); import('./pages/PassengerFlights.jsx').catch(quiet); };
    const ric = window.requestIdleCallback; const id = ric ? ric(run, { timeout: 4000 }) : setTimeout(run, 1500);
    return () => { if (ric) window.cancelIdleCallback(id); else clearTimeout(id); };
  }, []);
}

export default function App() {
  usePrefetchNextPages();
  const { pathname } = useLocation();
  return (
    <AppShell>
      <ChunkBoundary resetKey={pathname}>
      <Suspense fallback={<div className="space-y-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-40" /></div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/logbook" element={<Logbook />}>
            <Route path="ground/:id" element={<GroundSessionDetail />} />
            <Route path=":id" element={<FlightDetail />} />
          </Route>
          <Route path="/flying" element={<Navigate to="/logbook" replace />} />
          <Route path="/travel" element={<PassengerFlights />}>
            <Route path=":id" element={<FlightDetail />} />
          </Route>
          <Route path="/logbook/data" element={<ImportExport />} />
          <Route path="/aircraft" element={<Aircraft />} />
          <Route path="/aircraft/new" element={<AircraftForm />} />
          <Route path="/aircraft/:id" element={<AircraftForm />} />
          <Route path="/logbook/new" element={<FlightForm />} />
          <Route path="/logbook/quick" element={<QuickFlight />} />
          <Route path="/logbook/share" element={<ShareSettings />} />
          <Route path="/logbook/print" element={<PrintSummary />} />
          <Route path="/logbook/:id/edit" element={<FlightForm />} />
          <Route path="/logbook/ground/new" element={<GroundSessionForm />} />
          <Route path="/logbook/ground/:id/edit" element={<GroundSessionForm />} />
          <Route path="/milestones" element={<Milestones />} />
          <Route path="/currency" element={<Currency />} />
          <Route path="/currency/new" element={<ExpirationForm />} />
          <Route path="/currency/:id" element={<ExpirationForm />} />
          <Route path="/weather" element={<Weather />} />
          <Route path="/weather/settings" element={<WeatherSettings />} />
          <Route path="/costs" element={<Costs />} />
          <Route path="/costs/settings" element={<CostSettings />} />
          <Route path="/costs/spending" element={<CostsSpending />} />
          <Route path="/costs/phases" element={<CostsPhases />} />
          <Route path="/costs/expenses" element={<CostsExpenses />} />
          <Route path="/costs/projection" element={<CostsProjection />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/more" element={<More />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </ChunkBoundary>
    </AppShell>
  );
}
