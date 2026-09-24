import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { cronAuthorized, packBackup, runsToPrune, backupStatus, backupFilename, GZIP_THRESHOLD_BYTES } from './backup-job.js';

test('cronAuthorized: exact bearer secret only, and fails closed with no secret configured', () => {
  assert.equal(cronAuthorized('Bearer s3cret', 's3cret'), true);
  assert.equal(cronAuthorized('Bearer wrong', 's3cret'), false);
  assert.equal(cronAuthorized('s3cret', 's3cret'), false); // missing "Bearer "
  assert.equal(cronAuthorized(undefined, 's3cret'), false);
  assert.equal(cronAuthorized('Bearer ', undefined), false);
  assert.equal(cronAuthorized('Bearer undefined', undefined), false);
});

test('packBackup: small backups are sent as plain JSON, large ones gzipped and recoverable', () => {
  const small = packBackup({ tables: { a: [1] } }, new Date('2026-09-28T12:00:00Z'));
  assert.equal(small.gzipped, false);
  assert.equal(small.filename, 'aerotrail-backup-2026-09-28T12-00-00-000Z.json');
  const big = { tables: { flights: Array.from({ length: 20000 }, (_, i) => ({ id: i, remarks: 'x'.repeat(60) })) } };
  const packed = packBackup(big);
  assert.ok(packed.rawBytes >= GZIP_THRESHOLD_BYTES);
  assert.equal(packed.gzipped, true);
  assert.ok(packed.sentBytes < packed.rawBytes / 5);
  assert.ok(packed.filename.endsWith('.json.gz'));
  assert.deepEqual(JSON.parse(gunzipSync(packed.content)), big);
});

test('runsToPrune keeps the newest 12 runs', () => {
  const runs = Array.from({ length: 15 }, (_, i) => ({ id: i + 1, ran_at: `2026-01-${String(i + 1).padStart(2, '0')}T12:00:00Z` }));
  assert.deepEqual(runsToPrune(runs).sort((a, b) => a - b), [1, 2, 3]);
  assert.deepEqual(runsToPrune(runs.slice(0, 5)), []);
});

test('backupStatus: never, failed, stale after 8 days, ok within a weekly cadence', () => {
  const now = new Date('2026-09-28T12:00:00Z');
  assert.equal(backupStatus(null, now).state, 'never');
  const failed = backupStatus({ ran_at: '2026-09-27T12:00:00Z', status: 'failed', error: 'boom' }, now);
  assert.equal(failed.state, 'failed');
  assert.match(failed.message, /boom/);
  assert.equal(backupStatus({ ran_at: '2026-09-21T12:00:00Z', status: 'ok' }, now).state, 'ok'); // 7 days
  assert.equal(backupStatus({ ran_at: '2026-09-20T12:00:00Z', status: 'ok' }, now).state, 'ok'); // exactly 8 days
  const stale = backupStatus({ ran_at: '2026-09-19T12:00:00Z', status: 'ok' }, now);
  assert.equal(stale.state, 'stale');
  assert.equal(stale.warn, true);
});

test('backupFilename marks gzip', () => {
  assert.ok(backupFilename(new Date(), true).endsWith('.gz'));
});
