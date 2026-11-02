import { useState } from 'react';
import { Dialog } from 'radix-ui';
import { t } from '@/i18n';
import type { CloseChoice } from './closing';

type Props = {
  /** Saving before closing: the buttons wait. */
  busy: boolean;
  /** A failed save: the editor stays open with this message. */
  error: string | null;
  onChoice(choice: CloseChoice, dontAsk: boolean): void;
};

/** « Enregistrer les modifications ? » before closing a modified capture (spec J3 § 3.5). */
export function CloseDialog({ busy, error, onChoice }: Props) {
  const [dontAsk, setDontAsk] = useState(false);
  const button =
    'k-press h-8 whitespace-nowrap rounded-lg border px-3 text-[13px] font-medium disabled:opacity-40';
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onChoice('cancel', false)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.45)' }} />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5"
          style={{
            background: 'var(--k-surface)',
            border: '1px solid var(--k-border)',
            boxShadow: '0 24px 56px rgba(0, 0, 0, 0.5)',
            color: 'var(--k-text)',
          }}
          onOpenAutoFocus={(e) => {
            // Enregistrer gets the focus: Entrée saves.
            e.preventDefault();
            (e.currentTarget as HTMLElement)
              .querySelector<HTMLButtonElement>('[data-primary]')
              ?.focus();
          }}
        >
          <Dialog.Title className="m-0 text-[16px] font-semibold">
            {t('editor.close.title')}
          </Dialog.Title>
          <Dialog.Description
            className="mb-4 mt-2 text-[13px]"
            style={{ color: 'var(--k-text-2)' }}
          >
            {t('editor.close.body')}
          </Dialog.Description>
          {error && (
            <p role="alert" className="mb-3 text-[12.5px]" style={{ color: 'var(--k-danger)' }}>
              {error}
            </p>
          )}
          <label className="mb-5 flex cursor-pointer items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={dontAsk}
              onChange={(e) => setDontAsk(e.target.checked)}
              className="h-4 w-4 accent-[var(--k-accent)]"
            />
            {t('editor.close.dontAsk')}
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onChoice('cancel', false)}
              className={button}
              style={{
                background: 'transparent',
                borderColor: 'var(--k-border)',
                color: 'var(--k-text)',
              }}
            >
              {t('editor.close.cancel')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onChoice('discard', dontAsk)}
              className={button}
              style={{
                background: 'transparent',
                borderColor: 'var(--k-border)',
                color: 'var(--k-text)',
              }}
            >
              {t('editor.close.discard')}
            </button>
            <button
              type="button"
              data-primary
              disabled={busy}
              onClick={() => onChoice('save', dontAsk)}
              className={button}
              style={{
                background: 'var(--k-accent)',
                borderColor: 'var(--k-accent)',
                color: 'var(--k-ink)',
              }}
            >
              {t('editor.close.save')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
