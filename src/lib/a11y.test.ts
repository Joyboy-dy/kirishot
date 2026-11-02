import { describe, expect, it } from 'vitest';
import { shortcutAria } from './a11y';

describe('shortcutAria', () => {
  it('keeps a single letter', () => expect(shortcutAria(['R'])).toBe('R'));
  it('maps French modifier names', () =>
    expect(shortcutAria(['Ctrl', 'Maj', 'S'])).toBe('Control+Shift+S'));
  it('maps French key names', () => {
    expect(shortcutAria(['Échap'])).toBe('Escape');
    expect(shortcutAria(['Entrée'])).toBe('Enter');
    expect(shortcutAria(['Espace'])).toBe('Space');
    expect(shortcutAria(['Suppr'])).toBe('Delete');
  });
});
