import { describe, expect, it } from 'vitest';
import { TIP_DELAY_MS, tipGate } from './tipGate';

describe('tipGate', () => {
  it('a hover opens the tip', () => {
    const g = tipGate();
    g.pointer();
    expect(g.allow(true)).toBe(true);
  });

  it('a focus given by a menu opening, or returned to its trigger, opens nothing', () => {
    const g = tipGate();
    g.focus(false);
    expect(g.allow(true)).toBe(false);
  });

  it('a keyboard focus opens the tip', () => {
    const g = tipGate();
    g.focus(true);
    expect(g.allow(true)).toBe(true);
  });

  it('hovering after a silent focus opens it again', () => {
    const g = tipGate();
    g.focus(false);
    g.pointer();
    expect(g.allow(true)).toBe(true);
  });

  it('closing is always allowed', () => {
    const g = tipGate();
    g.focus(false);
    expect(g.allow(false)).toBe(true);
  });

  it('waits long enough not to flash under a passing pointer', () => {
    expect(TIP_DELAY_MS).toBe(600);
  });
});
