// The row-to-detail View Transition: the row's hours numeral grows into the detail's big numeral. Only where the browser supports it and the person has
// not asked for reduced motion; everywhere else the navigation is an ordinary one with no animation. Pure helpers: the DOM calls are passed in.

/** True when a View Transition may run (the API exists, motion is allowed). */
export function canTransition(doc = typeof document !== 'undefined' ? document : null, win = typeof window !== 'undefined' ? window : null) {
  if (!doc || typeof doc.startViewTransition !== 'function' || !win) return false;
  return !(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/** A plain left click (not a modified one, not a new-tab or download intent). */
export const isPlainClick = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented;

/**
 * Runs `update` (the navigation) inside a View Transition that names `el` as the shared element. The name is removed again inside the update, before the new
 * state is captured, so the new page's own element can carry it (two elements must never share a name). Returns false when it did not run a transition.
 */
export function transitionTo(el, name, update, doc = document, win = window) {
  if (!canTransition(doc, win)) return false;
  if (el) el.style.viewTransitionName = name;
  doc.startViewTransition(() => { if (el) el.style.viewTransitionName = ''; update(); });
  return true;
}
