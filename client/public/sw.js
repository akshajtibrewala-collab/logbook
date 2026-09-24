// Map-tile cache. Only map tiles are handled here — every other request (the app itself, /api/*) goes
// straight to the network exactly as before, so this can never serve stale logbook data.
//
// Tiles are cache-first: a tile you've already looked at loads instantly and works offline. They are
// fetched in CORS mode so the cache stores real (small) responses rather than opaque ones, which browsers
// count against storage quota at a large fixed padding; if a tile server doesn't allow CORS, the tile is
// simply passed through uncached.
const CACHE = 'aerotrail-tiles-v1';
const TILE_HOST = 'server.arcgisonline.com';
const MAX_TILES = 600;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('aerotrail-tiles-') && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_TILES) return;
  await Promise.all(keys.slice(0, keys.length - MAX_TILES).map((k) => cache.delete(k))); // oldest first
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname !== TILE_HOST || !url.pathname.includes('/tile/')) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(url.href);
    if (hit) return hit;
    try {
      const res = await fetch(url.href, { mode: 'cors' });
      if (res.ok) {
        await cache.put(url.href, res.clone());
        event.waitUntil(trim(cache));
      }
      return res;
    } catch {
      return fetch(req); // CORS not allowed (or offline): fall back to a plain request, uncached
    }
  })());
});
