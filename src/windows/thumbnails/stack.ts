// The cards on screen and the ones waiting for room (spec J2 § 3.4). Newest last = bottom.
import type { ThumbnailPushed } from '@/lib/ipc';

export type StackCard = ThumbnailPushed;
export type Stack = { visible: StackCard[]; queued: StackCard[] };

export const MAX_VISIBLE = 3;
export const empty: Stack = { visible: [], queued: [] };

export function push(s: Stack, card: StackCard, max = MAX_VISIBLE): Stack {
  return s.visible.length < max
    ? { ...s, visible: [...s.visible, card] }
    : { ...s, queued: [...s.queued, card] };
}

/** A visible card that leaves is replaced by the oldest waiting one. */
export function remove(s: Stack, id: string): Stack {
  if (s.queued.some((c) => c.id === id)) {
    return { ...s, queued: s.queued.filter((c) => c.id !== id) };
  }
  if (!s.visible.some((c) => c.id === id)) return s;
  const [next, ...queued] = s.queued;
  const visible = s.visible.filter((c) => c.id !== id);
  return { visible: next ? [...visible, next] : visible, queued };
}

/** A card's size in CSS pixels; mirrors `card_size` in `src-tauri/src/thumbnails/layout.rs`. */
export function cardSize(w: number, h: number): { width: number; height: number } {
  const height = (240 * h) / Math.max(w, 1);
  if (height > 180) return { width: (180 * w) / Math.max(h, 1), height: 180 };
  return { width: 240, height: Math.max(height, 60) };
}
