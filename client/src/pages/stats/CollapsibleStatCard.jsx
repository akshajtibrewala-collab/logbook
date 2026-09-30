import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Card from '../../components/Card.jsx';

/**
 * A titled Stats card that collapses on phone (below the `md` breakpoint) so a long scroll of cards can be
 * scanned by heading first; always fully expanded at `md` and up, regardless of `open` state.
 */
export default function CollapsibleStatCard({ title, note, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card as="section">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 text-left">
        <span className="min-w-0">
          <h2 className="text-sm font-medium text-slate-300">{title}</h2>
          {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
        </span>
        <ChevronDown size={18} className={`mt-0.5 shrink-0 text-slate-500 transition-transform md:hidden ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`${open ? 'block' : 'hidden'} md:block mt-3`}>{children}</div>
    </Card>
  );
}
