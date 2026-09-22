// Rotating Dashboard greeting headlines. Purely data — edit or add to these lists freely, no code changes
// needed. `{name}` is replaced with PILOT_NAME (or whatever name the caller passes) when a headline is
// picked. The selection logic that reads this lives in ./greeting.js.
//
// `morning` / `afternoon` / `evening` / `lateNight` only come up during their part of the day; `anytime`
// is always in the running alongside whichever of those matches right now.
//
// Keep every headline at MAX_HEADLINE_LENGTH characters or fewer once {name} is filled in — that's what
// keeps it to one line on a ~360px phone at the Dashboard's font size. greeting.test.js fails the build
// if any entry here goes over, so a new addition that's too long gets caught immediately.

export const PILOT_NAME = 'Akshaj';
export const MAX_HEADLINE_LENGTH = 22;

export const HEADLINES = {
  morning: [
    'Morning, {name}',
    'Good morning, {name}',
    'Rise and climb, {name}',
    'Ready to fly, {name}?',
    'Clear to climb, {name}',
    'Wheels up, {name}?',
    'Early bird, {name}?',
    'Preflight time, {name}',
    'Checklist time, {name}',
  ],
  afternoon: [
    'Good afternoon, {name}',
    'Afternoon, {name}',
    'Back at it, {name}?',
    'Midday hours, {name}?',
    'Flying today, {name}?',
    'Logbook open, {name}',
    'Cleared, {name}',
    'Climbing, {name}?',
    'Round two, {name}?',
  ],
  evening: [
    'Good evening, {name}',
    'Evening, {name}',
    'Wheels down, {name}?',
    'Debrief time, {name}',
    "How'd it go, {name}?",
    "Day's done, {name}?",
    'Hangar time, {name}',
    'Log it, {name}?',
    'Ready to log, {name}?',
  ],
  lateNight: [
    'Night ops, {name}?',
    'Still up, {name}?',
    'Late night, {name}',
    'Red-eye, {name}?',
    'Midnight oil, {name}?',
    'Night owl, {name}?',
    'Quiet skies, {name}',
    'Burning oil, {name}?',
  ],
  anytime: [
    'Welcome back, {name}',
    'Hey {name}',
    'Where to, {name}?',
    '{name}, welcome',
    'Welcome aboard, {name}',
    'Ready, {name}?',
    "Logbook's open, {name}",
    'Hey there, {name}',
    '{name}, ready?',
  ],
};
