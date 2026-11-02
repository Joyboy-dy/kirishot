import { useEffect, useRef, useState } from 'react';
import { commands } from '@/lib/ipc';
import { t } from '@/i18n';
import { insertToken, NAME_TOKENS } from './settingsModel';

/** The file-name template, with token chips and a live preview (spec J3 § 4.4). */
export function NameTemplate({
  value,
  onChange,
}: {
  value: string;
  onChange(template: string): void;
}) {
  const [draft, setDraft] = useState(value);
  const [preview, setPreview] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let current = true;
    void commands.previewName(draft).then((r) => {
      if (current && r.status === 'ok') setPreview(r.data);
    });
    return () => {
      current = false;
    };
  }, [draft]);

  const commit = (next: string) => {
    if (next.trim() && next !== value) onChange(next);
  };

  return (
    <div className="flex w-[340px] flex-col gap-2">
      <input
        ref={input}
        value={draft}
        aria-label={t('settings.nameTemplate')}
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(draft);
        }}
        className="h-9 rounded-lg border px-3 text-[13px] outline-none focus:border-[var(--k-accent)]"
        style={{
          background: 'var(--k-surface-2)',
          borderColor: draft.trim() ? 'var(--k-border)' : 'var(--k-danger)',
          color: 'var(--k-text)',
        }}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {NAME_TOKENS.map((token) => (
          <button
            key={token}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const el = input.current;
              const next = insertToken(draft, el?.selectionStart ?? draft.length, token);
              setDraft(next.value);
              commit(next.value);
              requestAnimationFrame(() => el?.setSelectionRange(next.caret, next.caret));
            }}
            className="k-press h-6 rounded-md border px-2 font-mono text-[11.5px] hover:bg-white/5"
            style={{
              borderColor: 'var(--k-border)',
              background: 'transparent',
              color: 'var(--k-text-2)',
            }}
          >
            {token}
          </button>
        ))}
      </div>
      <span className="truncate text-[12px]" style={{ color: 'var(--k-text-3)' }}>
        {t('settings.namePreview', { name: preview })}
      </span>
    </div>
  );
}
