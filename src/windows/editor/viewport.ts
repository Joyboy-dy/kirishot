// The editor's view: how the image (in image pixels) maps onto the stage (in CSS pixels).

/** `x`, `y`: where image pixel (0, 0) lands on the stage; `scale`: CSS pixels per image pixel. */
export type View = { scale: number; x: number; y: number };

/** The whole image in the box, centred, never above 100 %. */
export function fit(
  image: { w: number; h: number },
  box: { width: number; height: number },
  padding = 32,
): View {
  const scale = Math.min(
    1,
    (box.width - 2 * padding) / image.w,
    (box.height - 2 * padding) / image.h,
  );
  return {
    scale,
    x: (box.width - image.w * scale) / 2,
    y: (box.height - image.h * scale) / 2,
  };
}

/** Zooms by `factor` around `at` (stage pixels): the image point under it stays put. */
export function zoomAt(
  v: View,
  factor: number,
  at: { x: number; y: number },
  min = 0.05,
  max = 8,
): View {
  const scale = Math.min(max, Math.max(min, v.scale * factor));
  const ix = (at.x - v.x) / v.scale;
  const iy = (at.y - v.y) / v.scale;
  return { scale, x: at.x - ix * scale, y: at.y - iy * scale };
}

export function pan(v: View, dx: number, dy: number): View {
  return { ...v, x: v.x + dx, y: v.y + dy };
}
