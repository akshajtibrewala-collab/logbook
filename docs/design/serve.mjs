// Static server for the design mockups and glass lab, reachable from a phone on the same Wi-Fi.
// Run: node docs/design/serve.mjs   (port 5180, strict: exits if the port is taken; serves docs/design only)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';
import { networkInterfaces } from 'node:os';

const root = dirname(fileURLToPath(import.meta.url));
const PORT = 5180;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };

const server = http.createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '') || 'index.html';
  if (p.includes('..') || !['.html', '.css', '.svg', '.png', '.jpg', '.json'].includes(extname(p))) { res.writeHead(404).end('Not found'); return; }
  try { res.writeHead(200, { 'Content-Type': types[extname(p)], 'Cache-Control': 'no-store' }).end(await readFile(join(root, p))); }
  catch { res.writeHead(404).end('Not found'); }
});
server.on('error', (e) => { console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is in use (strict port) — stop the other process.` : e.message); process.exit(1); });
server.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(networkInterfaces()).flat().filter((n) => n.family === 'IPv4' && !n.internal).map((n) => n.address);
  console.log(`Design server: ${ips.map((a) => `http://${a}:${PORT}/`).join('  ')}`);
});
