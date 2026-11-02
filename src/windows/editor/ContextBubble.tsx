import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowUpToLine, Trash2 } from 'lucide-react';
import { Tip } from '@/components/ui/Tip';
import type { Annotation, Rect } from '@/editor/document';
import { t } from '@/i18n';
import { bubblePlacement } from './bubble';
import { StyleControls } from './StylePopover';
import { optionsFor, type StylePatch } from './tools/options';

type Props = {
  selected: Annotation[];
  /** The selection's bounds, in CSS pixels of the canvas area. */
  sel: Rect;
  area: { width: number; height: number };
  value: StylePatch;
  onStyle(patch: StylePatch): void;
  onFront(): void;
  onBack(): void;
  onDelete(): void;
};

function Action(p: { label: string; onClick(): void; children: ReactNode }) {
  return (
    <Tip label={p.label} side="top">
      <button
        type="button"
        aria-label={p.label}
        onClick={p.onClick}
        className="k-press flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent px-1.5 hover:bg-white/10"
        style={{ color: 'var(--k-text)' }}
      >
        {p.children}
      </button>
    </Tip>
  );
}

/**
 * Settings of the selection, next to it (spec J2.1 § 3.2): only the options every selected
 * annotation has, and always fully inside the canvas area.
 */
export function ContextBubble(p: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ width: el.offsetWidth, height: el.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const options = optionsFor(p.selected);
  const at = size ? bubblePlacement(p.sel, size, p.area) : null;
  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={t('editor.selection')}
      // Wider than the area: the controls go to a second line instead of being cut.
      className="absolute z-10 flex flex-wrap items-center gap-0.5 rounded-xl p-1"
      style={{
        left: at?.x ?? 0,
        top: at?.y ?? 0,
        maxWidth: Math.max(0, p.area.width - 16),
        visibility: at ? 'visible' : 'hidden',
        background: 'var(--k-glass)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--k-border)',
        boxShadow: '0 10px 28px rgba(0, 0, 0, 0.4)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {options.length > 0 && (
        <>
          <StyleControls options={options} value={p.value} onChange={p.onStyle} />
          <span className="mx-1 h-5 w-px shrink-0" style={{ background: 'var(--k-border)' }} />
        </>
      )}
      <Action label={t('editor.front')} onClick={p.onFront}>
        <ArrowUpToLine size={15} />
      </Action>
      <Action label={t('editor.back')} onClick={p.onBack}>
        <ArrowDownToLine size={15} />
      </Action>
      <Action label={t('editor.delete')} onClick={p.onDelete}>
        <Trash2 size={15} />
      </Action>
    </div>
  );
}
