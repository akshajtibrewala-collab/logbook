import { useEffect, useId, useRef, useState } from 'react';
import { History } from 'lucide-react';
import { api } from '../lib/api.js';
import { getRecents, recordRecent } from '../lib/recents.js';

// A text field that also offers autocomplete matches (via /api/airports/search — by code, name or city)
// as you type, and airports you've used before when it's focused and empty. It never requires picking
// one: typing a code directly and moving on works too, same as every other airport field in this app.
export default function AirportSearchField({ label, value, onChange, error, placeholder = 'KPAO' }) {
  const [query, setQuery] = useState(value ?? '');
  const [matches, setMatches] = useState([]);
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState([]);
  const boxRef = useRef(null);
  const listId = useId();

  useEffect(() => setQuery(value ?? ''), [value]);

  useEffect(() => {
    if (query.trim().length < 2) { setMatches([]); return undefined; }
    const timer = setTimeout(() => {
      api.searchAirports(query.trim()).then(setMatches).catch(() => setMatches([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onClickAway = (e) => {
      if (boxRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  function remember(code) {
    const c = String(code ?? '').trim().toUpperCase();
    if (/^[A-Z0-9]{3,4}$/.test(c)) recordRecent('airports', c);
  }

  function pick(code) {
    onChange(code);
    setQuery(code);
    remember(code);
    setOpen(false);
  }

  const showRecents = open && query.trim().length < 2 && recents.length > 0;
  const showMatches = open && matches.length > 0;

  return (
    <div ref={boxRef} className="relative">
      <label className="block">
        {label && <span className="mb-1 block text-xs text-slate-400">{label}</span>}
        <input value={query} placeholder={placeholder} autoCapitalize="characters" autoComplete="off" role="combobox"
          aria-expanded={showMatches || showRecents} aria-controls={listId} aria-autocomplete="list"
          onFocus={() => { setRecents(getRecents('airports')); setOpen(true); }}
          onBlur={() => remember(query)}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
          onChange={(e) => { const v = e.target.value.toUpperCase(); setQuery(v); onChange(v); setOpen(true); }}
          className={`h-12 w-full rounded-xl border bg-navy-800 px-3 text-base outline-none focus:border-accent ${error ? 'border-bad' : 'border-edge'}`} />
      </label>
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
      {(showMatches || showRecents) && (
        <ul id={listId} role="listbox" className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-edge-strong bg-navy-900 shadow-2xl">
          {showRecents && recents.map((code) => (
            <li key={code} role="option" aria-selected="false">
              <button type="button" onClick={() => pick(code)} className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left active:bg-navy-800">
                <History size={14} className="shrink-0 text-slate-500" />
                <span className="text-sm font-medium">{code}</span>
                <span className="text-xs text-slate-500">recent</span>
              </button>
            </li>
          ))}
          {showMatches && matches.map((a) => (
            <li key={a.ident} role="option" aria-selected="false">
              <button type="button" onClick={() => pick(a.icao || a.ident)} className="flex min-h-11 w-full flex-col items-start px-3 py-2 text-left active:bg-navy-800">
                <span className="text-sm font-medium">{a.icao || a.ident}{a.iata ? ` · ${a.iata}` : ''}</span>
                <span className="text-xs text-slate-400">{a.name}{a.city ? ` · ${a.city}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
