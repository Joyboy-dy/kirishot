import { describe, expect, it } from 'vitest';
import { flashPlan } from './flash';

describe('flashPlan', () => {
  it('no flash when reduced motion or disabled', () => {
    expect(flashPlan(true, true).duration).toBe(0);
    expect(flashPlan(false, false).duration).toBe(0);
  });
  it('a 120 ms flash otherwise', () => expect(flashPlan(false, true).duration).toBe(120));
});
