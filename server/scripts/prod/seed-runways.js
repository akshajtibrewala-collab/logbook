// Runs seed-runways.js against production Turso. See server/scripts/lib/prod-guard.js and docs/DEPLOY.md.
import '../lib/prod-guard.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runTarget } from '../lib/run-target.js';

runTarget(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed-runways.js'));
