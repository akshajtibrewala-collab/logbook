// Read-only: prints which database the current environment will target, and never prints
// TURSO_AUTH_TOKEN. This is the confirmation step to run before any command that could write to a real
// database — see CLAUDE.md's "Branch and deploy safety" and docs/DEPLOY.md. It reads the exact same
// TURSO_DATABASE_URL check server/src/db.js itself uses, so what this prints is what every other script
// (migrate, backup, verify-baseline, the API server) will actually connect to.
import { isRemote } from '../src/db.js';

if (isRemote) {
  console.log(`Target: Turso (remote)\nTURSO_DATABASE_URL: ${process.env.TURSO_DATABASE_URL}`);
} else {
  console.log(`Target: local SQLite file (${process.env.DB_FILE || 'server/logbook.db'})`);
}
