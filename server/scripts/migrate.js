// Creates/updates the database schema. Safe to run repeatedly.
//   npm run migrate -w server          always the LOCAL file (server/logbook.db, or $DB_FILE) — this
//                                      script never loads any .env file, so it can't touch Turso by accident
//   npm run migrate:prod -w server     production Turso, loading .env.production — see docs/DEPLOY.md
// It also runs as part of the Vercel build, where TURSO_* come from Vercel's own project environment
// variables (not a local file), so a schema change ships with a normal deploy.
import { isRemote } from '../src/db.js';
import { migrate } from '../src/migrate.js';

if (process.env.VERCEL && !isRemote) {
  console.error('TURSO_DATABASE_URL is not set in this Vercel project. Add it (and TURSO_AUTH_TOKEN) under Settings > Environment Variables.');
  process.exit(1);
}

await migrate();
console.log(`Schema is up to date (${isRemote ? 'Turso' : 'local file'}).`);
