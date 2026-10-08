import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const WIDE = '(min-width: 768px)';

/** True from 768px up (re-evaluated when the window resizes), so a collapsed card's controls are not in the page at all on a phone. */
function useWide() {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(WIDE).matches : true);
  const [wide, setWide] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(WIDE); const on = () => setWide(mq.matches);
    mq.addEventListener('change', on); on();
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

/**
 * A titled Stats section that collapses on a phone (below 768px) so a long scroll can be scanned by heading; always open from `md` up.
 * A closed card does not render its body, so its controls (a goal button, a type or tail toggle) are never present as zero-size or untappable elements.
 */
export default function CollapsibleStatCard({ title, note, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const wide = useWide();
  const shown = open || wide;
  return (
    <section className={`bc-sec${shown ? ' open' : ''}`}>
      {wide
        ? <div className="hd"><span><h2>{title}</h2>{note && <p className="mut">{note}</p>}</span></div>
        : (
          <button type="button" className="hd bc-hd" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`${title}${open ? ', open' : ', closed'}`}>
            <span><h2>{title}</h2>{open && note && <p className="mut">{note}</p>}</span>
            <ChevronDown aria-hidden="true" />
          </button>
        )}
      {shown && <div className="body">{children}</div>}
    </section>
  );
}
