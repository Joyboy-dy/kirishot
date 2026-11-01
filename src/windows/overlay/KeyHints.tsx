import { t, type MessageKey } from '@/i18n';

const HINTS = ['drag', 'click', 'shift', 'arrows', 'enter', 'escape'] as const;

/** Keyboard and mouse reminders at the bottom of the active monitor. */
export function KeyHints() {
  return (
    <div
      className="pointer-events-none absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-full px-4 py-2 text-[12px]"
      style={{
        background: 'var(--k-glass)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--k-border)',
        color: 'var(--k-text-2)',
      }}
    >
      {HINTS.map((hint) => (
        <span key={hint} className="flex items-center gap-1.5 whitespace-nowrap">
          <kbd
            className="rounded-md px-1.5 py-0.5 font-mono text-[11px]"
            style={{
              background: 'var(--k-surface-3)',
              border: '1px solid var(--k-border)',
              borderBottomWidth: 2,
              color: 'var(--k-text)',
            }}
          >
            {t(`hint.${hint}.key` as MessageKey)}
          </kbd>
          {t(`hint.${hint}.action` as MessageKey)}
        </span>
      ))}
    </div>
  );
}
