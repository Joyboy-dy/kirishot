// How long the export buttons and the status bar show their result (spec J2.1 § 4.2).

export const FEEDBACK = {
  spinnerAfterMs: 300,
  checkMs: 1500,
  closeDelayMs: 400,
  messageMs: 4000,
};

export type ButtonState = { phase: 'busy' | 'done' | 'idle'; since: number };

/** What an export button shows at `now`: its icon, a spinner on a long export, or a check. */
export function buttonView(state: ButtonState, now: number): 'icon' | 'spinner' | 'check' {
  const elapsed = now - state.since;
  if (state.phase === 'busy') return elapsed >= FEEDBACK.spinnerAfterMs ? 'spinner' : 'icon';
  if (state.phase === 'done') return elapsed < FEEDBACK.checkMs ? 'check' : 'icon';
  return 'icon';
}

/** A success message fades after a few seconds; an error stays until the next action. */
export function messageVisible(m: { error: boolean; at: number } | null, now: number): boolean {
  if (!m) return false;
  return m.error || now - m.at < FEEDBACK.messageMs;
}

/** « Copier et fermer » closes after the check only if no other capture arrived meanwhile. */
export function closeAfterCopy(copiedId: string, shownId: string | null): boolean {
  return copiedId === shownId;
}
