import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './App.jsx';
import AuthGate from './components/AuthGate.jsx';
import PublicShare from './pages/PublicShare.jsx';
import { applyTheme, currentTheme } from './lib/theme.js';

applyTheme(currentTheme());

// The shared read-only summary lives outside the passcode gate (it authenticates with its own link token
// and only ever calls the public API); everything else is the app behind AuthGate.
createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/share/:token" element={<PublicShare />} />
      <Route path="*" element={<AuthGate><App /></AuthGate>} />
    </Routes>
  </BrowserRouter>
);

// Cache map tiles for speed and offline use (see public/sw.js). Production only, so local dev is never
// affected by a stale worker.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
