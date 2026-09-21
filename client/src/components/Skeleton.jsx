// Placeholder block shown while data loads.
export default function Skeleton({ className = 'h-32' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-2xl bg-navy-800 ${className}`} />;
}
