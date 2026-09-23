import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Logbook from './pages/Logbook.jsx';
import FlightForm from './pages/FlightForm.jsx';
import FlightDetail from './pages/FlightDetail.jsx';
import Skeleton from './components/Skeleton.jsx';

// Map, Stats and the CSV/Aircraft screens are all secondary, so they load on demand.
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

export default function App() {
  const location = useLocation();
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <main key={location.pathname} className="flex-1 animate-[fade_.2s_ease-out] px-4 pt-6 pb-[calc(var(--bottom-nav-h)+2rem)]">
        <Suspense fallback={<div className="space-y-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-40" /></div>}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/logbook" element={<Logbook />} />
          <Route path="/logbook/data" element={<ImportExport />} />
          <Route path="/aircraft" element={<Aircraft />} />
          <Route path="/aircraft/new" element={<AircraftForm />} />
          <Route path="/aircraft/:id" element={<AircraftForm />} />
          <Route path="/logbook/new" element={<FlightForm />} />
          <Route path="/logbook/:id" element={<FlightDetail />} />
          <Route path="/logbook/:id/edit" element={<FlightForm />} />
          <Route path="/milestones" element={<Milestones />} />
          <Route path="/currency" element={<Currency />} />
          <Route path="/currency/new" element={<ExpirationForm />} />
          <Route path="/currency/:id" element={<ExpirationForm />} />
          <Route path="/weather" element={<Weather />} />
          <Route path="/weather/settings" element={<WeatherSettings />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </main>
      <BottomNav />
    </div>
  );
}
