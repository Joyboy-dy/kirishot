import { describe, expect, it } from 'vitest';
import { arrowParts, quadPoint, snapAngle } from './geometry';

const near = (p: { x: number; y: number }, x: number, y: number) =>
  Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6;

describe('arrowParts', () => {
  it('straight arrow: tip at the end, barbs behind it, 1.6 × width from the axis', () => {
    const { head } = arrowParts({ x: 0, y: 0 }, { x: 100, y: 0 }, null, 4);
    expect(near(head[1], 100, 0)).toBe(true);
    expect(near(head[0], 100 - 12.8, 6.4) || near(head[0], 100 - 12.8, -6.4)).toBe(true);
    expect(head[0].x).toBeLessThan(100);
    expect(head[2].x).toBeLessThan(100);
  });

  it('the shaft starts at the tail and ends where the head starts', () => {
    const { shaft, head } = arrowParts({ x: 0, y: 0 }, { x: 100, y: 0 }, null, 4);
    expect(shaft[0]).toEqual({ x: 0, y: 0 });
    expect(Math.abs(shaft[shaft.length - 1].x - head[0].x)).toBeLessThan(0.5);
  });

  it('curved arrow: the shaft follows the curve and the head the tangent at the tip', () => {
    // Tangent at the tip: to − control = (0, 100), pointing down; the barbs sit above the tip.
    const { shaft, head } = arrowParts({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: -100 }, 4);
    expect(shaft.length).toBeGreaterThan(2);
    expect(shaft[0]).toEqual({ x: 0, y: 0 });
    expect(head.some((p) => near(p, 100 + 6.4, -12.8))).toBe(true);
    expect(head.some((p) => near(p, 100 - 6.4, -12.8))).toBe(true);
  });

  it('a short arrow keeps a head of at least 10 px', () => {
    const { head } = arrowParts({ x: 0, y: 0 }, { x: 30, y: 0 }, null, 1);
    expect(head.some((p) => near(p, 20, 1.6))).toBe(true);
  });

  it('an arrow without length has no parts', () => {
    expect(arrowParts({ x: 5, y: 5 }, { x: 5, y: 5 }, null, 4).shaft).toEqual([]);
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
