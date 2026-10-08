// A labeled on/off switch, for boolean aircraft flags (complex, tailwheel, ...) — reads better than a
// row of plain checkboxes for a set of yes/no attributes.
export default function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-2.5">
      <span className="min-w-0">
        <span className="block text-sm text-slate-100">{label}</span>
        {description && <span className="block text-xs text-slate-400">{description}</span>}
      </span>
      <span className="gl-switch-hit">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className={`gl-switch ${checked ? 'on' : ''}`} aria-hidden="true" />
      </span>
    </label>
  );
}
