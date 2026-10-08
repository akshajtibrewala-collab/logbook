// Layer budget: at most one popover/menu/sheet is open at a time (the tab bar and top bar are the other two glass
// layers). Opening an overlay closes the previous one. Each overlay calls claim(close) when it opens and the returned
// release when it closes.
//
// Every open overlay also owns one history entry, so the browser Back button (or the phone's back swipe) closes the
// overlay instead of leaving the page. Closing any other way (X, Escape, scrim, a choice) drops that entry again.
let active = null;
let ignorePops = 0; // popstate events caused by our own history.back(), which must not close the next overlay
let listening = false;

const ourEntry = () => Boolean(window.history.state && window.history.state.__overlay);

// One listener for the whole app, so an event caused by our own history.back() is always counted off, whoever is (or is not) open.
function onPop() {
  if (ignorePops > 0) { ignorePops -= 1; return; }
  if (active) { active.popped = true; active.close(); }
}

export function claimOverlay(close) {
  if (!listening && typeof window !== 'undefined') { window.addEventListener('popstate', onPop); listening = true; }
  // Replacing one overlay with another hands the history entry over instead of stacking a second one.
  let inherited = false;
  if (active && active.close !== close) {
    const prev = active;
    if (prev.entry && ourEntry()) { prev.entry = false; inherited = true; }
    prev.close();
  }
  const mine = { close, popped: false, entry: inherited };
  active = mine;
  if (!inherited) {
    try {
      window.history.pushState({ ...(window.history.state || {}), __overlay: true }, '');
      mine.entry = true;
    } catch { /* no history API: the overlay still closes every other way */ }
  }
  return () => {
    if (active === mine) active = null;
    // Closed some other way than Back: remove our entry, unless the person has since navigated onward (then it is no longer the current entry).
    if (mine.entry && !mine.popped && ourEntry()) { ignorePops += 1; window.history.back(); }
  };
}

/**
 * A tap outside an open menu or popover only dismisses it: the click that follows the same tap is swallowed once, so it cannot also open
 * whatever is underneath (the Flying switcher in the top bar, another menu). Removed after 500 ms if no click arrives (a touch drag, a keyboard close).
 */
export function swallowNextClick() {
  if (typeof document === 'undefined') return;
  let t = 0;
  const stop = (e) => { e.stopPropagation(); e.preventDefault(); done(); };
  const done = () => { document.removeEventListener('click', stop, true); clearTimeout(t); };
  document.addEventListener('click', stop, true);
  t = setTimeout(done, 500);
}
