// The "keyboard open" state machine, pure so it is unit tested. The browser wiring is client/src/ds/keyboard.js.
//
// Why it exists: on iOS Safari, focusing a text field makes the visual viewport resize and pan while every position:fixed element
// that carries a backdrop-filter (the top bar, the tab bar, the Save bar, a sheet) is re-rasterised each frame, and the glass sampler,
// the scroll-linked collapse handlers and CSS transitions all fire at the same time. The page flashes. While a text field has focus the
// app therefore drops to a calm, solid frame (class `kb-open` on <html>, see ds/keyboard.css) and restores it when the field is done.
//
// The state must never get stuck: it clears on blur (debounced, so moving from one field to the next does not flicker), when the
// visual viewport returns to full height, on a tap outside a field, on a route change, when a sheet closes, on pagehide/hidden, and a
// periodic tick compares it with the truth (is a text field actually the active element?) and has a hard age cap.

export const DEBOUNCE_MS = 150;   // focusout -> clear, so a field-to-field move (focusout, then focusin) never drops the state
export const GRACE_MS = 600;      // a visual-viewport "full height" event this soon after a focus is the keyboard still rising, not closing
export const MAX_ACTIVE_MS = 10 * 60 * 1000; // hard cap: nobody types in one field for ten minutes without any event
export const TICK_MS = 1000;      // how often the DOM is compared with the state while it is active

/** The element selector for "this opens the on-screen keyboard". */
export const TEXT_ENTRY_SELECTOR = 'input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="reset"], [type="file"], [type="range"], [type="color"], [type="image"], [type="hidden"]), textarea, select, [contenteditable=""], [contenteditable="true"]';

export const initialKeyboardState = Object.freeze({ active: false, since: 0, textAt: 0, clearAt: 0, lastType: 'none', lastAt: 0, transitions: 0 });

const stamp = (s, e) => ({ ...s, lastType: e.type, lastAt: e.at });
const off = (s, e) => (s.active ? { ...stamp(s, e), active: false, clearAt: 0, since: 0, transitions: s.transitions + 1 } : { ...stamp(s, e), clearAt: 0 });
const SOON = new Set(['route', 'sheetClose', 'pagehide', 'hidden']);

/**
 * step(state, event, options) -> next state. Events: { type, at, ... }
 *   focusin       { text }            a text-entry field gained focus (text: true) or something else did
 *   focusout      {}                  focus left an element
 *   pointerOutside {}                 a pointer was released away from the focused field
 *   viewportFull  {}                  the visual viewport is (again) full height
 *   route | sheetClose | pagehide | hidden   clear at once
 *   tick          { activeIsText }    periodic reality check
 */
export function step(state, event, { debounceMs = DEBOUNCE_MS, graceMs = GRACE_MS, maxMs = MAX_ACTIVE_MS } = {}) {
  const { type, at } = event;
  if (type === 'focusin') {
    if (event.text) return { ...stamp(state, event), active: true, since: state.active ? state.since : at, textAt: at, clearAt: 0, transitions: state.active ? state.transitions : state.transitions + 1 };
    return state.active ? { ...stamp(state, event), clearAt: at + debounceMs } : stamp(state, event);
  }
  if (type === 'focusout' || type === 'pointerOutside') return state.active ? { ...stamp(state, event), clearAt: at + debounceMs } : stamp(state, event);
  if (type === 'viewportFull') {
    if (!state.active || at - state.textAt < graceMs) return state;
    return off(state, event);
  }
  if (SOON.has(type)) return off(state, event);
  if (type === 'tick') {
    if (!state.active) return state;
    if (state.clearAt && at >= state.clearAt) return off(state, { type: 'tick', at });
    if (!event.activeIsText) return off(state, { type: 'tick', at });
    if (at - state.since > maxMs) return off(state, { type: 'tick', at });
    return state;
  }
  return state;
}

/** Whether the pending debounced clear is due (the controller schedules one timer per `clearAt`). */
export const clearDue = (state, at) => state.active && state.clearAt > 0 && at >= state.clearAt;

/**
 * A small controller around step(): owns the state, calls onChange(active, state) only when `active` flips, and keeps its timers
 * through injected setTimer/clearTimer so tests run without real time. `isTextActive()` is the reality check used by tick().
 */
export function createKeyboardController({ now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout, isTextActive = () => false, onChange = () => {}, options } = {}) {
  let state = initialKeyboardState, timer = null;
  const arm = () => {
    if (timer != null) { clearTimer(timer); timer = null; }
    if (!state.active) return;
    const wait = state.clearAt ? Math.max(0, state.clearAt - now()) : TICK_MS;
    timer = setTimer(() => { timer = null; send({ type: 'tick', activeIsText: isTextActive() }); }, Math.min(wait, TICK_MS));
  };
  const send = (event) => {
    const prev = state;
    state = step(state, { at: now(), ...event }, options);
    if (state.active !== prev.active) onChange(state.active, state);
    arm();
    return state;
  };
  return { send, get state() { return state; }, get active() { return state.active; }, dispose() { if (timer != null) clearTimer(timer); timer = null; } };
}
