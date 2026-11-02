import { X } from 'lucide-react';
import { Kbd } from '@/components/ui/Kbd';
import { t, type MessageKey } from '@/i18n';

type Entry = { keys: string[]; action: MessageKey };

const GROUPS: { title: MessageKey; entries: Entry[] }[] = [
  {
    title: 'sheet.selection',
    entries: [
      { keys: ['Glisser'], action: 'sheet.drag' },
      { keys: ['Maj'], action: 'sheet.shift' },
      { keys: ['Alt'], action: 'sheet.alt' },
      { keys: ['Espace'], action: 'sheet.space' },
      { keys: ['←', '↑', '→', '↓'], action: 'sheet.arrows' },
    ],
  },
  {
    title: 'sheet.modes',
    entries: [
      { keys: ['R'], action: 'sheet.region' },
      { keys: ['W'], action: 'sheet.window' },
      { keys: ['F'], action: 'sheet.fullscreen' },
    ],
  },
  {
    title: 'sheet.magnifier',
    entries: [
      { keys: ['M'], action: 'sheet.loupe' },
      { keys: ['C'], action: 'sheet.color' },
    ],
  },
  {
    title: 'sheet.validate',
    entries: [
      { keys: ['Entrée'], action: 'sheet.enter' },
      { keys: ['Ctrl', 'C'], action: 'sheet.copy' },
      { keys: ['Échap'], action: 'sheet.escape' },
      { keys: ['?'], action: 'sheet.help' },
    ],
  },
];

/** Every shortcut of the selection screen, on demand with « ? » (spec J2.1 § 2.2). */
export function ShortcutSheet({ onClose }: { onClose(): void }) {
  // Clicks inside the sheet must not reach the selection underneath.
  const stop = (e: { stopPropagation(): void }) => e.stopPropagation();
  return (
    <div
      role="dialog"
      aria-label={t('sheet.title')}
      onPointerDown={stop}
      onPointerUp={stop}
      onDoubleClick={stop}
      className="absolute left-1/2 top-1/2 w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5"
      style={{
        background: 'var(--k-glass)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--k-border)',
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.5)',
        color: 'var(--k-text)',
        cursor: 'default',
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="m-0 text-[15px] font-semibold">{t('sheet.title')}</h2>
        <button
          type="button"
          aria-label={t('sheet.close')}
          onClick={onClose}
          className="k-press flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent hover:bg-white/10"
          style={{ color: 'var(--k-text-2)' }}
        >
          <X size={15} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-5">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h3
              className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: 'var(--k-text-3)' }}
            >
              {t(g.title)}
            </h3>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {g.entries.map((entry) => (
                <li key={entry.action} className="flex items-center gap-2 text-[13px]">
                  <span className="flex shrink-0 gap-1">
                    {entry.keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                  <span style={{ color: 'var(--k-text-2)' }}>{t(entry.action)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
