import { Minus, Plus } from 'lucide-react';
import { Tip } from '@/components/ui/Tip';
import { t } from '@/i18n';

type Props = {
  width: number;
  height: number;
  annotations: number;
  zoom: number;
  message: { text: string; error: boolean } | null;
  onZoomIn(): void;
  onZoomOut(): void;
  onFit(): void;
};

/** Dimensions, annotation count, zoom; and the result of the last export. */
export function StatusBar(p: Props) {
  return (
    <footer
      className="flex h-9 shrink-0 items-center gap-4 px-4 text-[12.5px]"
      style={{ borderTop: '1px solid var(--k-border)', color: 'var(--k-text-2)' }}
    >
      <span className="font-mono">
        {p.width} × {p.height}
      </span>
      <span>{t('editor.annotations', { n: p.annotations })}</span>
      <span
        role="status"
        aria-live="polite"
        className="flex-1 truncate"
        style={{ color: p.message?.error ? 'var(--k-danger)' : 'var(--k-text-2)' }}
      >
        {p.message?.text}
      </span>
      <div className="flex items-center gap-1">
        <Tip label={t('editor.zoomOut')} keys={['Ctrl', '−']} side="top">
          <button
            type="button"
            onClick={p.onZoomOut}
            className="k-press flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent hover:bg-white/10"
            style={{ color: 'var(--k-text)' }}
          >
            <Minus size={14} />
          </button>
        </Tip>
        <span className="w-12 text-center font-mono">{Math.round(p.zoom * 100)} %</span>
        <Tip label={t('editor.zoomIn')} keys={['Ctrl', '+']} side="top">
          <button
            type="button"
            onClick={p.onZoomIn}
            className="k-press flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent hover:bg-white/10"
            style={{ color: 'var(--k-text)' }}
          >
            <Plus size={14} />
          </button>
        </Tip>
        <Tip label={t('editor.fit')} keys={['Ctrl', '0']} side="top">
          <button
            type="button"
            onClick={p.onFit}
            className="k-press h-7 rounded-md border-0 bg-transparent px-2 hover:bg-white/10"
            style={{ color: 'var(--k-text)' }}
          >
            {t('editor.fit')}
          </button>
        </Tip>
      </div>
    </footer>
  );
}
