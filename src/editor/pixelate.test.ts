import { describe, expect, it } from 'vitest';
import { pixelateBlocks, type Pixels } from './pixelate';

function gradient(w: number, h: number): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data.set([x * 4, y * 4, 128, 255], i);
    }
  return { width: w, height: h, data };
}
const px = (p: Pixels, x: number, y: number) =>
  Array.from(p.data.slice((y * p.width + x) * 4, (y * p.width + x) * 4 + 4));

describe('pixelateBlocks', () => {
  it('makes uniform 16 px blocks', () => {
    const out = pixelateBlocks(gradient(32, 32), { x: 0, y: 0, width: 32, height: 32 }, 16, 1);
    expect([out.width, out.height]).toEqual([32, 32]);
    for (const [bx, by] of [
      [0, 0],
      [16, 0],
      [0, 16],
      [16, 16],
    ])
      for (let y = by; y < by + 16; y++)
        for (let x = bx; x < bx + 16; x++) expect(px(out, x, y)).toEqual(px(out, bx, by));
  });

  it('is deterministic and stays within 6 of the block mean', () => {
    const src = gradient(32, 32);
    const box = { x: 0, y: 0, width: 32, height: 32 };
    const a = pixelateBlocks(src, box, 16, 7);
    expect(pixelateBlocks(src, box, 16, 7).data).toEqual(a.data);
    // Block (0, 0): x from 0 to 15 → red mean 30, green mean 30.
    const [r, g, , alpha] = px(a, 0, 0);
    expect(Math.abs(r - 30)).toBeLessThanOrEqual(6);
    expect(Math.abs(g - 30)).toBeLessThanOrEqual(6);
    expect(alpha).toBe(255);
  });

  it('clips the box to the image', () => {
    const out = pixelateBlocks(gradient(20, 10), { x: 10, y: -5, width: 50, height: 10 }, 16, 1);
    expect([out.width, out.height]).toEqual([10, 5]);
  });
});
