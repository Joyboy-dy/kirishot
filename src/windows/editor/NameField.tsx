import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { t } from '@/i18n';
import { splitName } from './fileName';

type Props = {
  /** The file name (`name.png`): the saved file's, or the one a first save will use. */
  name: string;
  /** No file yet: the name is shown dimmed. */
  pending: boolean;
  /** Opened from outside (F2). */
  editing: boolean;
  onEditing(on: boolean): void;
  /** Renames; resolves to an error message, or `null` when done. */
  onRename(stem: string): Promise<string | null>;
};

/** The capture's file name in the status bar, renamed in place (spec J3 § 3.3). */
export function NameField(p: Props) {
  const { stem, ext } = splitName(p.name);
  const [value, setValue] = useState(stem);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!p.editing) return;
    const el = input.current;
    el?.focus();
    el?.select();
  }, [p.editing]);

  const start = () => {
    setValue(stem);
    setError(null);
    p.onEditing(true);
  };
  const stop = () => {
    setError(null);
    p.onEditing(false);
  };
  const submit = async () => {
    const next = value.trim();
    if (next === stem) return stop();
    const failed = await p.onRename(next);
    if (failed) setError(failed);
    else stop();
  };

  if (!p.editing)
    return (
      <button
        type="button"
        onClick={start}
        title={t('editor.renameHint')}
        className="k-press group flex min-w-0 max-w-[40%] shrink items-center gap-1.5 rounded-md border-0 bg-transparent px-1.5 py-0.5 text-[12.5px] hover:bg-white/10"
        style={{ color: p.pending ? 'var(--k-text-3)' : 'var(--k-text)' }}
      >
        <span className="truncate">{p.name}</span>
        <Pencil size={12} className="shrink-0 opacity-0 group-hover:opacity-70" aria-hidden />
      </button>
    );

  return (
    <span className="relative flex min-w-0 max-w-[50%] shrink items-center">
      <input
        ref={input}
        value={value}
        aria-label={t('editor.rename')}
        aria-invalid={error !== null}
        spellCheck={false}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') void submit();
          if (e.key === 'Escape') stop();
        }}
        onBlur={() => void submit()}
        className="h-6 min-w-0 flex-1 rounded-md border px-1.5 text-[12.5px] outline-none"
        style={{
          background: 'var(--k-surface-2)',
          color: 'var(--k-text)',
          borderColor: error ? 'var(--k-danger)' : 'var(--k-accent)',
        }}
      />
      <span className="shrink-0 pl-1 text-[12.5px]" style={{ color: 'var(--k-text-3)' }}>
        {ext}
      </span>
      {error && (
        <span
          role="alert"
          className="absolute bottom-full left-0 mb-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[12px]"
          style={{
            background: 'var(--k-surface-3)',
            color: 'var(--k-danger)',
            border: '1px solid var(--k-border)',
          }}
        >
          {error}
        </span>
      )}
    </span>
  );
}
