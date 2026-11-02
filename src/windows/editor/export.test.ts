import { describe, expect, it } from 'vitest';
import { newDoc, setCrop } from '@/editor/document';
import { exportRect } from './export';

describe('exportRect', () => {
  it('is the whole image without a crop', () =>
    expect(exportRect(newDoc('a', 1920, 1080))).toEqual({ x: 0, y: 0, width: 1920, height: 1080 }));
  it('is the crop when there is one', () => {
    const d = setCrop(newDoc('a', 1920, 1080), { x: 100, y: 50, width: 800, height: 600 });
    expect(exportRect(d)).toEqual({ x: 100, y: 50, width: 800, height: 600 });
  });
});
