// Undo and redo over immutable documents (spec v1 § 7.2: 200 steps at most).
import type { Doc } from './document';

export type History = { past: Doc[]; present: Doc; future: Doc[] };

export const init = (present: Doc): History => ({ past: [], present, future: [] });

export function commit(h: History, next: Doc, limit = 200): History {
  if (next === h.present) return h;
  return { past: [...h.past, h.present].slice(-limit), present: next, future: [] };
}

export function undo(h: History): History {
  const previous = h.past.at(-1);
  if (!previous) return h;
  return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future] };
}

export function redo(h: History): History {
  const [next, ...future] = h.future;
  if (!next) return h;
  return { past: [...h.past, h.present], present: next, future };
}

/** A live change (a slider being dragged): the present moves, the history does not. */
export function preview(h: History, next: Doc): History {
  return { ...h, present: next };
}

/** Ends a live change started from `base`: the whole change is one undo step. */
export function settle(h: History, base: Doc, limit = 200): History {
  if (base === h.present) return h;
  return { past: [...h.past, base].slice(-limit), present: h.present, future: [] };
}
