import { X } from 'lucide-react';
import { Kbd } from '@/components/ui/Kbd';
import { t } from '@/i18n';
import { SELECTION_SHORTCUTS } from '@/lib/shortcuts';

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
        {SELECTION_SHORTCUTS.map((g) => (
          <section key={g.title}>
            <h3
              className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: 'var(--k-text-3)' }}
            >
              {g.title}
            </h3>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {g.entries.map((entry) => (
                <li key={entry.label} className="flex items-center gap-2 text-[13px]">
                  <span className="flex shrink-0 gap-1">
                    {entry.keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                  <span style={{ color: 'var(--k-text-2)' }}>{entry.label}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
