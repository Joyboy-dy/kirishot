import { describe, expect, it } from 'vitest';
import { dashFor } from './dash';

describe('dashFor', () => {
  it('solid has no pattern', () => {
    expect(dashFor('solid', 4)).toBeUndefined();
  });

  it('dashes are 3w long with 2w gaps', () => {
    expect(dashFor('dashed', 4)).toEqual([12, 8]);
  });

  it('dots are zero-length dashes, made round by the caps', () => {
    expect(dashFor('dotted', 4)).toEqual([0, 8]);
  });
});
