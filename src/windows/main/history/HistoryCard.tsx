import { useEffect, useState, type ReactNode } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Copy, FolderOpen, PenLine, Trash2 } from 'lucide-react';
import { Tip } from '@/components/ui/Tip';
import { commands, type HistoryEntry } from '@/lib/ipc';
import { t } from '@/i18n';
import { fileNameOf } from './model';

function Action(p: { label: string; onClick(): void; danger?: boolean; children: ReactNode }) {
  return (
    <Tip label={p.label}>
      <button
        type="button"
        aria-label={p.label}
        onClick={p.onClick}
        className="k-press flex h-8 w-8 items-center justify-center rounded-lg border-0"
        style={{
          background: 'rgba(14, 16, 20, 0.82)',
          color: p.danger ? '#ff8a7a' : '#eceef2',
          backdropFilter: 'blur(8px)',
        }}
      >
        {p.children}
      </button>
    </Tip>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: 'var(--k-surface-3)', color: 'var(--k-text-2)' }}
    >
      {children}
    </span>
  );
}

/** One capture of the history; its actions show on hover and on keyboard focus. */
export function HistoryCard({
  entry,
  onError,
}: {
  entry: HistoryEntry;
  onError(message: string): void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    let current = true;
    void commands.historyThumbPath(entry.id).then((r) => {
      if (current && r.status === 'ok') setSrc(convertFileSrc(r.data));
    });
    return () => {
      current = false;
    };
  }, [entry.id, entry.bytes]);

  const run = (p: Promise<{ status: 'ok' | 'error'; error?: { message: string } }>) =>
    void p.then((r) => {
      if (r.status === 'error' && r.error) onError(r.error.message);
    });
  const time = new Date(entry.createdAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const name = fileNameOf(entry);

  return (
    <article
      tabIndex={0}
      aria-label={t('history.card', { time, w: entry.size.w, h: entry.size.h })}
      className="group flex flex-col overflow-hidden rounded-xl outline-none focus-visible:ring-2"
      style={{ background: 'var(--k-surface)', border: '1px solid var(--k-border)' }}
    >
      <div
        className="relative flex aspect-[16/10] items-center justify-center overflow-hidden"
        style={{ background: 'var(--k-surface-2)' }}
      >
        {src && (
          <img
            src={src}
            alt=""
            className="h-full w-full object-contain"
            draggable={false}
            onError={() => setSrc(null)}
          />
        )}
        <div className="absolute inset-x-0 top-0 flex justify-end gap-1 p-2 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
          {confirming ? (
            <span
              className="flex items-center gap-1 rounded-lg p-1 text-[12px]"
              style={{ background: 'rgba(14, 16, 20, 0.88)', color: '#eceef2' }}
            >
              <span className="px-1">{t('history.deleteConfirm')}</span>
              <button
                type="button"
                className="k-press h-7 rounded-md border-0 px-2 text-[12px] font-semibold"
                style={{ background: 'var(--k-danger)', color: '#fff' }}
                onClick={() => run(commands.historyDelete(entry.id))}
              >
                {t('history.delete')}
              </button>
              <button
                type="button"
                className="k-press h-7 rounded-md border-0 bg-transparent px-2 text-[12px]"
                style={{ color: '#eceef2' }}
                onClick={() => setConfirming(false)}
              >
                {t('editor.close.cancel')}
              </button>
            </span>
          ) : (
            <>
              <Action label={t('history.copy')} onClick={() => run(commands.historyCopy(entry.id))}>
                <Copy size={15} />
              </Action>
              <Action label={t('history.edit')} onClick={() => run(commands.historyEdit(entry.id))}>
                <PenLine size={15} />
              </Action>
              {entry.savedPath && (
                <Action
                  label={t('history.reveal')}
                  onClick={() => run(commands.historyReveal(entry.id))}
                >
                  <FolderOpen size={15} />
                </Action>
              )}
              <Action label={t('history.delete')} danger onClick={() => setConfirming(true)}>
                <Trash2 size={15} />
              </Action>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-medium">{time}</span>
          <span className="font-mono text-[11.5px]" style={{ color: 'var(--k-text-3)' }}>
            {entry.size.w} × {entry.size.h}
          </span>
        </div>
        {(name || entry.source.windowTitle) && (
          <span className="truncate text-[12px]" style={{ color: 'var(--k-text-2)' }}>
            {name || entry.source.windowTitle}
          </span>
        )}
        <div className="flex flex-wrap gap-1">
          {entry.savedPath && <Badge>{t('history.badge.saved')}</Badge>}
          {entry.copied && <Badge>{t('history.badge.copied')}</Badge>}
          {entry.annotated && <Badge>{t('history.badge.annotated')}</Badge>}
        </div>
      </div>
    </article>
  );
}
