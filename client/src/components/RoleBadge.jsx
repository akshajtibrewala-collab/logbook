// The one place a flight role becomes a small colored pill: sky blue for Pilot, violet for Passenger —
// same tokens as the map's route lines and FlightRoleTabs (see index.css's --role-pax). Used wherever a
// mixed pilot+passenger list needs to say, per row, which one a given flight was.
export default function RoleBadge({ role }) {
  const isPassenger = role === 'passenger';
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
        isPassenger ? 'bg-[rgb(var(--role-pax))]/15 text-[rgb(var(--role-pax-strong))]' : 'bg-accent/15 text-accent-strong'
      }`}
    >
      {isPassenger ? 'Passenger' : 'Pilot'}
    </span>
  );
}
