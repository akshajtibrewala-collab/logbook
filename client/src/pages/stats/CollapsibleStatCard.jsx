import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Card from '../../components/Card.jsx';

/**
 * A titled Stats card that collapses on phone (below the `md` breakpoint) so a long scroll of cards can be
 * scanned by heading first; always fully expanded at `md` and up, regardless of `open` state.
 */
export default function CollapsibleStatCard({ title, note, icon: Icon, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card as="section" className="card-elevated">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="pressable flex w-full items-start justify-between gap-3 text-left">
        <span className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-navy-800 text-slate-300">
              <Icon size={16} strokeWidth={2} />
            </span>
          )}
          <span className="min-w-0">
            <h2 className="stat-title text-[0.95rem]">{title}</h2>
            {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
          </span>
        </span>
        <ChevronDown size={18} className={`mt-2 shrink-0 text-slate-500 transition-transform md:hidden ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`${open ? 'block' : 'hidden'} md:block mt-3.5`}>{children}</div>
    </Card>
  );
}
