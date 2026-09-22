// Generalizes the icon + title + description empty-state markup that used to be duplicated (with
// slightly different spacing each time) in Logbook, Map and Stats.
export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`py-16 text-center ${className}`}>
      {Icon && <Icon size={40} strokeWidth={1.5} className="mx-auto text-slate-600" />}
      {title && <p className="mt-3 font-medium text-slate-300">{title}</p>}
      {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
