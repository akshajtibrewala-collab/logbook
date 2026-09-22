import { forwardRef } from 'react';

// The app's one button component. Pick a variant + size instead of hand-styling a className — this is
// what used to be a slightly different className string copied into FlightForm, ImportExport and
// Dashboard for what was meant to be the same button.
const VARIANTS = {
  primary: 'bg-accent text-ink font-semibold active:bg-accent-dark',
  secondary: 'border border-edge-strong text-accent font-medium active:bg-navy-800',
  ghost: 'text-slate-400 font-medium active:bg-navy-800',
  danger: 'text-bad font-medium active:bg-bad/10',
};
const SIZES = {
  sm: 'h-10 px-3 text-sm rounded-xl',
  md: 'h-12 px-4 text-sm rounded-xl',
  lg: 'h-14 px-5 text-base rounded-2xl',
};

const Button = forwardRef(function Button(
  { as: As = 'button', variant = 'primary', size = 'lg', fullWidth = true, icon: Icon, iconSize = 20, className = '', children, ...props },
  ref,
) {
  return (
    <As ref={ref} {...props}
      className={`flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}>
      {Icon && <Icon size={iconSize} strokeWidth={1.75} />}
      {children}
    </As>
  );
});

export default Button;
