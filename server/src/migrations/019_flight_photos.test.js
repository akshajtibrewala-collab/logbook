import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { run, get } = await import('../db.js');
const { migrate } = await import('../migrate.js');

test('creates flight_photos', async () => {
  await migrate();
  await run("INSERT INTO flight_photos (flight_id, data_url, width, height) VALUES (1, 'data:image/jpeg;base64,AAAA', 10, 20)");
  const row = await get('SELECT * FROM flight_photos WHERE flight_id = 1');
  assert.equal(row.width, 10);
  await migrate();
});
