// What a card shows, apart from React.
import type { ThumbStatus } from '@/lib/ipc';
import { t } from '@/i18n';
import { tick, type Clock } from './countdown';
import type { StackCard } from './stack';

export type CardState = {
  card: StackCard;
  clock: Clock;
  status: ThumbStatus | null;
  leaving: boolean;
};

/** The footer line: what happened, or what will happen when the countdown ends. */
export function footerText(state: CardState): string {
  const { card, clock, status } = state;
  if (status?.kind === 'failed') return t('thumb.failed', { message: status.message });
  if (status?.kind === 'saved') return card.copied ? t('thumb.savedAndCopied') : t('thumb.saved');
  if (status?.kind === 'copied') return t('thumb.copied');
  if (card.action === 'copy') return card.copied ? t('thumb.copied') : t('thumb.waiting');
  if (clock.total === null) return card.copied ? t('thumb.copiedNotSaved') : t('thumb.waiting');
  const s = Math.ceil(clock.left / 1000);
  return card.copied ? t('thumb.copiedSavingIn', { s }) : t('thumb.savingIn', { s });
}

/**
 * Advances the visible cards' clocks. Pure, so the caller learns which cards expired before it
 * hands the new state to React (a state updater may run later, or twice).
 */
export function tickAll(
  cards: Record<string, CardState>,
  ids: string[],
  dtMs: number,
): { cards: Record<string, CardState>; expired: string[] } {
  const next = { ...cards };
  const expired: string[] = [];
  for (const id of ids) {
    const c = next[id];
    if (!c || c.leaving) continue;
    const r = tick(c.clock, dtMs);
    if (r.expiredNow) expired.push(id);
    next[id] = { ...c, clock: r.clock };
  }
  return { cards: next, expired };
}

/** Opening the editor first, then removing the card: the close must follow the edit. */
export async function editThenLeave(edit: Promise<unknown>, leave: () => void): Promise<void> {
  try {
    await edit;
  } finally {
    leave();
  }
}
