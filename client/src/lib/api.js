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
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (cause) {
    // fetch rejects only when the request never completed (offline, dropped connection): callers can
    // queue the entry for retry instead of losing it (see lib/outbox.js).
    const err = new Error('You appear to be offline — check your connection.');
    err.network = true;
    err.cause = cause;
    throw err;
  }
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
  searchAirports: (q) => request('GET', `/airports/search?q=${encodeURIComponent(q)}`),
  listAircraft: (includeArchived) => request('GET', `/aircraft${includeArchived ? '?archived=1' : ''}`),
  getAircraft: (id) => request('GET', `/aircraft/${id}`),
  createAircraft: (a) => request('POST', '/aircraft', a),
  updateAircraft: (id, a) => request('PUT', `/aircraft/${id}`, a),
  archiveAircraft: (id) => request('POST', `/aircraft/${id}/archive`),
  unarchiveAircraft: (id) => request('POST', `/aircraft/${id}/unarchive`),
  deleteAircraft: (id) => request('DELETE', `/aircraft/${id}`),
  listMilestonesConfig: () => request('GET', '/milestones'),
  listMilestoneCompletions: () => request('GET', '/milestone-completions'),
  completeMilestone: (certificate, requirementKey, completedAt, note) =>
    request('PUT', `/milestone-completions/${certificate}/${requirementKey}`, { completed_at: completedAt, note }),
  uncompleteMilestone: (certificate, requirementKey) => request('DELETE', `/milestone-completions/${certificate}/${requirementKey}`),
  listExpirations: () => request('GET', '/expirations'),
  createExpiration: (e) => request('POST', '/expirations', e),
  updateExpiration: (id, e) => request('PUT', `/expirations/${id}`, e),
  deleteExpiration: (id) => request('DELETE', `/expirations/${id}`),
  getSettings: () => request('GET', '/settings'),
  updateSettings: (s) => request('PUT', '/settings', s),
  getShare: () => request('GET', '/share'),
  getShareSummary: (notes = true) => request('GET', `/share/summary?limit=25${notes ? '' : '&notes=0'}`),
  enableShare: () => request('POST', '/share'),
  updateShare: (flags) => request('PUT', '/share', flags),
  regenerateShare: () => request('POST', '/share/regenerate'),
  revokeShare: () => request('DELETE', '/share'),
  backupJobStatus: () => request('GET', '/backup-job/status'),
  runBackupNow: () => request('POST', '/backup-job/run'),
  exportBackup: () => request('GET', '/backup/export'),
  restoreBackup: (backup, mode) => request('POST', '/backup/restore', mode ? { ...backup, mode } : backup),

  // Ground sessions keep their historical /costs/ground-sessions API path (old cached clients and every check use it).
  listGroundSessions: () => request('GET', '/costs/ground-sessions'),
  getGroundSession: (id) => request('GET', `/costs/ground-sessions/${id}`),
  createGroundSession: (s) => request('POST', '/costs/ground-sessions', s),
  updateGroundSession: (id, s) => request('PUT', `/costs/ground-sessions/${id}`, s),
  deleteGroundSession: (id) => request('DELETE', `/costs/ground-sessions/${id}`),
};

/**
 * Saves part of the pilot settings without disturbing the rest. The settings endpoint replaces the whole
 * row (a field left out is cleared), and a page that edits only its own
 * fields (e.g. a Commercial-certificate form later) merges its changes into the current settings instead of sending a partial form.
 */
export async function saveSettingsMerged(patch) {
  const current = await api.getSettings();
  return api.updateSettings({ ...current, ...patch });
}
