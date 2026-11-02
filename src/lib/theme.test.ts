import { describe, expect, it } from 'vitest';
import { resolveTheme } from './theme';

describe('resolveTheme', () => {
  it('follows Windows with « system »', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('keeps a forced theme', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});
