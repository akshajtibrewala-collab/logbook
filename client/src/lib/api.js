// The optional shared passcode (set as APP_PASSCODE on the server) lives in this browser's localStorage.
const PASS_KEY = 'logbook-passcode';
export const getPasscode = () => { try { return localStorage.getItem(PASS_KEY) || ''; } catch { return ''; } };
export const setPasscode = (v) => { try { v ? localStorage.setItem(PASS_KEY, v) : localStorage.removeItem(PASS_KEY); } catch { /* private mode */ } };
export const LOCKED_EVENT = 'logbook:locked';

async function request(method, path, body) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  const pass = getPasscode();
  if (pass) headers['x-app-passcode'] = pass;
  const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return null;
  if (res.status === 401) {
    setPasscode('');
    window.dispatchEvent(new Event(LOCKED_EVENT)); // AuthGate shows the lock screen
    throw new Error('Passcode required');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.fieldErrors = data.errors || null;
    throw err;
  }
  return data;
}

export const api = {
  session: () => request('GET', '/session'),
  listFlights: () => request('GET', '/flights'),
  getFlight: (id) => request('GET', `/flights/${id}`),
  createFlight: (f) => request('POST', '/flights', f),
  updateFlight: (id, f) => request('PUT', `/flights/${id}`, f),
  deleteFlight: (id) => request('DELETE', `/flights/${id}`),
  bulkCreateFlights: (flights) => request('POST', '/flights/bulk', { flights }),
  listReviews: () => request('GET', '/reviews'),
  addReview: (date) => request('POST', '/reviews', { date }),
  updateReview: (id, date) => request('PUT', `/reviews/${id}`, { date }),
  deleteReview: (id) => request('DELETE', `/reviews/${id}`),
  resolveAirports: (codes) => request('GET', `/airports/resolve?codes=${encodeURIComponent(codes.join(','))}`),
  listAircraft: (includeArchived) => request('GET', `/aircraft${includeArchived ? '?archived=1' : ''}`),
  getAircraft: (id) => request('GET', `/aircraft/${id}`),
  createAircraft: (a) => request('POST', '/aircraft', a),
  updateAircraft: (id, a) => request('PUT', `/aircraft/${id}`, a),
  archiveAircraft: (id) => request('POST', `/aircraft/${id}/archive`),
  unarchiveAircraft: (id) => request('POST', `/aircraft/${id}/unarchive`),
  deleteAircraft: (id) => request('DELETE', `/aircraft/${id}`),
  listMilestonesConfig: () => request('GET', '/milestones'),
  listExpirations: () => request('GET', '/expirations'),
  createExpiration: (e) => request('POST', '/expirations', e),
  updateExpiration: (id, e) => request('PUT', `/expirations/${id}`, e),
  deleteExpiration: (id) => request('DELETE', `/expirations/${id}`),
};
