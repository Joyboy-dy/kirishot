// Where the selection bubble goes (spec J2.1 § 3.2), in the canvas area's CSS pixels.
import type { Rect } from '@/editor/document';

const GAP = 12;
const MARGIN = 8;

/**
 * The bubble's top-left corner: under the selection, above it when there is no room, inside the
 * area's bottom otherwise; centred on the selection, then kept `MARGIN` px inside the area.
 * `wrap`: the bubble is wider than the area and must go to two lines.
 */
export function bubblePlacement(
  sel: Rect,
  bubble: { width: number; height: number },
  area: { width: number; height: number },
): { x: number; y: number; wrap: boolean } {
  const wrap = bubble.width > area.width - 2 * MARGIN;
  const maxX = area.width - MARGIN - bubble.width;
  const x = wrap
    ? MARGIN
    : Math.min(Math.max(sel.x + sel.width / 2 - bubble.width / 2, MARGIN), maxX);

  const below = sel.y + sel.height + GAP;
  const above = sel.y - GAP - bubble.height;
  let y: number;
  if (below + bubble.height <= area.height - MARGIN) y = below;
  else if (above >= MARGIN) y = above;
  else y = Math.max(MARGIN, area.height - MARGIN - bubble.height);
  return { x, y, wrap };
}
