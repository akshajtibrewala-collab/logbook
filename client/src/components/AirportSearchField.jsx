import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';

// A text field that also offers autocomplete matches (via /api/airports/search) as you type, but never
// requires picking one — typing a code directly and moving on works too, same as every other airport
// field in this app.
export default function AirportSearchField({ label, value, onChange, placeholder = 'KPAO' }) {
  const [query, setQuery] = useState(value ?? '');
  const [matches, setMatches] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => setQuery(value ?? ''), [value]);

  useEffect(() => {
    if (query.trim().length < 2) { setMatches([]); return undefined; }
    const timer = setTimeout(() => {
      api.searchAirports(query.trim()).then(setMatches).catch(() => setMatches([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onClickAway = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  function pick(airport) {
    onChange(airport.ident);
    setQuery(airport.ident);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <label className="block">
        {label && <span className="mb-1 block text-xs text-slate-400">{label}</span>}
        <input value={query} placeholder={placeholder} onFocus={() => setOpen(true)}
          onChange={(e) => { const v = e.target.value.toUpperCase(); setQuery(v); onChange(v); setOpen(true); }}
          className="h-12 w-full rounded-xl border border-edge bg-navy-800 px-3 text-base outline-none focus:border-accent" />
      </label>
      {open && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-edge-strong bg-navy-900 shadow-2xl">
          {matches.map((a) => (
            <li key={a.ident}>
              <button type="button" onClick={() => pick(a)} className="flex w-full flex-col items-start px-3 py-2 text-left active:bg-navy-800">
                <span className="text-sm font-medium">{a.ident}</span>
                <span className="text-xs text-slate-400">{a.name}{a.city ? ` · ${a.city}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
