// The hidden diagnostics panel is on only when a URL carries ?debug=1 (then remembered for the browser session) and off again with ?debug=0.
// Never shown otherwise. Pure: takes the query string and a storage-like object.
const KEY = 'aerohub-debug';

export function debugEnabled(search = '', storage = null) {
  let q = null;
  try { q = new URLSearchParams(search).get('debug'); } catch { /* malformed query: treat as absent */ }
  const read = () => { try { return storage?.getItem(KEY) === '1'; } catch { return false; } };
  const write = (v) => { try { v ? storage?.setItem(KEY, '1') : storage?.removeItem(KEY); } catch { /* private mode */ } };
  if (q === '1') { write(true); return true; }
  if (q === '0') { write(false); return false; }
  return read();
}
