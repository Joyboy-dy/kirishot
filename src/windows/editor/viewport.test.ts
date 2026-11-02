import { describe, expect, it } from 'vitest';
import { fit, pan, zoomAt, followBox } from './viewport';

describe('viewport', () => {
  it('fit never upscales', () =>
    expect(fit({ w: 400, h: 300 }, { width: 1200, height: 800 }).scale).toBe(1));

  it('fit shrinks a 4K image and centres it', () => {
    const v = fit({ w: 3840, h: 2160 }, { width: 1200, height: 800 });
    expect(v.scale).toBeCloseTo((1200 - 64) / 3840);
    expect(v.x).toBeCloseTo(32);
    expect(v.y).toBeCloseTo((800 - 2160 * v.scale) / 2);
  });

  it('zoom keeps the point under the cursor', () => {
    const v = zoomAt({ scale: 1, x: 0, y: 0 }, 2, { x: 100, y: 50 });
    expect(v.scale).toBe(2);
    expect({ x: (100 - v.x) / v.scale, y: (50 - v.y) / v.scale }).toEqual({ x: 100, y: 50 });
  });

  it('zoom stays within its limits', () => {
    expect(zoomAt({ scale: 7, x: 0, y: 0 }, 4, { x: 0, y: 0 }).scale).toBe(8);
    expect(zoomAt({ scale: 0.06, x: 0, y: 0 }, 0.5, { x: 0, y: 0 }).scale).toBe(0.05);
  });

  it('pan moves the view', () =>
    expect(pan({ scale: 2, x: 10, y: 10 }, 5, -5)).toEqual({ scale: 2, x: 15, y: 5 }));
});

describe('followBox', () => {
  const image = { w: 1000, h: 500 };

  it('a fitted view refits when the box changes size (the window shown, resized, maximised)', () => {
    const small = fit(image, { width: 400, height: 300 });
    const next = followBox({ view: small, fitted: true }, image, { width: 1400, height: 900 });
    expect(next).toEqual({ view: fit(image, { width: 1400, height: 900 }), fitted: true });
  });

  it('a view the user zoomed or panned stays as it is', () => {
    const mine = { scale: 2, x: -50, y: 10 };
    const next = followBox({ view: mine, fitted: false }, image, { width: 1400, height: 900 });
    expect(next).toEqual({ view: mine, fitted: false });
  });
});
