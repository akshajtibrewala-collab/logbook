import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/** A collapsible card section — used for fields that matter sometimes but shouldn't crowd the common case. */
export default function Disclosure({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="card p-4">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-sm font-medium text-accent">
        {title}
        <ChevronDown size={18} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="mt-3 grid grid-cols-2 gap-3">{children}</div>}
    </section>
  );
}
