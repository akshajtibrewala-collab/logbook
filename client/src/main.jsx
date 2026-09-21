import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './App.jsx';
import AuthGate from './components/AuthGate.jsx';
import { applyTheme, currentTheme } from './lib/theme.js';

applyTheme(currentTheme());

createRoot(document.getElementById('root')).render(
  <BrowserRouter><AuthGate><App /></AuthGate></BrowserRouter>
);
