// Runs copy-local-to-remote.js against production Turso. See server/scripts/lib/prod-guard.js and
// docs/DEPLOY.md. Any CLI argument (a source .db path) still reaches copy-local-to-remote.js normally,
// since it reads process.argv directly regardless of how it was imported.
import '../lib/prod-guard.js';
import '../copy-local-to-remote.js';
