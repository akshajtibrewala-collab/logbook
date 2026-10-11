// React hooks for the glass shell. Scroll-driven visuals write CSS variables / classes directly instead of
// re-rendering, so scrolling never triggers React work.
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getGlass, subscribeGlass, trackGlass, initGlass } from './glass.js';
import { clampScroll, nextCollapse, titleProgress, keyboardInset } from '../lib/scrollstate.js';

export const useGlass = () => { initGlass(); return useSyncExternalStore(subscribeGlass, getGlass, getGlass); };

/** Registers a glass element with the adaptive-tint sampler. */
export function useGlassTint(ref) {
  useEffect(() => { initGlass(); return ref.current ? trackGlass(ref.current) : undefined; }, [ref]);
}

const scrollerOf = (ref) => ref?.current || window;
const scrollTopOf = (s) => (s === window ? window.scrollY : s.scrollTop);
/** Furthest the scroller can go: iOS reports positions outside [0, max] while it rubber-bands, so every reader clamps against this. */
export const maxScrollOf = (s) => (s === window ? document.documentElement.scrollHeight - window.innerHeight : s.scrollHeight - s.clientHeight);

/** True while the user has scrolled down (past `minY`), false as soon as they scroll up. Drives the collapsing tab bar. */
export function useCollapseOnScroll(scrollRef, { threshold = 10, minY = 80 } = {}) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const s = scrollerOf(scrollRef);
    let st = { collapsed: false, last: clampScroll(scrollTopOf(s), maxScrollOf(s)) };
    const on = () => {
      const n = nextCollapse(st, scrollTopOf(s), maxScrollOf(s), { threshold, minY });
      if (n === st) return;
      st = n; setCollapsed((c) => (c === n.collapsed ? c : n.collapsed));
    };
    s.addEventListener('scroll', on, { passive: true });
    return () => s.removeEventListener('scroll', on);
  }, [scrollRef, threshold, minY]);
  return collapsed;
}

/**
 * The large title collapses into the glass bar: writes --p (0..1) on the bar as the title scrolls beneath it.
 * `titleRef` is the large title element, `barRef` the glass top bar.
 */
export function useCollapsingTitle(scrollRef, barRef, titleRef, routeKey) {
  useEffect(() => {
    const s = scrollerOf(scrollRef);
    const update = () => {
      const bar = barRef.current, title = titleRef.current; if (!bar) return;
      if (!title) { bar.style.setProperty('--p', '1'); return; } // a page without a large title: the bar always shows its title
      const gap = title.getBoundingClientRect().bottom - bar.getBoundingClientRect().bottom; // >0: title still below the bar
      bar.style.setProperty('--p', String(titleProgress(gap)));
    };
    update();
    s.addEventListener('scroll', update, { passive: true }); window.addEventListener('resize', update);
    return () => { s.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [scrollRef, barRef, titleRef, routeKey]);
}

/** Keeps `value` in sync with the on-screen keyboard: returns the covered height (px) from visualViewport. */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport; if (!vv) return undefined;
    const textFocused = () => { const a = document.activeElement; return Boolean(a && a.matches?.('input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="file"], [type="range"]), textarea, select, [contenteditable="true"]')); };
    // Only a focused text field, an unzoomed page and a keyboard-sized gap count (lib/scrollstate.js): pinch-zoom and the iOS rubber-band must never read as a keyboard.
    const on = () => setInset(keyboardInset({ innerHeight: window.innerHeight, vvHeight: vv.height, vvOffsetTop: vv.offsetTop, vvScale: vv.scale, textFocused: textFocused() }));
    on(); vv.addEventListener('resize', on); vv.addEventListener('scroll', on);
    document.addEventListener('focusin', on); document.addEventListener('focusout', on);
    return () => { vv.removeEventListener('resize', on); vv.removeEventListener('scroll', on); document.removeEventListener('focusin', on); document.removeEventListener('focusout', on); };
  }, []);
  return inset;
}

export const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Runs `change` inside a View Transition when supported (and motion allowed), so the named elements morph. */
export function morph(change, { names = [] } = {}) {
  if (!document.startViewTransition || prefersReducedMotion()) { change(); return; }
  document.documentElement.classList.add('ds-vt');
  const t = document.startViewTransition(change);
  t.ready.catch(() => {});
  t.finished.catch(() => {}).then(() => { document.documentElement.classList.remove('ds-vt'); names.forEach((n) => n?.style?.removeProperty('view-transition-name')); });
}

export { useLayoutEffect, useRef };
