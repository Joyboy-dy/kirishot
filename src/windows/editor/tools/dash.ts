import type { Stroke } from '@/editor/document';

/**
 * The Konva dash pattern of a stroke `w` pixels wide (spec J2.1 § 3.2). Dots are zero-length
 * dashes: the stroke needs `lineCap: 'round'` for them to show.
 */
export function dashFor(dash: Stroke['dash'], w: number): number[] | undefined {
  if (dash === 'dashed') return [3 * w, 2 * w];
  if (dash === 'dotted') return [0, 2 * w];
  return undefined;
}
