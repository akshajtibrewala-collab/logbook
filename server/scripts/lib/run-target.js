// Spawns another script as a real child process, rather than `import`ing it, and exits with its exit
// code. This matters specifically because some target scripts (seed-airports.js, seed-runways.js) guard
// their own side effects with `if (import.meta.url === pathToFileURL(process.argv[1]).href)` so their
// parsing helpers can be imported elsewhere without side effects — that guard is only ever true when the
// script is the process's actual entry point. Importing it from a wrapper (as these prod/ scripts
// originally did) leaves argv[1] pointing at the wrapper, so the guard is false and the script silently
// does nothing. Spawning a fresh `node <target>` process makes argv[1] correct again, and passing
// `env: process.env` carries over whatever `--env-file` already loaded into this process.
import { spawnSync } from 'node:child_process';

export function runTarget(targetPath) {
  const result = spawnSync(process.execPath, [targetPath, ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
  process.exit(result.status ?? 1);
}
