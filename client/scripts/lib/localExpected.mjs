// The real expected values live ONLY in an untracked, gitignored file (client/scripts/.local-expected.json), never in the repository. Checks that compare
// against real or production figures read them from here; without the file they need explicit command-line values.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LOCAL_EXPECTED_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.local-expected.json');

/** The parsed local config, or null when the file is absent. */
export function loadLocalExpected() {
  try { return JSON.parse(fs.readFileSync(LOCAL_EXPECTED_PATH, 'utf8')); } catch { return null; }
}

/** One profile ("real" = the real local database, "production" = a production-shaped copy) from the local config, or null. */
export const profileExpected = (name) => loadLocalExpected()?.[name] ?? null;
