import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, DollarSign, MoreHorizontal, PlaneTakeoff, Share2 } from 'lucide-react';
import { IconButton } from '../ds/Controls.jsx';
import { Popover } from '../ds/Overlays.jsx';

// The "…" menu in the top bar of the Flying pages: every destination that used to be one of the four header icons.
const ITEMS = [
  { to: '/logbook/share', label: 'Share and print', icon: Share2 },
  { to: '/costs', label: 'Costs', icon: DollarSign },
  { to: '/aircraft', label: 'Aircraft', icon: PlaneTakeoff },
  { to: '/logbook/data', label: 'Import and export', icon: ArrowLeftRight },
];

export default function FlyingMenu() {
  const [open, setOpen] = useState(false);
  const anchor = useRef(null);
  return (
    <>
      <IconButton ref={anchor} icon={MoreHorizontal} label="More actions" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} />
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} width={240}>
        {ITEMS.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} role="menuitem" className="mi" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}><Icon className="ds-i" aria-hidden="true" />{label}</Link>
        ))}
      </Popover>
    </>
  );
}
