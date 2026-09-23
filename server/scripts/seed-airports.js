// Seeds the airports table from the OurAirports open dataset (public domain).
//   npm run seed -w server                 the LOCAL file — never loads any .env file, so it can't touch
//                                           Turso by accident
//   npm run seed:prod -w server             production Turso, loading .env.production (docs/DEPLOY.md)
//   node scripts/seed-airports.js file.csv  loads a CSV you already downloaded, into whichever database
//                                           the current environment (or lack of one) points at
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { client, isRemote } from '../src/db.js';
import { migrate } from '../src/migrate.js';

const URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';

/** Minimal RFC 4180 CSV parser (handles quoted fields, escaped quotes and embedded newlines). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function toAirports(rows) {
  const [header, ...body] = rows;
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  const out = [];
  for (const r of body) {
    const type = r[col.type];
    const lat = Number(r[col.latitude_deg]);
    const lon = Number(r[col.longitude_deg]);
    if (type === 'closed' || !Number.isFinite(lat) || !Number.isFinite(lon) || r[col.latitude_deg] === '') continue;
    const ident = r[col.ident].toUpperCase();
    out.push({
      ident,
      icao: (r[col.icao_code] || (/^[A-Z]{4}$/.test(ident) ? ident : '')).toUpperCase() || null,
      iata: r[col.iata_code].toUpperCase() || null,
      local_code: r[col.local_code].toUpperCase() || null,
      name: r[col.name],
      city: r[col.municipality] || null,
      country: r[col.iso_country] || null,
      type,
      lat,
      lon,
    });
  }
  return out;
}

const COLUMNS = ['ident', 'icao', 'iata', 'local_code', 'name', 'city', 'country', 'type', 'lat', 'lon'];
const ROWS_PER_STATEMENT = 400;
const STATEMENTS_PER_BATCH = 5;

async function seed(airports) {
  await client.execute('DELETE FROM airports');
  const one = `(${COLUMNS.map(() => '?').join(',')})`;
  const statements = [];
  for (let i = 0; i < airports.length; i += ROWS_PER_STATEMENT) {
    const chunk = airports.slice(i, i + ROWS_PER_STATEMENT);
    statements.push({
      sql: `INSERT OR REPLACE INTO airports (${COLUMNS.join(',')}) VALUES ${chunk.map(() => one).join(',')}`,
      args: chunk.flatMap((a) => COLUMNS.map((c) => a[c])),
    });
  }
  for (let i = 0; i < statements.length; i += STATEMENTS_PER_BATCH) {
    await client.batch(statements.slice(i, i + STATEMENTS_PER_BATCH), 'write');
    process.stdout.write(`\r  ${Math.min((i + STATEMENTS_PER_BATCH) * ROWS_PER_STATEMENT, airports.length)} / ${airports.length}`);
  }
  process.stdout.write('\n');
}

// Only run when executed directly, so the parsing helpers can be imported without side effects.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = process.argv[2];
  let text;
  if (source) text = readFileSync(source, 'utf8');
  else {
    console.log(`Downloading ${URL} ...`);
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    text = await res.text();
  }
  await migrate();
  const airports = toAirports(parseCsv(text));
  console.log(`Loading ${airports.length} airports into ${isRemote ? 'Turso' : 'the local file'} ...`);
  await seed(airports);
  console.log('Done.');
}
