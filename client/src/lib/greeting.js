export const PILOT_NAME = 'Akshaj';

/** "Good morning" from 5:00, "Good afternoon" from 12:00, "Good evening" from 17:00 (through the night until 5:00). */
export function timeOfDayGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export const greeting = (date = new Date(), name = PILOT_NAME) => `${timeOfDayGreeting(date)}, ${name}`;
