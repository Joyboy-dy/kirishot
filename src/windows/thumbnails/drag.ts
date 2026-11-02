// Dragging a card out as a file (spec J2 § 3.2).
import type { Point } from '@/lib/geometry';

/** Past `threshold` CSS pixels a press on the card is a drag, not a click. */
export function isDrag(from: Point, to: Point, threshold = 6): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) > threshold;
}

/** Resolves to `'timeout'` when `p` takes longer than `ms`, so the card never stays frozen. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve('timeout'), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}
