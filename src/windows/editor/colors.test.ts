import { describe, expect, it } from 'vitest';
import { normalizeHex, pixelColor, pushRecent } from './colors';

describe('custom colours', () => {
  it('puts the newest colour first, upper case', () => {
    expect(pushRecent(['#111111'], '#ff5b38')).toEqual(['#FF5B38', '#111111']);
  });

  it('moves an existing colour to the front instead of repeating it', () => {
    expect(pushRecent(['#AAAAAA', '#BBBBBB'], '#bbbbbb')).toEqual(['#BBBBBB', '#AAAAAA']);
  });

  it('keeps eight colours', () => {
    const nine = Array.from({ length: 8 }, (_, i) => `#00000${i}`);
    expect(pushRecent(nine, '#FFFFFF')).toHaveLength(8);
    expect(pushRecent(nine, '#FFFFFF')[0]).toBe('#FFFFFF');
  });

  it('reads the hex forms people type', () => {
    expect(normalizeHex('abc')).toBe('#AABBCC');
    expect(normalizeHex('#a1b2c3')).toBe('#A1B2C3');
    expect(normalizeHex(' 123456 ')).toBe('#123456');
    expect(normalizeHex('#12345')).toBeNull();
    expect(normalizeHex('zzzzzz')).toBeNull();
  });
});

describe('pixelColor', () => {
  // 2 × 1 pixels: red, then a half-transparent blue.
  const pixels = {
    width: 2,
    height: 1,
    data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 128]),
  };

  it('reads the pixel under the point, as #RRGGBB', () => {
    expect(pixelColor(pixels, { x: 0.2, y: 0.9 })).toBe('#FF0000');
    expect(pixelColor(pixels, { x: 1.7, y: 0 })).toBe('#0000FF');
  });

  it('outside the image there is no colour', () => {
    expect(pixelColor(pixels, { x: -0.1, y: 0 })).toBeNull();
    expect(pixelColor(pixels, { x: 2, y: 0 })).toBeNull();
    expect(pixelColor(pixels, { x: 0, y: 1 })).toBeNull();
  });
});
