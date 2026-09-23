// Import this first, before any query, in every script meant to run only via a `:prod` npm command.
// Node loads `--env-file=.env.production` before any module code runs, so by the time this executes,
// TURSO_DATABASE_URL/TURSO_AUTH_TOKEN are already in process.env if that file set them — this is the
// last checkpoint before the script's own logic (migrate/seed/backup/...) touches anything.
import { isRemote } from '../../src/db.js';

if (!isRemote) {
  console.error(
    'This is a `:prod` script, but no TURSO_DATABASE_URL was loaded — .env.production is missing, '
    + 'incomplete, or this wasn\'t run via the `:prod` npm script. Refusing to run against nothing.',
  );
  process.exit(1);
}

console.warn(`\n⚠ PRODUCTION TURSO ⚠  This command runs against: ${process.env.TURSO_DATABASE_URL}\n`);
