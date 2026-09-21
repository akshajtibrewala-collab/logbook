// Creates/updates the database schema. Safe to run repeatedly.
//   npm run migrate -w server          (uses TURSO_* from the environment or the repo-root .env, else the local file)
// It also runs as part of the Vercel build, so a schema change ships with a normal deploy.
import { isRemote } from '../src/db.js';
import { migrate } from '../src/migrate.js';

if (process.env.VERCEL && !isRemote) {
  console.error('TURSO_DATABASE_URL is not set in this Vercel project. Add it (and TURSO_AUTH_TOKEN) under Settings > Environment Variables.');
  process.exit(1);
}

await migrate();
console.log(`Schema is up to date (${isRemote ? 'Turso' : 'local file'}).`);
