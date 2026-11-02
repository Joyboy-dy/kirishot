import { describe, expect, it } from 'vitest';
import { decodeFrame, pixelHex } from './frame';

describe('decodeFrame', () => {
  it('reads the size header', () => {
    const buf = new Uint8Array([2, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 255, 4, 5, 6, 255]).buffer;
    const f = decodeFrame(buf);
    expect([f.width, f.height, f.pixels.length, f.pixels[4]]).toEqual([2, 1, 8, 4]);
  });

  it('rejects a truncated buffer', () =>
    expect(() => decodeFrame(new Uint8Array([2, 0, 0, 0, 1, 0, 0, 0, 1]).buffer)).toThrow());
});

describe('pixelHex', () => {
  const f = decodeFrame(
    new Uint8Array([2, 0, 0, 0, 1, 0, 0, 0, 0xcf, 0xd4, 0xdc, 255, 0, 0, 0, 255]).buffer,
  );
  it('reads a pixel', () => expect(pixelHex(f, { x: 0, y: 0 })).toBe('CFD4DC'));
  it('clamps outside the frame', () => expect(pixelHex(f, { x: 9, y: 9 })).toBe('000000'));
});
