import { describe, expect, it } from 'vitest';
import { arrowOutline, quadPoint, snapAngle } from './geometry';

const near = (p: { x: number; y: number }, x: number, y: number) =>
  Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6;

describe('arrowOutline', () => {
  it('straight arrow: tip at the end, head as wide as 1.6 × width', () => {
    const o = arrowOutline({ x: 0, y: 0 }, { x: 100, y: 0 }, null, 4);
    expect(Math.max(...o.map((p) => p.x))).toBeCloseTo(100);
    expect(o.every((p) => Math.abs(p.y) <= 1.6 * 4 + 1e-9)).toBe(true);
    expect(o.some((p) => near(p, 100 - 12.8, 6.4))).toBe(true);
  });

  it('the tail is thinner than the body', () => {
    const o = arrowOutline({ x: 0, y: 0 }, { x: 100, y: 0 }, null, 4);
    const tail = o.filter((p) => Math.abs(p.x) < 1e-9).map((p) => Math.abs(p.y));
    expect(Math.max(...tail)).toBeCloseTo(0.175 * 4);
  });

  it('curved arrow: the head follows the tangent at the tip', () => {
    // Tangent at the tip: to − control = (0, 100), pointing down; the barbs sit above the tip.
    const o = arrowOutline({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: -100 }, 4);
    expect(o.some((p) => near(p, 100, 0))).toBe(true);
    expect(o.some((p) => near(p, 100 + 6.4, -12.8))).toBe(true);
    expect(o.some((p) => near(p, 100 - 6.4, -12.8))).toBe(true);
  });

  it('a short arrow keeps a head of at least 10 px', () => {
    const o = arrowOutline({ x: 0, y: 0 }, { x: 30, y: 0 }, null, 1);
    expect(o.some((p) => near(p, 20, 1.6))).toBe(true);
  });
});

describe('quadPoint and snapAngle', () => {
  it('quadPoint goes through the ends', () => {
    const a = { x: 0, y: 0 };
    const c = { x: 50, y: 80 };
    const b = { x: 100, y: 0 };
    expect(quadPoint(a, c, b, 0)).toEqual(a);
    expect(quadPoint(a, c, b, 1)).toEqual(b);
    expect(quadPoint(a, c, b, 0.5)).toEqual({ x: 50, y: 40 });
  });

  it('snapAngle locks to 15° steps and keeps the length', () => {
    const p = snapAngle({ x: 0, y: 0 }, { x: 100, y: 10 });
    expect(p.x).toBeCloseTo(Math.hypot(100, 10));
    expect(p.y).toBeCloseTo(0);
    const q = snapAngle({ x: 0, y: 0 }, { x: 50, y: 52 });
    expect(q.x).toBeCloseTo(q.y);
  });
});
