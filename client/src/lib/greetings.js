// Rotating Dashboard greeting headlines. Purely data — edit or add to these lists freely, no code changes
// needed. `{name}` is replaced with PILOT_NAME (or whatever name the caller passes) when a headline is
// picked. The selection logic that reads this lives in ./greeting.js.
//
// `morning` / `afternoon` / `evening` / `lateNight` only come up during their part of the day; `anytime`
// is always in the running alongside whichever of those matches right now.

export const PILOT_NAME = 'Akshaj';

export const HEADLINES = {
  morning: [
    'Morning, {name}. Ready for preflight?',
    'Rise and climb, {name}',
    'Early departure today, {name}?',
    'Good morning, {name}',
    'Morning, {name}. Checklist’s waiting.',
    'Morning, {name}. Clear for taxi?',
    'Top of the morning, {name} — where to today?',
    'Morning, {name}. Let’s get some hours in.',
    'Good morning, {name}. Runway’s calling.',
  ],
  afternoon: [
    'Good afternoon, {name}',
    'Cleared for the afternoon, {name}',
    'Back on the flight deck, {name}?',
    'Afternoon, {name}. Midday hours?',
    'Good afternoon, {name}. Still climbing?',
    'Afternoon, {name}. How’s the day tracking?',
    'Afternoon, {name} — logbook’s open.',
    'Good afternoon, {name}. Ready for round two?',
    'Afternoon, {name}. Let’s keep the hours moving.',
  ],
  evening: [
    'Good evening, {name}',
    'Evening, {name}. How’d today’s flight go?',
    'Wheels down for the day, {name}?',
    'Evening, {name}. Time to log it.',
    'Good evening, {name}. Debrief time?',
    'Evening, {name} — how was the flying?',
    'Evening, {name}. Hangar’s quiet now.',
    'Good evening, {name}. Another day closer to current.',
    'Evening, {name}. Ready to wrap up?',
  ],
  lateNight: [
    'Night ops, {name}?',
    'Burning the midnight oil, {name}?',
    'Late one tonight, {name}?',
    'Still up, {name}? Night currency counts too.',
    'Night ops, {name}. Everything logged?',
    '{name}, flying the red-eye tonight?',
    'Quiet skies tonight, {name}.',
    'Late night, {name}. Catching up on the logbook?',
  ],
  anytime: [
    'Welcome back, {name}',
    'Where to next, {name}?',
    'Ready for departure, {name}?',
    'Good to see you, {name}',
    '{name}, logbook’s open.',
    'Welcome aboard, {name}',
    'Hey {name} — let’s check your numbers.',
    '{name}, what’s the plan today?',
    'Welcome back to the flight deck, {name}',
  ],
};
