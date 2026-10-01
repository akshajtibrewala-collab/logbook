import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAlertWorthy, homeStatusAlerts, ALERT_WINDOW_DAYS, LONG_GAP_DAYS } from './homeAlerts.js';

const result = (daysRemaining) => ({ status: daysRemaining == null ? 'expired' : daysRemaining < 0 ? 'expired' : 'current', daysRemaining });

test('isAlertWorthy: never-current (no qualifying history) is never alert-worthy', () => {
  assert.equal(isAlertWorthy(result(null)), false);
  assert.equal(isAlertWorthy(null), false);
  assert.equal(isAlertWorthy(undefined), false);
});

test('isAlertWorthy: comfortably current (well past the 30-day window) is not alert-worthy', () => {
  assert.equal(isAlertWorthy(result(31)), false);
  assert.equal(isAlertWorthy(result(365)), false);
});

test('isAlertWorthy: expiring within the window, and the boundary itself, are alert-worthy', () => {
  assert.equal(isAlertWorthy(result(ALERT_WINDOW_DAYS)), true);
  assert.equal(isAlertWorthy(result(1)), true);
  assert.equal(isAlertWorthy(result(0)), true);
});

test('isAlertWorthy: lapsed after having been current (negative daysRemaining) is alert-worthy', () => {
  assert.equal(isAlertWorthy(result(-1)), true);
  assert.equal(isAlertWorthy(result(-400)), true);
});

test('homeStatusAlerts: nothing alert-worthy is a calm zero, defaulting to the Currency page', () => {
  const r = homeStatusAlerts({ currencyResults: [result(31), result(null)], today: '2026-06-01' });
  assert.equal(r.count, 0);
  assert.equal(r.to, '/currency');
});

test('homeStatusAlerts: counts each alert-worthy currency result and routes to Currency', () => {
  const r = homeStatusAlerts({ currencyResults: [result(5), result(-2), result(90), result(null)], today: '2026-06-01' });
  assert.equal(r.count, 2);
  assert.equal(r.to, '/currency');
});

test('homeStatusAlerts: a custom expiration within the window counts too, via the same customExpirations() the Currency page uses', () => {
  const expirations = [{ kind: 'passport', label: 'Passport', expires_date: '2026-06-10' }]; // 9 days out
  const r = homeStatusAlerts({ currencyResults: [], expirations, today: '2026-06-01' });
  assert.equal(r.count, 1);
  assert.equal(r.to, '/currency');
});

test('homeStatusAlerts: the backup warning alone counts and routes to Import & export, not Currency', () => {
  const r = homeStatusAlerts({ currencyResults: [result(90)], backupWarn: true, today: '2026-06-01' });
  assert.equal(r.count, 1);
  assert.equal(r.to, '/logbook/data');
});

test('homeStatusAlerts: a long gap alone counts and routes to the Logbook', () => {
  const lastFlight = '2026-05-01'; // 31 days before "today"
  const r = homeStatusAlerts({ currencyResults: [], lastPilotFlightDate: lastFlight, today: '2026-06-01' });
  assert.equal(r.count, 1);
  assert.equal(r.to, '/logbook/new');
  assert.equal(r.daysSinceLastFlight, 31);
});

test('homeStatusAlerts: a gap shorter than the threshold does not count', () => {
  const lastFlight = '2026-05-27'; // 5 days before "today", under LONG_GAP_DAYS
  const r = homeStatusAlerts({ currencyResults: [], lastPilotFlightDate: lastFlight, today: '2026-06-01' });
  assert.equal(r.count, 0);
  assert.ok(5 < LONG_GAP_DAYS);
});

test('homeStatusAlerts: a currency item always wins the tap target over backup/gap when several are present', () => {
  const r = homeStatusAlerts({
    currencyResults: [result(2)], backupWarn: true, lastPilotFlightDate: '2026-01-01', today: '2026-06-01',
  });
  assert.equal(r.count, 3);
  assert.equal(r.to, '/currency');
});

test('homeStatusAlerts: no last pilot flight at all is not treated as a gap', () => {
  const r = homeStatusAlerts({ currencyResults: [], lastPilotFlightDate: null, today: '2026-06-01' });
  assert.equal(r.count, 0);
  assert.equal(r.daysSinceLastFlight, null);
});
