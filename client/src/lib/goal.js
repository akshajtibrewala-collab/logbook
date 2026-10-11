// The pilot's hour goal: the one existing goal setting (pilot_settings.hours_target, typed on Stats, Pilot tab, "Progress toward your goal", Set a target).
// Until one is typed the goal is 50 hours. It only drives the hero and the Stats goal line; the 40 h FAA minimum belongs to the milestone engine and is
// never changed by it (it is shown as a tick on the same line).
export const DEFAULT_GOAL_HOURS = 50;

/** The goal in hours: the saved target when it is a positive number, else DEFAULT_GOAL_HOURS. */
export function goalHours(settings) {
  const n = Number(settings?.hours_target);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_GOAL_HOURS;
}

/** True when the pilot typed their own goal (so a screen can say "your goal" rather than "default goal"). */
export const goalIsCustom = (settings) => Number.isFinite(Number(settings?.hours_target)) && Number(settings?.hours_target) > 0;
