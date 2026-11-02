import { describe, expect, it } from 'vitest';
import { isDrag, withTimeout } from './drag';

describe('isDrag', () => {
  it('a small move is still a click', () =>
    expect(isDrag({ x: 0, y: 0 }, { x: 4, y: 4 })).toBe(false));
  it('past 6 px it is a drag', () => expect(isDrag({ x: 0, y: 0 }, { x: 5, y: 5 })).toBe(true));
});

describe('withTimeout', () => {
  it('gives up on a promise that never settles', async () =>
    expect(await withTimeout(new Promise(() => {}), 10)).toBe('timeout'));
  it('passes a value through', async () =>
    expect(await withTimeout(Promise.resolve(3), 50)).toBe(3));
});
