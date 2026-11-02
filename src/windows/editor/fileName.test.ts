import { describe, expect, it } from 'vitest';
import { baseName, splitName } from './fileName';

describe('file names', () => {
  it('splits the stem from the extension', () => {
    expect(splitName('Kirishot 2026-11-02 à 14.32.05.png')).toEqual({
      stem: 'Kirishot 2026-11-02 à 14.32.05',
      ext: '.png',
    });
    expect(splitName('sans extension')).toEqual({ stem: 'sans extension', ext: '' });
  });

  it('takes the name out of a Windows path', () => {
    expect(baseName('C:\\Users\\me\\Pictures\\Kirishot\\a.png')).toBe('a.png');
    expect(baseName('a.png')).toBe('a.png');
  });
});
