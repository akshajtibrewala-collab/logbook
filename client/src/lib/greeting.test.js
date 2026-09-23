import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeBucket, candidateHeadlines, pickHeadline, pickSubline, SUBLINE_MAX_LENGTH } from './greeting.js';
import { HEADLINES, PILOT_NAME, MAX_HEADLINE_LENGTH } from './greetings.js';

const at = (h, m = 0) => new Date(2026, 8, 21, h, m);

test('timeBucket switches at 5:00, 12:00, 17:00 and 22:00 local time', () => {
  assert.equal(timeBucket(at(4, 59)), 'lateNight');
  assert.equal(timeBucket(at(5, 0)), 'morning');
  assert.equal(timeBucket(at(11, 59)), 'morning');
  assert.equal(timeBucket(at(12, 0)), 'afternoon');
  assert.equal(timeBucket(at(16, 59)), 'afternoon');
  assert.equal(timeBucket(at(17, 0)), 'evening');
  assert.equal(timeBucket(at(21, 59)), 'evening');
  assert.equal(timeBucket(at(22, 0)), 'lateNight');
  assert.equal(timeBucket(at(23, 59)), 'lateNight');
});

test(`every headline is ${MAX_HEADLINE_LENGTH} characters or fewer once {name} is filled in, so it fits on one line on a small phone`, () => {
  const tooLong = [];
  for (const [bucket, templates] of Object.entries(HEADLINES)) {
    for (const template of templates) {
      const text = template.replace('{name}', PILOT_NAME);
      if (text.length > MAX_HEADLINE_LENGTH) tooLong.push(`${bucket}: "${text}" (${text.length} chars)`);
    }
  }
  assert.deepEqual(tooLong, []);
});

test('candidateHeadlines is the matching time-of-day pool plus anytime, and nothing else', () => {
  const morning = candidateHeadlines(at(8));
  assert.equal(morning.length, HEADLINES.morning.length + HEADLINES.anytime.length);
  for (const t of HEADLINES.morning) assert.ok(morning.includes(t));
  for (const t of HEADLINES.anytime) assert.ok(morning.includes(t));
  for (const t of HEADLINES.evening) assert.ok(!morning.includes(t));
});

test('pickHeadline fills in the name and picks by the injected random value', () => {
  const pool = candidateHeadlines(at(8));
  const { template, text } = pickHeadline({ date: at(8), name: 'Rian', random: () => 0 });
  assert.equal(template, pool[0]);
  assert.equal(text, pool[0].replace('{name}', 'Rian'));

  const last = pickHeadline({ date: at(8), name: 'Rian', random: () => 0.999999 });
  assert.equal(last.template, pool[pool.length - 1]);
});

test('pickHeadline never repeats the previous template when another choice exists', () => {
  const pool = candidateHeadlines(at(8));
  // random() => 0 would normally pick pool[0]; with pool[0] excluded as `previous`, it should shift to
  // the next surviving candidate instead.
  const { template } = pickHeadline({ date: at(8), previous: pool[0], random: () => 0 });
  assert.notEqual(template, pool[0]);
});

test('pickHeadline still returns something if the pool were ever down to one choice', () => {
  // Not a real-world case (the pools always have several entries), but the fallback must not throw.
  const { template } = pickHeadline({ date: at(8), previous: 'anything', random: () => 0 });
  assert.ok(typeof template === 'string' && template.length > 0);
});

const current = (daysRemaining) => ({ status: 'current', expires: '2026-10-01', daysRemaining });
const expiring = (daysRemaining) => ({ status: 'expiring', expires: '2026-10-01', daysRemaining });
const expired = (daysRemaining) => ({ status: 'expired', expires: '2026-09-01', daysRemaining });
const neverEstablished = () => ({ status: 'expired', expires: null, daysRemaining: null });

test('subline tier 1: the most urgent expiring/expired item wins, expired sorts before expiring', () => {
  const facts = {
    currencyItems: [
      { label: 'Instrument currency', result: expiring(20) },
      { label: 'Medical certificate', result: expired(3) },
      { label: 'Flight review', result: current(100) },
    ],
  };
  const r = pickSubline(facts);
  assert.equal(r.text, 'Your Medical certificate expired 3 days ago.');
  assert.deepEqual(r.action, { label: 'Review', to: '/currency' });
});

test('subline tier 1: "expired today" reads naturally, and never-established items are not alarms', () => {
  assert.equal(pickSubline({ currencyItems: [{ label: 'Medical certificate', result: expired(0) }] }).text, 'Your Medical certificate expired today.');
  // expires: null means "never logged", not "lapsed" — must fall through, not report a false expiry.
  const r = pickSubline({ currencyItems: [{ label: 'Medical certificate', result: neverEstablished() }] });
  assert.notEqual(r.text, undefined);
  assert.ok(!/expired/.test(r.text));
});

test('subline tier 1: singular vs plural day wording', () => {
  assert.equal(pickSubline({ currencyItems: [{ label: 'Passport', result: expiring(1) }] }).text, 'Your Passport expires in 1 day.');
  assert.equal(pickSubline({ currencyItems: [{ label: 'Passport', result: expiring(5) }] }).text, 'Your Passport expires in 5 days.');
});

test('subline tier 2: recent flights missing an aircraft link, only once tier 1 is clear', () => {
  const r = pickSubline({ reviewCount: 2 });
  assert.equal(r.text, '2 recent flights aren’t linked to an aircraft yet.');
  assert.deepEqual(r.action, { label: 'Review', to: '/logbook' });
  assert.equal(pickSubline({ reviewCount: 1 }).text, '1 recent flight isn’t linked to an aircraft yet.');
});

test('subline tier 3: a logging gap, only once tiers 1–2 are clear, and only with real flight history', () => {
  const r = pickSubline({ hasFlights: true, daysSinceLastFlight: 9 });
  assert.equal(r.text, 'It’s been 9 days since your last flight. Log it?');
  assert.deepEqual(r.action, { label: 'Add flight', to: '/logbook/new' });
  // Under the threshold: falls through instead of nagging over a normal gap.
  assert.notEqual(pickSubline({ hasFlights: true, daysSinceLastFlight: 2 }).text, r.text);
  // No flights ever: the Dashboard's own empty state covers this, so the picker must not claim a "gap".
  assert.notEqual(pickSubline({ hasFlights: false, daysSinceLastFlight: 400 }).text, 'It’s been 400 days since your last flight. Log it?');
});

test('subline tier 4: last flight\'s debrief note, only once tiers 1–3 are clear', () => {
  const r = pickSubline({ lastFlightWorkOn: 'crosswind landings' });
  assert.equal(r.text, 'Last time: work on crosswind landings');
  assert.equal(r.action, null);
  // A logging gap (tier 3) still outranks a debrief note.
  const gapWins = pickSubline({ hasFlights: true, daysSinceLastFlight: 10, lastFlightWorkOn: 'crosswind landings' });
  assert.equal(/crosswind/.test(gapWins.text), false);
});

test('subline tier 4: a long note is truncated with an ellipsis, never wraps or exceeds the budget', () => {
  const longNote = 'holding altitude better on instrument approaches in gusty crosswinds near the coast';
  const r = pickSubline({ lastFlightWorkOn: longNote });
  assert.ok(r.text.length <= SUBLINE_MAX_LENGTH);
  assert.ok(r.text.endsWith('…'));
  assert.ok(r.text.startsWith('Last time: work on holding'));
});

test('subline tier 4: no note on the last flight falls through to the next tier', () => {
  const r = pickSubline({ lastFlightWorkOn: null, closestMilestone: { label: 'Total time', certificateLabel: 'Private Pilot', percent: 50 } });
  assert.match(r.text, /Total time/);
});

test('subline tier 5: closest milestone, only once tiers 1–3 are clear', () => {
  const r = pickSubline({ closestMilestone: { label: 'Cross-country flight training', certificateLabel: 'Private Pilot', percent: 66.6 } });
  assert.equal(r.text, '67% toward Cross-country flight training for your Private Pilot.');
  assert.deepEqual(r.action, { label: 'View milestones', to: '/milestones' });
});

test('subline tier 6: a calm nudge toward the soonest-expiring current item, no action button', () => {
  const facts = { currencyItems: [{ label: 'Instrument currency', result: current(40) }, { label: 'Flight review', result: current(10) }] };
  const r = pickSubline(facts);
  assert.equal(r.text, 'Flight review: 10 days left.');
  assert.equal(r.action, null);
});

test('subline tier 7: fallback to a friendly stat, then to a plain question with no data at all', () => {
  assert.equal(pickSubline({ totalHoursThisYear: 29.94 }).text, 'You’ve logged 29.9 hours this year.');
  assert.equal(pickSubline({ totalHoursThisYear: 1 }).text, 'You’ve logged 1 hour this year.');
  assert.equal(pickSubline({}).text, 'Where to next?');
});

test('subline priority order holds end to end: tier 1 beats everything else at once', () => {
  const facts = {
    currencyItems: [{ label: 'Medical certificate', result: expired(1) }],
    reviewCount: 3,
    hasFlights: true,
    daysSinceLastFlight: 30,
    closestMilestone: { label: 'Total time', certificateLabel: 'Private Pilot', percent: 50 },
    totalHoursThisYear: 100,
  };
  assert.equal(pickSubline(facts).text, 'Your Medical certificate expired 1 day ago.');
});
