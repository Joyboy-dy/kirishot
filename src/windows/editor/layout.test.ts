import { describe, expect, it } from 'vitest';
import { toolbarLayout } from './layout';

describe('toolbarLayout', () => {
  it('follows the spec breakpoints', () => {
    expect(toolbarLayout(1100)).toBe('full');
    expect(toolbarLayout(1099)).toBe('compact');
    expect(toolbarLayout(760)).toBe('compact');
    expect(toolbarLayout(759)).toBe('narrow');
    expect(toolbarLayout(520)).toBe('narrow');
  });
});
