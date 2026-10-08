import { forwardRef } from 'react';
import { glassRole } from '../ds/Controls.jsx';

// The app's one button component for the pre-redesign pages. It renders the approved glass recipe (ds/buttons.css) so the whole app
// shares one look: primary = pilot sky glass, secondary = clear glass, ghost = text only. `danger` is red glass only on the CONFIRM step
// (pass `confirm`, as ConfirmDialog does); a plain `danger` trigger renders as clear glass. Sizes keep their old names: sm / md / lg.
const SIZES = { sm: 'sm', md: '', lg: 'lg' };

const Button = forwardRef(function Button(
  { as: As = 'button', variant = 'primary', size = 'lg', fullWidth = true, confirm = false, icon: Icon, iconSize = 20, className = '', children, ...props },
  ref,
) {
  return (
    <As ref={ref} {...props}
      className={`gl ${glassRole(variant, confirm)} ${SIZES[size]} ${fullWidth ? 'block' : ''} ${className}`}>
      {Icon && <Icon size={iconSize} strokeWidth={2} />}
      {children}
    </As>
  );
});

export default Button;
