// Seeds the runways table from the OurAirports open dataset (public domain) — runway ends with true
// headings where published, used by the weather go/no-go checker's crosswind calculation.
//   npm run seed:runways -w server          the LOCAL file — never loads any .env file, so it can't
//                                           touch Turso by accident
//   npm run seed:runways:prod -w server     production Turso, loading .env.production (docs/DEPLOY.md)
//   node scripts/seed-runways.js file.csv   loads a CSV you already downloaded
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { client, isRemote } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { parseCsv } from './seed-airports.js';

const URL = 'https://davidmegginson.github.io/ourairports-data/runways.csv';

export function toRunways(rows) {
  const [header, ...body] = rows;
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  const out = [];
  for (const r of body) {
    if (r[col.closed] === '1') continue;
    const airportIdent = (r[col.airport_ident] || '').toUpperCase();
    const leIdent = r[col.le_ident];
    const heIdent = r[col.he_ident];
    if (!airportIdent || !leIdent || !heIdent) continue;
    const heading = (s) => (s === '' || s == null ? null : Number(s));
    out.push({
      airport_ident: airportIdent,
      le_ident: leIdent,
      le_heading_true: heading(r[col.le_heading_degT]),
      he_ident: heIdent,
      he_heading_true: heading(r[col.he_heading_degT]),
      length_ft: r[col.length_ft] ? Number(r[col.length_ft]) : null,
      surface: r[col.surface] || null,
    });
  }
  return out;
}

const COLUMNS = ['airport_ident', 'le_ident', 'le_heading_true', 'he_ident', 'he_heading_true', 'length_ft', 'surface'];
const ROWS_PER_STATEMENT = 400;
const STATEMENTS_PER_BATCH = 5;

async function seed(runways) {
  await client.execute('DELETE FROM runways');
  const one = `(${COLUMNS.map(() => '?').join(',')})`;
  const statements = [];
  for (let i = 0; i < runways.length; i += ROWS_PER_STATEMENT) {
    const chunk = runways.slice(i, i + ROWS_PER_STATEMENT);
    statements.push({
      sql: `INSERT OR REPLACE INTO runways (${COLUMNS.join(',')}) VALUES ${chunk.map(() => one).join(',')}`,
      args: chunk.flatMap((r) => COLUMNS.map((c) => r[c])),
    });
  }
  for (let i = 0; i < statements.length; i += STATEMENTS_PER_BATCH) {
    await client.batch(statements.slice(i, i + STATEMENTS_PER_BATCH), 'write');
    process.stdout.write(`\r  ${Math.min((i + STATEMENTS_PER_BATCH) * ROWS_PER_STATEMENT, runways.length)} / ${runways.length}`);
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
  const runways = toRunways(parseCsv(text));
  console.log(`Loading ${runways.length} runways into ${isRemote ? 'Turso' : 'the local file'} ...`);
  await seed(runways);
  console.log('Done.');
}
