import { describe, expect, it } from 'vitest';
import { nextSave } from './autosave';

describe('nextSave', () => {
  it('waits one second after the last change', () => {
    expect(nextSave(1500, 1000, true)).toBe(false);
    expect(nextSave(2000, 1000, true)).toBe(true);
  });
  it('never saves when nothing changed', () => expect(nextSave(9000, 1000, false)).toBe(false));
});
