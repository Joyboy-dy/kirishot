import { describe, expect, it } from 'vitest';
import { pause, resume, start, tick } from './countdown';

describe('countdown', () => {
  it('expires once', () => {
    let r = tick(start(6000), 6000);
    expect(r.expiredNow).toBe(true);
    r = tick(r.clock, 1000);
    expect(r.expiredNow).toBe(false);
    expect(r.clock.expired).toBe(true);
  });

  it('counts down', () => expect(tick(start(6000), 1500).clock.left).toBe(4500));

  it('pause freezes the time left', () => {
    const c = pause(tick(start(6000), 1000).clock);
    expect(tick(c, 10_000).clock.left).toBe(5000);
    expect(tick(resume(c), 1000).clock.left).toBe(4000);
  });

  it('null duration never expires', () => expect(tick(start(null), 1e9).expiredNow).toBe(false));
});
