import { describe, expect, it } from 'vitest';
import { t } from './index';

describe('t', () => {
  it('interpolates variables', () =>
    expect(t('overlay.windowLabel', { title: 'Notes', w: 390, h: 452 })).toBe('Notes · 390 × 452'));

  it('returns plain texts as is', () => expect(t('overlay.zone')).toBe('Zone'));
});

describe('capture settings texts', () => {
  it('exist for every control of the section', async () => {
    const fr = (await import('./fr.json')).default as Record<string, string>;
    const keys = [
      'settings.capture',
      'settings.magnifier',
      'settings.sound',
      'settings.flash',
      'settings.thumbnail',
      'settings.thumbnailDuration',
      'settings.duration.3',
      'settings.duration.6',
      'settings.duration.10',
      'settings.duration.untilClosed',
      'settings.alwaysOpenEditor',
    ];
    expect(keys.filter((k) => !(k in fr))).toEqual([]);
  });
});
