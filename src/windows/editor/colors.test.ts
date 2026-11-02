import { describe, expect, it } from 'vitest';
import { hasEyeDropper, normalizeHex, pushRecent } from './colors';

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

  it('detects the eyedropper', () => {
    expect(hasEyeDropper({} as Window)).toBe(false);
    expect(hasEyeDropper({ EyeDropper: class {} } as unknown as Window)).toBe(true);
  });
});
