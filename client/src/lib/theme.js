import { useSyncExternalStore } from 'react';

// A saved choice (from the toggle) wins; otherwise the device's light/dark preference decides, and dark
// is the fallback. Remembered in localStorage, which can be unavailable, so it is optional.
const KEY = 'logbook-theme';
const listeners = new Set();

export function currentTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* storage blocked: fall through to the system preference */ }
  try {
    if (globalThis.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
  } catch { /* no matchMedia: default below */ }
  return 'dark';
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle('light', theme === 'light');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f4f6fa' : '#07090d');
}

export function setTheme(theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* remembering is a nicety */ }
  applyTheme(theme);
  listeners.forEach((l) => l());
}

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
export const useTheme = () => useSyncExternalStore(subscribe, currentTheme, () => 'dark');
