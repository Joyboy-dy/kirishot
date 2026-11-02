// What a card shows, apart from React.
import type { ThumbStatus } from '@/lib/ipc';
import { t } from '@/i18n';
import type { Clock } from './countdown';
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
