// Map-tile cache. Only map tiles are handled here — every other request (the app itself, /api/*) goes
// straight to the network exactly as before, so this can never serve stale logbook data.
//
// Tiles are cache-first: a tile you've already looked at loads instantly and works offline. They are
// fetched in CORS mode so the cache stores real (small) responses rather than opaque ones, which browsers
// count against storage quota at a large fixed padding; if a tile server doesn't allow CORS, the tile is
// simply passed through uncached.
// Intentionally kept as "aerotrail-" (the app's old name) despite the AeroHub rename — this is a cache
// name, not user-visible text. v2 (2026-10): v1 could hold the provider's light-gray "Map data not yet available" tiles as if they were good; the activate handler
// below deletes every other aerotrail-tiles-* cache, so each install starts clean and refreshes its tiles.
const CACHE = 'aerotrail-tiles-v2';
// The provider's placeholder pictures (same bytes everywhere): a 2521-byte JPEG for the base canvases and an 875-byte PNG for the reference layers. Never cached.
const PLACEHOLDER_SIZES = new Set([2521, 875]);
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
      // Only a real, readable image is kept: status 200 (not 206 or an error page), not opaque, an image type, and not one of the provider's placeholders.
      if (res.status === 200 && res.type !== 'opaque' && (res.headers.get('content-type') || '').startsWith('image/')) {
        const size = (await res.clone().blob()).size;
        if (!PLACEHOLDER_SIZES.has(size)) {
          await cache.put(url.href, res.clone());
          event.waitUntil(trim(cache));
        }
      }
      return res;
    } catch {
      return fetch(req); // CORS not allowed (or offline): fall back to a plain request, uncached
    }
  })());
});
