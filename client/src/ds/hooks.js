// React hooks for the glass shell. Scroll-driven visuals write CSS variables / classes directly instead of
// re-rendering, so scrolling never triggers React work.
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getGlass, subscribeGlass, trackGlass, initGlass } from './glass.js';
import { clampScroll, nextCollapse, titleProgress, keyboardInset, needsViewportSettle } from '../lib/scrollstate.js';
import { isNarrowForRem } from '../lib/layoutmode.js';
import { isKeyboardOpen } from './kbFlag.js';

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
      if (isKeyboardOpen()) return; // paused while the on-screen keyboard is up (ds/keyboard.js)
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
      const bar = barRef.current, title = titleRef.current; if (!bar || isKeyboardOpen()) return; // paused while the keyboard is up
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

/**
 * Puts the visual viewport back when it is stuck (see needsViewportSettle): after a text field loses focus, when the visual viewport
 * resizes or scrolls, and on a route change, it waits for the page to settle and then, only if the viewport is still off with no field
 * focused and no zoom, scrolls to the position it is already at (a no-op for the page; it makes Safari recompute the fixed bars' anchor).
 * Counts its corrections on window.__aeroSettles for the ?debug=1 panel.
 */
export function useViewportSettle(routeKey) {
  useEffect(() => {
    const vv = window.visualViewport; if (!vv) return undefined;
    let timer = 0;
    const textFocused = () => { const a = document.activeElement; return Boolean(a && a.matches?.('input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="file"], [type="range"]), textarea, select, [contenteditable="true"]')); };
    const check = () => {
      if (isKeyboardOpen() || !needsViewportSettle({ innerHeight: window.innerHeight, vvHeight: vv.height, vvOffsetTop: vv.offsetTop, vvScale: vv.scale, textFocused: textFocused() })) return;
      window.scrollTo(window.scrollX, window.scrollY);
      window.__aeroSettles = (window.__aeroSettles || 0) + 1;
    };
    const later = () => { clearTimeout(timer); timer = setTimeout(check, 260); };
    vv.addEventListener('resize', later); vv.addEventListener('scroll', later); document.addEventListener('focusout', later);
    later();
    return () => { clearTimeout(timer); vv.removeEventListener('resize', later); vv.removeEventListener('scroll', later); document.removeEventListener('focusout', later); };
  }, [routeKey]);
}

/**
 * Sets data-narrow-text on <html> while the layout width, measured in the current root font size, is below the wide layout's width (see
 * lib/layoutmode.js). CSS then keeps pages in one column even where a media query says "wide". Re-evaluated on resize, orientation,
 * focus and visibility changes (a text-size setting changes outside the page, so a periodic check covers the rest).
 */
export function useTextScaleLayout() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const px = parseFloat(getComputedStyle(root).fontSize);
      const narrow = isNarrowForRem(window.innerWidth, px);
      if (narrow !== root.hasAttribute('data-narrow-text')) root.toggleAttribute('data-narrow-text', narrow);
    };
    apply();
    // A 1rem-wide probe: its width changes the moment the root font size does (a text-size setting, page zoom), which fires no resize event.
    const probe = document.createElement('i');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1rem;height:1px;visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(apply) : null;
    ro?.observe(probe);
    window.addEventListener('resize', apply); window.addEventListener('orientationchange', apply);
    window.addEventListener('focus', apply); document.addEventListener('visibilitychange', apply);
    const iv = setInterval(apply, 3000);
    return () => { clearInterval(iv); ro?.disconnect(); probe.remove(); window.removeEventListener('resize', apply); window.removeEventListener('orientationchange', apply); window.removeEventListener('focus', apply); document.removeEventListener('visibilitychange', apply); root.removeAttribute('data-narrow-text'); };
  }, []);
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
