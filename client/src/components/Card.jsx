// Thin wrapper around the existing `.card` CSS class (rounded-2xl, hairline border, navy surface) so a
// tappable card can be `<Card as="button">` without every screen re-deriving the same classes.
export default function Card({ as: As = 'div', padded = true, className = '', children, ...props }) {
  return (
    <As className={`card ${padded ? 'p-4' : ''} ${className}`} {...props}>
      {children}
    </As>
  );
}
