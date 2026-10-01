// Thin wrapper around the existing `.card` CSS class (rounded-2xl, hairline border, navy surface) so a
// tappable card can be `<Card as="button">` without every screen re-deriving the same classes.
// `card-elevated` (D1's shadow + larger radius token) and, for a tappable card, `.pressable` (D1/D2's
// scale-down press state) are on by default so every card in the app reads the same way without each
// screen opting in individually — pass elevated={false} for a card that must stay flush (e.g. nested
// inside another card).
export default function Card({ as: As = 'div', padded = true, elevated = true, className = '', children, ...props }) {
  const tappable = As === 'button' || props.onClick;
  return (
    <As className={`card ${elevated ? 'card-elevated' : ''} ${tappable ? 'pressable' : ''} ${padded ? 'p-4' : ''} ${className}`} {...props}>
      {children}
    </As>
  );
}
