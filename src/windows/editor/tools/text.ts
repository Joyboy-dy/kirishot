// The text tool's decisions (spec J2.1 § 3.2), kept pure so they can be tested.

export type TextPointerAction =
  { type: 'none' } | { type: 'edit'; id: string } | { type: 'create' };

/**
 * What a press or a release does with the text tool. The field opens on the release only: the
 * press's default action gives the focus back to the canvas and would close a field opened then.
 * `endedEdit`: the press closed a field being edited; that click only commits it.
 */
export function textPointer(
  phase: 'down' | 'up',
  hitTextId: string | null,
  endedEdit = false,
): TextPointerAction {
  if (phase === 'down' || endedEdit) return { type: 'none' };
  return hitTextId ? { type: 'edit', id: hitTextId } : { type: 'create' };
}

/** Échap and Ctrl+Entrée end the edit; Entrée alone goes to a new line. */
export function textKey(key: string, ctrl: boolean): 'commit' | null {
  if (key === 'Escape') return 'commit';
  if (key === 'Enter' && ctrl) return 'commit';
  return null;
}
