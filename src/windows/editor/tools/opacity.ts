/**
 * Opacity on a whole shape (spec J2.1 § 3.2). With both a fill and a stroke, Konva must draw the
 * shape on a buffer first, or the stroke shows through the translucent fill.
 */
export function opacityProps(
  opacity: number,
  fillAndStroke: boolean,
): { opacity: number; perfectDrawEnabled: boolean } {
  return { opacity, perfectDrawEnabled: fillAndStroke && opacity < 1 };
}
