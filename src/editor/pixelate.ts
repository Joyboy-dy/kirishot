// « Masquer »: big blocks of mean colour with a little noise, so no text can be read back
// (a light blur can be reversed; spec J2 § 4.2).
import type { Rect } from './document';

/** The shape of `ImageData`, usable in tests outside a browser. */
export type Pixels = { width: number; height: number; data: Uint8ClampedArray };

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The pixels of `box` (clipped to the image) in blocks of `block` px, ±6 of each mean. */
export function pixelateBlocks(src: Pixels, box: Rect, block = 16, seed = 0): Pixels {
  const x0 = Math.max(0, Math.round(box.x));
  const y0 = Math.max(0, Math.round(box.y));
  const x1 = Math.min(src.width, Math.round(box.x + box.width));
  const y1 = Math.min(src.height, Math.round(box.y + box.height));
  const width = Math.max(0, x1 - x0);
  const height = Math.max(0, y1 - y0);
  const data = new Uint8ClampedArray(width * height * 4);
  const random = mulberry32(seed);
  for (let by = 0; by < height; by += block) {
    for (let bx = 0; bx < width; bx += block) {
      const w = Math.min(block, width - bx);
      const h = Math.min(block, height - by);
      const sum = [0, 0, 0];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = ((y0 + by + y) * src.width + (x0 + bx + x)) * 4;
          sum[0] += src.data[i];
          sum[1] += src.data[i + 1];
          sum[2] += src.data[i + 2];
        }
      const noise = Math.round(random() * 12 - 6);
      const colour = sum.map((s) => s / (w * h) + noise);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const o = ((by + y) * width + (bx + x)) * 4;
          data[o] = colour[0];
          data[o + 1] = colour[1];
          data[o + 2] = colour[2];
          data[o + 3] = 255;
        }
    }
  }
  return { width, height, data };
}
