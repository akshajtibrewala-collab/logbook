import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRegistration, parsePhotoResponse, chooseIllustration, createPhotoCache, fetchAircraftPhoto, mayFetchPhotos, photoCredit,
  PHOTO_ALLOWED_HOSTS, designatorFromType,
} from './aircraftPhoto.js';

const good = {
  photos: [{
    id: '1',
    thumbnail: { src: 'https://t.plnspttrs.net/00001/a_t.jpg', size: { width: 200, height: 133 } },
    thumbnail_large: { src: 'https://t.plnspttrs.net/00001/a_280.jpg', size: { width: 420, height: 280 } },
    link: 'https://www.planespotters.net/photo/1/x?utm_source=api',
    photographer: ' Test Person ',
  }],
};
const resp = (body, ok = true) => ({ ok, json: async () => body });

test('normalizeRegistration: trims, upper-cases, strips spaces', () => {
  assert.equal(normalizeRegistration(' n12ab '), 'N12AB');
  assert.equal(normalizeRegistration('d-abcd'), 'D-ABCD');
  assert.equal(normalizeRegistration('N 12 AB'), 'N12AB');
});

test('normalizeRegistration: blank, non-string and non-registration shapes are null', () => {
  for (const v of ['', '   ', null, undefined, 42, 'A', '-ABC', 'N12/AB', 'HELLO WORLD!', 'ABCDEFGHIJKL', '../x']) assert.equal(normalizeRegistration(v), null, String(v));
});

test('parsePhotoResponse: a good response gives the large thumbnail, link, photographer', () => {
  assert.deepEqual(parsePhotoResponse(good), {
    src: 'https://t.plnspttrs.net/00001/a_280.jpg', width: 420, height: 280,
    link: 'https://www.planespotters.net/photo/1/x?utm_source=api', photographer: 'Test Person',
  });
});

test('parsePhotoResponse: falls back to the small thumbnail; size is optional', () => {
  const j = structuredClone(good);
  delete j.photos[0].thumbnail_large;
  assert.equal(parsePhotoResponse(j).src, 'https://t.plnspttrs.net/00001/a_t.jpg');
  delete j.photos[0].thumbnail.size;
  const p = parsePhotoResponse(j);
  assert.equal(p.width, null);
  assert.equal(p.height, null);
});

test('parsePhotoResponse: empty, error and malformed bodies are null', () => {
  const bad = [null, undefined, 'x', 3, [], {}, { photos: [] }, { photos: null }, { error: 'x' }, { error: 'x', photos: good.photos }, { photos: [null] }, { photos: ['x'] }, { photos: [{}] }];
  for (const v of bad) assert.equal(parsePhotoResponse(v), null, JSON.stringify(v));
});

test('parsePhotoResponse: a missing photographer, link or image is null; URLs off the photo hosts or not https are refused', () => {
  const mut = (fn) => { const j = structuredClone(good); fn(j.photos[0]); return parsePhotoResponse(j); };
  assert.equal(mut((p) => { p.photographer = '  '; }), null);
  assert.equal(mut((p) => { delete p.photographer; }), null);
  assert.equal(mut((p) => { delete p.link; }), null);
  assert.equal(mut((p) => { p.link = 'https://evil.example/photo'; }), null);
  assert.equal(mut((p) => { p.link = 'http://www.planespotters.net/photo/1'; }), null);
  assert.equal(mut((p) => { p.link = 'https://planespotters.net.evil.example/p'; }), null);
  assert.equal(mut((p) => { p.thumbnail_large.src = 'https://evil.example/a.jpg'; p.thumbnail.src = 'javascript:alert(1)'; }), null);
});

test('chooseIllustration: jet airliners by designator, even with a multi-engine class', () => {
  for (const d of ['A320', 'A21N', 'B738', 'B38M', 'B744', 'E170', 'CRJ7', 'A388']) assert.equal(chooseIllustration({ designator: d, aircraftClass: 'AMEL' }), 'jet', d);
});

test('chooseIllustration: class decides piston singles and twins', () => {
  assert.equal(chooseIllustration({ aircraftClass: 'ASEL' }), 'single');
  assert.equal(chooseIllustration({ aircraftClass: 'ASES' }), 'single');
  assert.equal(chooseIllustration({ aircraftClass: 'AMEL' }), 'twin');
  assert.equal(chooseIllustration({ aircraftClass: 'AMES' }), 'twin');
});

test('chooseIllustration: designator alone (a flight has no class)', () => {
  assert.equal(chooseIllustration({ designator: 'c172' }), 'single');
  assert.equal(chooseIllustration({ designator: 'PA44' }), 'twin');
  assert.equal(chooseIllustration({ designator: 'BE58' }), 'twin');
  assert.equal(chooseIllustration({ designator: 'B350' }), 'twin'); // a turboprop twin is not an airliner jet
});

test('chooseIllustration: rotorcraft, gliders, other categories and unknowns are generic', () => {
  assert.equal(chooseIllustration({ aircraftClass: 'helicopter', designator: 'R44' }), 'generic');
  assert.equal(chooseIllustration({ aircraftClass: 'glider' }), 'generic');
  assert.equal(chooseIllustration({ category: 'rotorcraft' }), 'generic');
  assert.equal(chooseIllustration({ designator: 'ZZZZ' }), 'generic');
  assert.equal(chooseIllustration(), 'generic');
  assert.equal(chooseIllustration({ designator: null, aircraftClass: undefined }), 'generic');
});

test('createPhotoCache: bounded, oldest evicted first, never persisted', () => {
  const c = createPhotoCache(2);
  c.set('A', 1); c.set('B', 2); c.set('C', 3);
  assert.equal(c.has('A'), false);
  assert.equal(c.get('B'), 2);
  assert.equal(c.size, 2);
  c.set('B', 9); c.set('D', 4); // B refreshed, so C is the oldest
  assert.equal(c.has('C'), false);
  assert.equal(c.get('B'), 9);
  c.clear();
  assert.equal(c.size, 0);
  assert.equal(c.has('null-photo'), false);
  c.set('NONE', null); // "no photo" is a real, cacheable answer
  assert.equal(c.has('NONE'), true);
  assert.equal(c.get('NONE'), null);
});

test('fetchAircraftPhoto: sends only the registration, no credentials, referrer trimmed to the origin; caches the answer', async () => {
  const calls = [];
  const cache = createPhotoCache();
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return resp(good); };
  const a = await fetchAircraftPhoto('n12ab', { fetchImpl, cache });
  const b = await fetchAircraftPhoto('N12AB', { fetchImpl, cache });
  assert.equal(a.photographer, 'Test Person');
  assert.deepEqual(a, b);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.planespotters.net/pub/photos/reg/N12AB');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(calls[0].init.referrerPolicy, 'origin');
  assert.equal(calls[0].init.headers, undefined);
  assert.equal(calls[0].init.body, undefined);
});

test('fetchAircraftPhoto: an empty answer is null and cached; an error is null and not cached', async () => {
  const cache = createPhotoCache();
  let n = 0;
  await fetchAircraftPhoto('NONE1', { cache, fetchImpl: async () => { n++; return resp({ photos: [] }); } });
  assert.equal(await fetchAircraftPhoto('NONE1', { cache, fetchImpl: async () => { n++; return resp(good); } }), null);
  assert.equal(n, 1);
  assert.equal(await fetchAircraftPhoto('BAD1', { cache, fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }), null);
  assert.equal(await fetchAircraftPhoto('BAD2', { cache, fetchImpl: async () => resp({ error: 'x' }, false) }), null);
  assert.equal(await fetchAircraftPhoto('BAD3', { cache, fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError('bad json'); } }) }), null);
  assert.equal(cache.has('BAD1') || cache.has('BAD2') || cache.has('BAD3'), false);
  assert.ok((await fetchAircraftPhoto('BAD1', { cache, fetchImpl: async () => resp(good) })) !== null, 'a later visit tries again');
});

test('fetchAircraftPhoto: concurrent lookups share one request; a bad registration makes none', async () => {
  const cache = createPhotoCache();
  let n = 0;
  const fetchImpl = async () => { n++; await new Promise((r) => setTimeout(r, 5)); return resp(good); };
  await Promise.all([fetchAircraftPhoto('SHARE1', { fetchImpl, cache }), fetchAircraftPhoto('share1', { fetchImpl, cache })]);
  assert.equal(n, 1);
  assert.equal(await fetchAircraftPhoto('', { fetchImpl, cache }), null);
  assert.equal(await fetchAircraftPhoto('not a reg!', { fetchImpl, cache }), null);
  assert.equal(n, 1);
});

test('fetchAircraftPhoto: a slow request is abandoned after the timeout and resolves to null', async () => {
  const fetchImpl = (url, init) => new Promise((_, reject) => { init.signal.addEventListener('abort', () => reject(new Error('aborted'))); });
  const t0 = Date.now();
  assert.equal(await fetchAircraftPhoto('SLOW1', { fetchImpl, cache: createPhotoCache(), timeoutMs: 30 }), null);
  assert.ok(Date.now() - t0 < 1000);
});

test('mayFetchPhotos: Save-Data and offline both mean no request', () => {
  assert.equal(mayFetchPhotos({ onLine: true }), true);
  assert.equal(mayFetchPhotos({ onLine: true, connection: { saveData: false } }), true);
  assert.equal(mayFetchPhotos({ onLine: true, connection: { saveData: true } }), false);
  assert.equal(mayFetchPhotos({ onLine: false }), false);
  assert.equal(mayFetchPhotos(null), false);
});

test('photoCredit and the allowed host list', () => {
  assert.equal(photoCredit('Test Person'), 'Photo: Test Person / Planespotters.net');
  assert.ok(PHOTO_ALLOWED_HOSTS.includes('api.planespotters.net'));
  assert.ok(PHOTO_ALLOWED_HOSTS.includes('t.plnspttrs.net'));
});

test('designatorFromType: parens, a bare listed designator, a variant letter, a word in a longer name, or nothing', () => {
  assert.equal(designatorFromType('Cessna 172S (c172)'), 'C172');
  assert.equal(designatorFromType('C172S'), 'C172');
  assert.equal(designatorFromType('B738'), 'B738');
  assert.equal(designatorFromType('Piper PA44 Seminole'), 'PA44');
  assert.equal(designatorFromType('Skyhawk'), '');
  assert.equal(designatorFromType(''), '');
  assert.equal(designatorFromType(null), '');
});

test('chooseIllustration: a variant-lettered designator is read as its listed type', () => {
  assert.equal(chooseIllustration({ designator: 'C172S' }), 'single');
  assert.equal(chooseIllustration({ designator: 'B738' }), 'jet');
});
