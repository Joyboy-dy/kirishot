// A thumbnail's countdown (spec J2 § 3.3): pure, so a card can be paused on hover and expires once.

export type Clock = { total: number | null; left: number; paused: boolean; expired: boolean };

/** `total` in ms; `null` never expires. */
export function start(total: number | null): Clock {
  return { total, left: total ?? Infinity, paused: false, expired: false };
}

export function tick(c: Clock, dtMs: number): { clock: Clock; expiredNow: boolean } {
  if (c.paused || c.expired || c.total === null) return { clock: c, expiredNow: false };
  const left = Math.max(0, c.left - dtMs);
  const expiredNow = left === 0;
  return { clock: { ...c, left, expired: expiredNow }, expiredNow };
}

export const pause = (c: Clock): Clock => ({ ...c, paused: true });
export const resume = (c: Clock): Clock => ({ ...c, paused: false });
