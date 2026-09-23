// Runs copy-local-to-remote.js against production Turso. See server/scripts/lib/prod-guard.js and
// docs/DEPLOY.md. Any CLI argument (a source .db path) still reaches copy-local-to-remote.js normally —
// runTarget forwards process.argv.slice(2) to the spawned child.
import '../lib/prod-guard.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runTarget } from '../lib/run-target.js';

runTarget(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'copy-local-to-remote.js'));
