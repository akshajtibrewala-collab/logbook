import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, fetchAllRates } from '../lib/api.js';
import { computeCostsFigures } from '../lib/costsFigures.js';
import { pilotFlights } from '../lib/flightRoles.js';
import { certificateLabel } from '../lib/milestones.js';
import { todayISO } from '../lib/calendar.js';

/**
 * Everything the Costs screens need, loaded once and computed in one place (lib/costsFigures.js, pilot flights only: passenger flights never reach
 * Costs). `certificate` picks which certificate the projection is for. Nothing here changes a figure; it only gathers and passes them on.
 */
export default function useCostsData(certificate = 'private') {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    Promise.all([
      api.listFlights(), api.listGroundSessions(), api.listExpenses(), fetchAllRates(),
      api.listTrainingPhases(), api.listMilestonesConfig(), api.getSettings(), api.listPlannedCosts(),
      api.listAircraft(true), api.listMilestoneCompletions(),
    ])
      .then(([flights, groundSessions, expenses, rates, phases, milestonesConfig, settings, plannedCosts, aircraft, completions]) =>
        setData({ flights: pilotFlights(flights), groundSessions, expenses, rates, phases, milestonesConfig, settings, plannedCosts, aircraft, completions }))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const computed = useMemo(() => (data ? computeCostsFigures(data, certificate, todayISO()) : null), [data, certificate]);
  const certOptions = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.milestonesConfig.map((r) => r.certificate))].map((c) => ({ value: c, label: certificateLabel(c) }));
  }, [data]);

  return { data, computed, certOptions, error, load };
}
