import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';

/**
 * The floating "+" button for phones. Three things keep it from covering content:
 *  1. It renders a `.fab-clearance` spacer after the page content, so the last row can always scroll
 *     fully clear of it (button height + gap + safe-area inset — see index.css).
 *  2. It slides away while scrolling down and comes back on scroll up (or at the very top).
 *  3. From `md` up it is not rendered at all: the primary action lives in the page header there.
 * Place it as the last child of the page.
 */
export default function AddFab({ onClick, label }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    // Cheap enough to run on every scroll event (React skips the re-render when the value is unchanged).
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      if (y < 80) setHidden(false);
      else if (delta > 8) setHidden(true);
      else if (delta < -8) setHidden(false);
      if (Math.abs(delta) > 8) lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <div aria-hidden="true" className="fab-clearance md:hidden" />
      <button type="button" onClick={onClick} aria-label={label} data-hidden={hidden}
        style={{ bottom: 'calc(var(--bottom-nav-h) + 1rem)' }}
        className="fab fixed right-5 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-ink shadow-lg shadow-accent/30 active:scale-95 active:bg-accent-dark md:hidden">
        <Plus size={28} strokeWidth={2.25} />
      </button>
    </>
  );
}
