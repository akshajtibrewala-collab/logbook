import { useState } from 'react';
import { aspectOf, tileStyle } from '../lib/photoLayout.js';

const known = (w, h) => Number(w) > 0 && Number(h) > 0;

/** Ratio for a photo: its stored size if it has one, else what was measured when it loaded, else a placeholder. */
function useRatio(width, height) {
  const [measured, setMeasured] = useState(null);
  const ratio = known(width, height) ? aspectOf(width, height) : measured ?? aspectOf(null, null);
  const onLoad = known(width, height) ? undefined : (e) => setMeasured(aspectOf(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight));
  return [ratio, onLoad];
}

/**
 * One photo at its natural orientation, for a single-photo spot (the map pin popup). The box is sized from
 * the stored width/height before the image loads (no layout jump); a photo saved without a size is
 * measured when it loads. `object-contain`: nothing is ever cropped. `maxHeight` keeps a tall one in check.
 */
export function PhotoImage({ src, width, height, alt, maxHeight = 220, className = '' }) {
  const [ratio, onLoad] = useRatio(width, height);
  return (
    <div className={`mx-auto overflow-hidden rounded-xl bg-navy-800 ${className}`}
      style={{ aspectRatio: String(ratio), maxHeight, maxWidth: `min(100%, ${Math.round(ratio * maxHeight)}px)` }}>
      <img src={src} alt={alt} loading="lazy" draggable={false} onLoad={onLoad} className="h-full w-full object-contain" />
    </div>
  );
}

function Tile({ photo, rowHeight, maxHeight, renderTile }) {
  const [ratio, onLoad] = useRatio(photo.width, photo.height);
  const image = (
    <div className="h-full w-full overflow-hidden rounded-xl bg-navy-800">
      <img src={photo.data_url} alt={photo.alt ?? 'Flight photo'} loading="lazy" draggable={false} onLoad={onLoad} className="h-full w-full object-contain" />
    </div>
  );
  return <li className="min-w-0" style={tileStyle(ratio, rowHeight, maxHeight)}>{renderTile(photo, image)}</li>;
}

/**
 * A wrapping row of mixed-orientation photos: each tile's width follows its aspect ratio, so wide and tall
 * photos sit side by side at the same height (and wrap neatly at phone width), and no tile can grow taller
 * than `maxHeight`. `renderTile(photo, imageNode)` lets callers wrap a tile (a button, a delete overlay).
 */
export default function PhotoGrid({ photos, renderTile, rowHeight = 140, maxHeight = 320, className = '' }) {
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`}>
      {photos.map((p, i) => <Tile key={p.id ?? `pending-${i}`} photo={p} rowHeight={rowHeight} maxHeight={maxHeight} renderTile={renderTile} />)}
    </ul>
  );
}
