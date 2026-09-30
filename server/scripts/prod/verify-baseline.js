// Runs verify-baseline.js against production Turso, read-only. See server/scripts/lib/prod-guard.js and
// docs/DEPLOY.md. Usage: node --env-file=../.env.production scripts/prod/verify-baseline.js <baseline.json>
import '../lib/prod-guard.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runTarget } from '../lib/run-target.js';

runTarget(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'verify-baseline.js'));
