import { useEffect, useState } from 'react';
import { Dialog } from 'radix-ui';
import { ImageOff, Search } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Kbd } from '@/components/ui/Kbd';
import { commands, events, type HistoryEntry } from '@/lib/ipc';
import { t, type MessageKey } from '@/i18n';
import { Page } from '../Page';
import { useSettings } from '../useSettings';
import { HistoryCard } from './HistoryCard';
import { FILTERS, filterEntries, formatBytes, groupByDay, type Filter } from './model';

/** Every capture, by day, with search and filters (spec J3 § 4.2). */
export function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const { view } = useSettings();

  useEffect(() => {
    const load = () =>
      void commands.historyList().then((r) => {
        if (r.status === 'ok') setEntries(r.data);
      });
    load();
    const unlisten = events.historyChanged.listen(load);
    return () => void unlisten.then((stop) => stop());
  }, []);

  const shown = entries ? filterEntries(entries, filter, query) : [];
  const groups = groupByDay(shown, new Date());
  const total = entries?.reduce((sum, e) => sum + (e.bytes ?? 0), 0) ?? 0;
  const days = view?.settings.history.retentionDays;
  const kept =
    days === undefined ? '' : days === null ? t('history.forever') : t('history.days', { n: days });
  const shortcut = view?.settings.shortcuts.region ?? null;

  return (
    <Page
      title={t('main.history')}
      actions={
        entries && entries.length > 0 ? (
          <label
            className="flex h-9 w-72 items-center gap-2 rounded-lg border px-3"
            style={{ borderColor: 'var(--k-border)', background: 'var(--k-surface)' }}
          >
            <Search size={15} style={{ color: 'var(--k-text-3)' }} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('history.search')}
              aria-label={t('history.search')}
              className="min-w-0 flex-1 border-0 bg-transparent text-[13.5px] outline-none"
              style={{ color: 'var(--k-text)' }}
            />
          </label>
        ) : undefined
      }
    >
      {entries && entries.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <ImageOff size={36} style={{ color: 'var(--k-text-3)' }} />
          <p className="m-0 text-[15px] font-medium">{t('history.empty')}</p>
          {shortcut && (
            <p
              className="m-0 flex items-center gap-1.5 text-[13px]"
              style={{ color: 'var(--k-text-2)' }}
            >
              {t('history.emptyHint')}
              {shortcut
                .replace('Super', 'Win')
                .replace('Shift', 'Maj')
                .split('+')
                .map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
            </p>
          )}
        </div>
      )}
      {entries && entries.length > 0 && (
        <>
          <ToggleGroup
            type="single"
            variant="outline"
            value={filter}
            onValueChange={(v) => v && setFilter(v as Filter)}
            className="self-start"
          >
            {FILTERS.map((f) => (
              <ToggleGroupItem
                key={f}
                value={f}
                className="px-3 data-[state=on]:border-[var(--k-accent)] data-[state=on]:bg-[var(--k-accent-soft)] data-[state=on]:text-[var(--k-accent-text)]"
              >
                {t(`history.filter.${f}` as MessageKey)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {error && (
            <p role="alert" className="m-0 text-[13px]" style={{ color: 'var(--k-danger)' }}>
              {error}
            </p>
          )}
          {groups.length === 0 && (
            <p className="m-0 text-[13.5px]" style={{ color: 'var(--k-text-2)' }}>
              {t('history.noMatch')}
            </p>
          )}
          {groups.map((g) => (
            <section key={g.label} className="flex flex-col gap-3">
              <h2
                className="m-0 text-[13px] font-semibold first-letter:uppercase"
                style={{ color: 'var(--k-text-2)' }}
              >
                {g.label}
              </h2>
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
              >
                {g.entries.map((e) => (
                  <HistoryCard key={e.id} entry={e} onError={setError} />
                ))}
              </div>
            </section>
          ))}
          <footer
            className="mt-4 flex items-center justify-between gap-4 pt-5 text-[12.5px]"
            style={{ borderTop: '1px solid var(--k-border)', color: 'var(--k-text-3)' }}
          >
            <span>
              {t('history.footer', { n: entries.length, size: formatBytes(total), kept })}
            </span>
            <button
              type="button"
              onClick={() => setClearing(true)}
              className="k-press h-8 rounded-lg border px-3 text-[12.5px] font-medium"
              style={{
                borderColor: 'var(--k-border)',
                background: 'transparent',
                color: 'var(--k-danger)',
              }}
            >
              {t('history.clear')}
            </button>
          </footer>
        </>
      )}
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
                  <button
                    type="button"
                    className="k-press h-8 rounded-lg border px-3 text-[13px]"
                    style={{
                      borderColor: 'var(--k-border)',
                      background: 'transparent',
                      color: 'var(--k-text)',
                    }}
                  >
                    {t('editor.close.cancel')}
                  </button>
                </Dialog.Close>
                <button
                  type="button"
                  className="k-press h-8 rounded-lg border-0 px-3 text-[13px] font-semibold"
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
    </Page>
  );
}
