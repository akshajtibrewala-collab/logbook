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
  checkWeather: (ident) => request('GET', `/weather/${encodeURIComponent(ident)}`),
  planWeather: (legs) => request('POST', '/weather/plan', { legs }),
  exportBackup: () => request('GET', '/backup/export'),
  restoreBackup: (backup, mode) => request('POST', '/backup/restore', mode ? { ...backup, mode } : backup),

  listAircraftRates: () => request('GET', '/costs/rates/aircraft'),
  createAircraftRate: (r) => request('POST', '/costs/rates/aircraft', r),
  updateAircraftRate: (id, r) => request('PUT', `/costs/rates/aircraft/${id}`, r),
  deleteAircraftRate: (id) => request('DELETE', `/costs/rates/aircraft/${id}`),
  listInstructorRates: () => request('GET', '/costs/rates/instructor'),
  createInstructorRate: (r) => request('POST', '/costs/rates/instructor', r),
  updateInstructorRate: (id, r) => request('PUT', `/costs/rates/instructor/${id}`, r),
  deleteInstructorRate: (id) => request('DELETE', `/costs/rates/instructor/${id}`),
  listGroundRates: () => request('GET', '/costs/rates/ground'),
  createGroundRate: (r) => request('POST', '/costs/rates/ground', r),
  updateGroundRate: (id, r) => request('PUT', `/costs/rates/ground/${id}`, r),
  deleteGroundRate: (id) => request('DELETE', `/costs/rates/ground/${id}`),
  listSimulatorRates: () => request('GET', '/costs/rates/simulator'),
  createSimulatorRate: (r) => request('POST', '/costs/rates/simulator', r),
  updateSimulatorRate: (id, r) => request('PUT', `/costs/rates/simulator/${id}`, r),
  deleteSimulatorRate: (id) => request('DELETE', `/costs/rates/simulator/${id}`),
  listExpenses: () => request('GET', '/costs/expenses'),
  createExpense: (e) => request('POST', '/costs/expenses', e),
  updateExpense: (id, e) => request('PUT', `/costs/expenses/${id}`, e),
  deleteExpense: (id) => request('DELETE', `/costs/expenses/${id}`),
  listGroundSessions: () => request('GET', '/costs/ground-sessions'),
  getGroundSession: (id) => request('GET', `/costs/ground-sessions/${id}`),
  createGroundSession: (s) => request('POST', '/costs/ground-sessions', s),
  updateGroundSession: (id, s) => request('PUT', `/costs/ground-sessions/${id}`, s),
  deleteGroundSession: (id) => request('DELETE', `/costs/ground-sessions/${id}`),
  listTrainingPhases: () => request('GET', '/costs/phases'),
  setTrainingPhase: (certificate, phase) => request('PUT', `/costs/phases/${certificate}`, phase),
  deleteTrainingPhase: (certificate) => request('DELETE', `/costs/phases/${certificate}`),
  listPlannedCosts: () => request('GET', '/costs/planned-costs'),
  createPlannedCost: (c) => request('POST', '/costs/planned-costs', c),
  updatePlannedCost: (id, c) => request('PUT', `/costs/planned-costs/${id}`, c),
  deletePlannedCost: (id) => request('DELETE', `/costs/planned-costs/${id}`),
};

/** Fetches all four rate tables in one round trip, in the shape client/src/lib/cost.js expects. */
export async function fetchAllRates() {
  const [aircraft_rates, instructor_rates, ground_rates, simulator_rates] = await Promise.all([
    api.listAircraftRates(), api.listInstructorRates(), api.listGroundRates(), api.listSimulatorRates(),
  ]);
  return { aircraft_rates, instructor_rates, ground_rates, simulator_rates };
}
