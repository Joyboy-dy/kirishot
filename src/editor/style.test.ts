import { describe, expect, it } from 'vitest';
import { PALETTE, strokeWidth } from './style';

describe('style', () => {
  it('has eight colours, Kirishot orange first', () => {
    expect(PALETTE.length).toBe(8);
    expect(PALETTE[0]).toBe('#FF5B38');
  });

  it('medium stroke scales with the image', () => {
    expect(strokeWidth({ w: 1920, h: 1080 }, 2)).toBe(4);
    expect(strokeWidth({ w: 400, h: 300 }, 2)).toBe(2);
    expect(strokeWidth({ w: 3840, h: 2160 }, 2)).toBe(7);
  });

  it('sizes grow from fine to very thick', () => {
    const w = [1, 2, 3, 4].map((s) => strokeWidth({ w: 1920, h: 1080 }, s as 1 | 2 | 3 | 4));
    expect(w).toEqual([...w].sort((a, b) => a - b));
    expect(new Set(w).size).toBe(4);
    expect(w[0]).toBeGreaterThanOrEqual(1);
  });
});
