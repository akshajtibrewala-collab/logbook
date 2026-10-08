import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import Glass from './Glass.jsx';
import { IconButton } from './Controls.jsx';
import { useKeyboardInset } from './hooks.js';
import { noteActivity, scheduleSample } from './glass.js';
import { claimOverlay, swallowNextClick } from './overlayRegistry.js';

/**
 * Bottom sheet with a grabber and medium / large detents; drag the grabber or title to resize or dismiss. It is the one
 * overlay at a time (opening it closes a menu or popover). Focus moves in on open and back to the trigger on close; the
 * on-screen keyboard never covers a focused field (the sheet goes large and pads by the visualViewport inset).
 *   portal={false} keeps it inside a positioned parent (used by the /design device frames).
 */
export function Sheet({ open, onClose, title, detent = 'medium', onDetentChange, portal = true, demo = false, children }) {
  const el = useRef(null), restore = useRef(null);
  const closeRef = useRef(onClose); closeRef.current = onClose; // stable identity: an inline onClose must not re-claim the overlay slot every render
  const stableClose = useRef(() => closeRef.current()).current;
  const [d, setD] = useState(detent), drag = useRef(null);
  const kb = useKeyboardInset();
  const setDetent = useCallback((n) => { setD(n); onDetentChange?.(n); }, [onDetentChange]);
  useEffect(() => { setD(detent); }, [detent, open]);

  const metrics = useCallback(() => {
    const s = el.current; if (!s) return { large: 0, medium: 0, closed: 0 };
    const H = s.offsetHeight, vh = portal ? window.innerHeight : (s.offsetParent?.clientHeight || window.innerHeight);
    return { large: 0, medium: Math.max(0, H - vh * 0.5), closed: H + 24 };
  }, [portal]);

  useLayoutEffect(() => {
    const s = el.current; if (!s || drag.current) return;
    s.style.transform = `translateY(${metrics()[open ? d : 'closed']}px)`;
  }, [open, d, metrics, kb]);

  useEffect(() => {
    if (!open) return undefined;
    noteActivity(700);
    scheduleSample(); const t = setTimeout(scheduleSample, 520); // pick clear/scrim for what is behind the open sheet
    const release = demo ? () => {} : claimOverlay(stableClose);
    restore.current = demo ? null : document.activeElement;
    if (!demo) el.current?.focus({ preventScroll: true });
    const onKey = (e) => { if (e.key === 'Escape') stableClose(); };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); release(); document.removeEventListener('keydown', onKey); restore.current?.focus?.({ preventScroll: true }); };
  }, [open, stableClose, demo]);

  const down = (e) => {
    // A control inside the handle area (the Close X) must get its own click: pointer capture on the sheet would retarget it and the button would do nothing.
    if (!e.target.closest('[data-sheet-handle]') || e.target.closest('button, a, input, select, textarea, [role="button"]')) return;
    const m = metrics();
    drag.current = { y0: e.clientY, from: m[d], last: e.timeStamp, lastY: e.clientY, v: 0 };
    el.current.classList.add('is-drag'); el.current.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    const g = drag.current; if (!g) return;
    el.current.style.transform = `translateY(${Math.max(0, g.from + e.clientY - g.y0)}px)`;
    const dt = e.timeStamp - g.last; if (dt > 0) g.v = (e.clientY - g.lastY) / dt; g.last = e.timeStamp; g.lastY = e.clientY;
  };
  const up = (e) => {
    const g = drag.current; if (!g) return; drag.current = null;
    el.current.classList.remove('is-drag');
    const m = metrics(), cur = Math.max(0, g.from + e.clientY - g.y0) + g.v * 160;
    const best = ['large', 'medium', 'closed'].reduce((b, k) => (Math.abs(cur - m[k]) < Math.abs(cur - m[b]) ? k : b), 'large');
    if (best === 'closed') onClose(); else { el.current.style.transform = `translateY(${m[best]}px)`; setDetent(best); }
  };

  const node = (
    <>
      <div className={`ds-scrim-dim ${open ? 'is-on' : ''}`} onClick={onClose} aria-hidden="true" />
      <Glass ref={el} role="pop" className={`ds-sheet ds-chrome ${open ? 'is-open' : ''}`} tabIndex={-1} aria-hidden={!open}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onFocusCapture={(e) => { if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && d !== 'large') setDetent('large'); }}>
        <div role="dialog" aria-modal="true" aria-label={title} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="ds-grab" data-sheet-handle />
          <div className="ds-sheet-head" data-sheet-handle>
            <h2 className="ds-title">{title}</h2>
            <IconButton icon={X} label="Close" onClick={onClose} />
          </div>
          {/* At the medium detent only the top half of the sheet is on screen: cap the body there so the rest scrolls instead of hiding below the screen edge. */}
          <div className="ds-sheet-body" style={{ paddingBottom: `calc(var(--ds-bottom) + 6rem + ${kb}px)`, ...(portal && d === 'medium' ? { maxHeight: 'calc(50dvh - 4.75rem)' } : null) }}>{children}</div>
        </div>
      </Glass>
    </>
  );
  return portal ? createPortal(node, document.body) : node;
}

/**
 * Popover anchored to a control (row actions, filters): a glass menu that grows out of the control that opened it.
 * Counts as the one overlay at a time. `children` are the items (use className="mi" buttons).
 */
export function Popover({ open, onClose, anchorRef, width = 240, children }) {
  const el = useRef(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const stableClose = useRef(() => closeRef.current()).current;
  useLayoutEffect(() => {
    const p = el.current, a = anchorRef?.current; if (!open || !p || !a) return;
    const r = a.getBoundingClientRect(), pad = 12, h = p.offsetHeight;
    const left = Math.min(Math.max(pad, r.right - width), window.innerWidth - width - pad);
    const below = r.bottom + 8 + h < window.innerHeight - pad;
    p.style.left = `${left}px`; p.style.top = `${below ? r.bottom + 8 : Math.max(pad, r.top - 8 - h)}px`;
    p.style.transformOrigin = `${r.left + r.width / 2 - left}px ${below ? '0' : '100%'}`;
  }, [open, anchorRef, width]);
  useEffect(() => {
    if (!open) return undefined;
    noteActivity(500);
    scheduleSample(); const t = setTimeout(scheduleSample, 380);
    const release = claimOverlay(stableClose);
    const onKey = (e) => { if (e.key === 'Escape') stableClose(); };
    const onDown = (e) => { if (!el.current?.contains(e.target) && !anchorRef?.current?.contains(e.target)) { swallowNextClick(); stableClose(); } };
    document.addEventListener('keydown', onKey); document.addEventListener('pointerdown', onDown);
    return () => { clearTimeout(t); release(); document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [open, stableClose, anchorRef]);
  return createPortal(
    <Glass ref={el} role="pop" className={`ds-menu ds-popover ds-chrome ${open ? 'is-open' : ''}`} style={{ width, right: 'auto', bottom: 'auto' }} aria-hidden={!open}>
      <div role="menu">{children}</div>
    </Glass>, document.body);
}
