import { describe, expect, it } from 'vitest';
import { t } from './index';

describe('t', () => {
  it('interpolates variables', () =>
    expect(t('overlay.windowLabel', { title: 'Notes', w: 390, h: 452 })).toBe('Notes · 390 × 452'));

  it('returns plain texts as is', () => expect(t('overlay.zone')).toBe('Zone'));
});
