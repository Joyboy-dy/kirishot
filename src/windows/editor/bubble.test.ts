import { describe, expect, it } from 'vitest';
import { bubblePlacement } from './bubble';

const area = { width: 1000, height: 700 };
const bubble = { width: 300, height: 40 };

describe('bubblePlacement', () => {
  it('sits centred under the selection', () => {
    const p = bubblePlacement({ x: 400, y: 100, width: 200, height: 100 }, bubble, area);
    expect(p).toEqual({ x: 350, y: 212, wrap: false });
  });

  it('stays inside at the right edge', () => {
    const p = bubblePlacement({ x: 950, y: 100, width: 40, height: 40 }, bubble, area);
    expect(p.x).toBe(area.width - 8 - bubble.width);
  });

  it('stays inside at the left edge', () => {
    const p = bubblePlacement({ x: 0, y: 100, width: 20, height: 20 }, bubble, area);
    expect(p.x).toBe(8);
  });

  it('goes above the selection when there is no room below', () => {
    const p = bubblePlacement({ x: 400, y: 600, width: 100, height: 80 }, bubble, area);
    expect(p.y).toBe(600 - 12 - bubble.height);
  });

  it('goes inside the area when the selection covers it', () => {
    const p = bubblePlacement({ x: -50, y: -50, width: 1100, height: 800 }, bubble, area);
    expect(p.y).toBeLessThanOrEqual(area.height - bubble.height - 8);
    expect(p.y).toBeGreaterThanOrEqual(8);
  });

  it('wraps when it is wider than the area', () => {
    const p = bubblePlacement(
      { x: 100, y: 100, width: 50, height: 50 },
      { width: 600, height: 40 },
      { width: 520, height: 400 },
    );
    expect(p).toMatchObject({ x: 8, wrap: true });
  });
});
