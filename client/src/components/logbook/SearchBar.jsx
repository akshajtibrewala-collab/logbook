import { useEffect, useRef, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';

/** The placeholder, or its first word when the full text would be clipped (very narrow screens at large text sizes). */
function useFittingPlaceholder(ref, full) {
  const [text, setText] = useState(full);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const fit = () => {
      const cs = getComputedStyle(el), c = document.createElement('canvas').getContext('2d');
      c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const room = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      setText(c.measureText(full).width <= room ? full : full.split(' ')[0]);
    };
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null; ro?.observe(el);
    return () => ro?.disconnect();
  }, [ref, full]);
  return text;
}

/** The search field alone (calm layout: opened from the search icon). Same matching and placeholder fitting as the bar. */
export function SearchField({ query, onQuery, placeholder = 'Search flights', label = 'Search', autoFocus }) {
  const input = useRef(null);
  const shown = useFittingPlaceholder(input, placeholder);
  return (
    <label className="cl-search">
      <Search aria-hidden="true" />
      <input ref={input} type="search" className="gl-field" value={query} onChange={(e) => onQuery(e.target.value)} placeholder={shown} aria-label={label} title={label} enterKeyHint="search" autoComplete="off" autoFocus={autoFocus} />
      {query && <button type="button" className="gl plain icon sm clear" aria-label="Clear search" onClick={() => onQuery('')}><X aria-hidden="true" /></button>}
    </label>
  );
}

/** One compact bar: a search field and a Filter button (pressed while any filter is active). */
export default function SearchBar({ query, onQuery, placeholder = 'Search flights', label = 'Search', onFilter, activeCount, pax }) {
  const input = useRef(null);
  const shown = useFittingPlaceholder(input, placeholder);
  return (
    <div className="lb-bar">
      <label className="lb-search">
        <Search aria-hidden="true" />
        <input ref={input} type="search" className="gl-field" value={query} onChange={(e) => onQuery(e.target.value)} placeholder={shown} aria-label={label} title={label} enterKeyHint="search" autoComplete="off" />
        {query && <button type="button" className="gl plain icon sm clear" aria-label="Clear search" onClick={() => onQuery('')}><X aria-hidden="true" /></button>}
      </label>
      <button type="button" className={`gl clear gl-chip ${pax ? 'pax' : ''}`} aria-pressed={activeCount > 0} onClick={onFilter}>
        <SlidersHorizontal aria-hidden="true" />Filter{activeCount ? ` · ${activeCount}` : ''}
      </button>
    </div>
  );
}

/** Removable chips for the active filters. */
export function FilterChips({ chips, onRemove, pax }) {
  if (!chips.length) return null;
  return (
    <div className="lb-chips" role="list" aria-label="Active filters">
      {chips.map((c) => (
        <button key={c.key} type="button" role="listitem" className={`gl clear gl-chip ${pax ? 'pax' : ''}`} aria-pressed="true" aria-label={`Remove filter ${c.label}`} onClick={() => onRemove(c.key)}>{c.label}<X aria-hidden="true" /></button>
      ))}
    </div>
  );
}
