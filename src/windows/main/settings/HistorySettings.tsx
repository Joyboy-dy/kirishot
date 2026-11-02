import { useState } from 'react';
import { Dialog } from 'radix-ui';
import { FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { commands, type Retention } from '@/lib/ipc';
import { NO_CHANGE } from '@/lib/settings';
import { t } from '@/i18n';
import type { useSettings } from '../useSettings';
import { Choice, Row, Section } from './Layout';

const KEEP = ['7', '30', '90', 'forever'] as const;
type Keep = (typeof KEEP)[number];

function toRetention(v: Keep): Retention {
  return v === 'forever' ? { kind: 'forever' } : { kind: 'days', value: Number(v) };
}

type Settings = ReturnType<typeof useSettings>;

/** Réglages › Historique: how long captures stay, the folder, emptying it (spec J3 § 4.4). */
export function HistorySettings({
  view,
  update,
}: Pick<Settings, 'update'> & { view: NonNullable<Settings['view']> }) {
  const [clearing, setClearing] = useState(false);
  const days = view.settings.history.retentionDays;
  const keep: Keep = days === null ? 'forever' : (String(days) as Keep);
  return (
    <Section title={t('main.history')}>
      <Row label={t('settings.retention')} hint={t('settings.retention.hint')}>
        <Choice
          label={t('settings.retention')}
          value={keep}
          options={KEEP.map((k) => ({
            value: k,
            label: k === 'forever' ? t('settings.retention.forever') : t('history.days', { n: k }),
          }))}
          onChange={(k) => void update({ ...NO_CHANGE, retention: toRetention(k) })}
        />
      </Row>
      <Row label={t('settings.historyFolder')} hint={t('settings.historyFolder.hint')}>
        <Button variant="secondary" onClick={() => void commands.historyOpenFolder()}>
          <FolderOpen size={16} strokeWidth={1.9} />
          {t('settings.open')}
        </Button>
        <Button variant="secondary" onClick={() => setClearing(true)}>
          {t('history.clear')}
        </Button>
      </Row>
      {clearing && (
        <Dialog.Root open onOpenChange={(open) => !open && setClearing(false)}>
          <Dialog.Portal>
            <Dialog.Overlay
              className="fixed inset-0 z-50"
              style={{ background: 'rgba(0,0,0,0.45)' }}
            />
            <Dialog.Content
              className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5"
              style={{
                background: 'var(--k-surface)',
                border: '1px solid var(--k-border)',
                color: 'var(--k-text)',
              }}
            >
              <Dialog.Title className="m-0 text-[16px] font-semibold">
                {t('history.clearTitle')}
              </Dialog.Title>
              <Dialog.Description
                className="mb-5 mt-2 text-[13px]"
                style={{ color: 'var(--k-text-2)' }}
              >
                {t('history.clearBody')}
              </Dialog.Description>
              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Button variant="secondary">{t('editor.close.cancel')}</Button>
                </Dialog.Close>
                <button
                  type="button"
                  className="k-press h-9 rounded-lg border-0 px-3 text-[13px] font-semibold"
                  style={{ background: 'var(--k-danger)', color: '#fff' }}
                  onClick={() => {
                    setClearing(false);
                    void commands.historyClear();
                  }}
                >
                  {t('history.clearConfirm')}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </Section>
  );
}
