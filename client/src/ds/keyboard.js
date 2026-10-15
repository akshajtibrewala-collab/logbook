// Browser side of the keyboard state (pure rules: lib/keyboardState.js). While a text field has focus, <html> carries `kb-open`
// (ds/keyboard.css turns every backdrop-filter off, stops transitions on the fixed layers, hides the tab bar and Add button), the
// glass sampler and the scroll-linked collapse handlers pause (they read isKeyboardOpen()), and --kb-inset holds the covered height.
// installKeyboardState() is idempotent: one controller serves the whole page lifetime.
import { createKeyboardController, TEXT_ENTRY_SELECTOR } from '../lib/keyboardState.js';
import { keyboardInset } from '../lib/scrollstate.js';
import { KB_CLASS } from './kbFlag.js';
import { scheduleSample } from './glass.js';

let controller = null;
const dbg = () => (window.__aeroKb ||= { active: false, transitions: 0, lastEvent: 'none', lastAt: 0, lastTarget: '', inset: 0 });

const isText = (el) => Boolean(el && el.matches?.(TEXT_ENTRY_SELECTOR));
const desc = (el) => (el ? `${el.tagName?.toLowerCase() || '?'}${el.type ? `[${el.type}]` : ''}${el.name ? `#${el.name}` : el.id ? `#${el.id}` : ''}` : 'none');

function inset() {
  const vv = window.visualViewport;
  if (!vv) return 0;
  return keyboardInset({ innerHeight: window.innerHeight, vvHeight: vv.height, vvOffsetTop: vv.offsetTop, vvScale: vv.scale, textFocused: isText(document.activeElement) });
}

function apply(active) {
  const root = document.documentElement;
  root.classList.toggle(KB_CLASS, active);
  // The legacy attribute (the Save bar and the debug panel used to read it) stays in step so nothing sees a stale value.
  root.toggleAttribute('data-kb', active);
  if (!active) {
    root.style.removeProperty('--kb-inset');
    // Everything that paused while the keyboard was up looks at the page once more: the tint sampler, the collapse and title handlers.
    requestAnimationFrame(() => { scheduleSample(); window.dispatchEvent(new Event('scroll')); });
  }
  const d = dbg(); d.active = active; d.transitions += 1;
}

function note(type, el) { const d = dbg(); d.lastEvent = type; d.lastAt = Math.round(performance.now()); d.lastTarget = desc(el); }

export function installKeyboardState() {
  if (controller || typeof document === 'undefined') return controller;
  controller = createKeyboardController({
    now: () => performance.now(),
    isTextActive: () => isText(document.activeElement),
    onChange: apply,
  });
  const send = (e) => { note(e.type, e.el); controller.send(e); };
  const refreshInset = () => {
    if (!controller.active) return;
    const v = inset(); document.documentElement.style.setProperty('--kb-inset', `${v}px`); dbg().inset = v;
  };

  document.addEventListener('focusin', (e) => { send({ type: 'focusin', text: isText(e.target), el: e.target }); refreshInset(); }, true);
  document.addEventListener('focusout', (e) => send({ type: 'focusout', el: e.target }), true);
  // iOS keeps focus when the keyboard is dismissed with its own key, and tapping the same field again fires no focusin: a pointer
  // released on a text field re-opens the state, one released anywhere else lets it go.
  document.addEventListener('pointerup', (e) => {
    const t = e.target;
    if (isText(t)) { send({ type: 'focusin', text: true, el: t }); return; }
    if (controller.active && !t.closest?.('label')) send({ type: 'pointerOutside', el: t });
  }, true);
  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener('resize', () => {
      const full = window.innerHeight - vv.height - Math.max(0, vv.offsetTop) < 80 && vv.scale <= 1.01;
      if (full) send({ type: 'viewportFull' }); else refreshInset();
    });
  }
  window.addEventListener('pagehide', () => send({ type: 'pagehide' }));
  document.addEventListener('visibilitychange', () => { if (document.hidden) send({ type: 'hidden' }); });
  // Already focused when installed (a reload that restored focus, a hot update): adopt it.
  if (isText(document.activeElement)) { send({ type: 'focusin', text: true, el: document.activeElement }); refreshInset(); }
  return controller;
}

/** Tell the state a route changed or a sheet closed (AppShell, Overlays): both clear it at once. */
export const keyboardEvent = (type) => { if (controller) { note(type, null); controller.send({ type }); } };
export const keyboardSnapshot = () => ({ ...dbg(), active: Boolean(controller?.active) });
