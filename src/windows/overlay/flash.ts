// The white flash over the captured zone (spec J2 § 2.4).
import type { CommitTarget, OverlaySession, Rect } from '@/lib/ipc';

export const FLASH_MS = 120;

/** How long the flash lasts: none when the setting is off or Windows reduces animations. */
export function flashPlan(reducedMotion: boolean, enabled: boolean): { duration: number } {
  return { duration: enabled && !reducedMotion ? FLASH_MS : 0 };
}

/** The zone the flash covers, in physical pixels of the monitor. */
export function flashRect(target: CommitTarget, session: OverlaySession): Rect {
  if (target.kind === 'region') return target.rect;
  if (target.kind === 'window') {
    const w = session.windows.find((x) => x.index === target.index);
    if (w) return w.bounds;
  }
  return { x: 0, y: 0, width: session.monitor.width, height: session.monitor.height };
}
