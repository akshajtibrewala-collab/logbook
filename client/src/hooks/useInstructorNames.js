import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { instructorNames } from '../lib/instructors.js';

/** The instructor names already used (flights and ground sessions), for the forms' suggestions. Empty until loaded; a failure just means no suggestions. */
export default function useInstructorNames() {
  const [names, setNames] = useState([]);
  useEffect(() => {
    let live = true;
    Promise.all([api.listFlights(), api.listGroundSessions()])
      .then(([f, g]) => { if (live) setNames(instructorNames(f, g)); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return names;
}
