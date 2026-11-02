import { describe, expect, it } from 'vitest';
import { DEFAULT_ROUTE, navItems } from './routes';

describe('main window routes', () => {
  it('lists Historique, Raccourcis and Réglages, opening on Historique', () => {
    expect(navItems().map((i) => i.route)).toEqual(['history', 'shortcuts', 'settings']);
    expect(DEFAULT_ROUTE).toBe('history');
  });
});
