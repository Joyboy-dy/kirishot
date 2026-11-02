import type { ReactNode } from 'react';
import { ArrowDownToLine, ArrowUpToLine, Trash2 } from 'lucide-react';
import { Tip } from '@/components/ui/Tip';
import type { Annotation, Stroke, TextStyle } from '@/editor/document';
import { t } from '@/i18n';

type Props = {
  selected: Annotation[];
  /** Where to show the bubble, in CSS pixels of the canvas area. */
  at: { x: number; y: number };
  onDash(dash: Stroke['dash']): void;
  onOpacity(opacity: number): void;
  onTextStyle(style: TextStyle): void;
  onFront(): void;
  onBack(): void;
  onDelete(): void;
};

function Chip(p: { label: string; active?: boolean; onClick(): void; children: ReactNode }) {
  return (
    <Tip label={p.label} side="top">
      <button
        type="button"
        aria-pressed={p.active}
        onClick={p.onClick}
        className="k-press flex h-7 min-w-7 items-center justify-center rounded-md border-0 px-1.5 text-[12px] hover:bg-white/10"
        style={
          p.active
            ? { background: 'var(--k-accent-soft)', color: 'var(--k-accent-text)' }
            : { background: 'transparent', color: 'var(--k-text)' }
        }
      >
        {p.children}
      </button>
    </Tip>
  );
}

const DASHES: { dash: Stroke['dash']; label: string; sample: string }[] = [
  { dash: 'solid', label: 'editor.dash.solid', sample: '───' },
  { dash: 'dashed', label: 'editor.dash.dashed', sample: '- - -' },
  { dash: 'dotted', label: 'editor.dash.dotted', sample: '···' },
];
const TEXT_STYLES: TextStyle[] = ['plain', 'pill', 'outline'];

/** Settings of the selected annotation, next to it (spec J2 § 4.1). */
export function ContextBubble(p: Props) {
  const one = p.selected.length === 1 ? p.selected[0] : null;
  const stroke = one && 'stroke' in one ? one.stroke : null;
  return (
    <div
      role="toolbar"
      aria-label={t('editor.selection')}
      className="absolute z-10 flex items-center gap-0.5 rounded-xl p-1"
      style={{
        left: p.at.x,
        top: p.at.y,
        transform: 'translateX(-50%)',
        background: 'var(--k-glass)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--k-border)',
        boxShadow: '0 10px 28px rgba(0, 0, 0, 0.4)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {stroke &&
        DASHES.map((d) => (
          <Chip
            key={d.dash}
            label={t(d.label as 'editor.dash.solid')}
            active={stroke.dash === d.dash}
            onClick={() => p.onDash(d.dash)}
          >
            <span className="font-mono">{d.sample}</span>
          </Chip>
        ))}
      {stroke && (
        <label
          className="mx-1 flex items-center gap-1.5 text-[12px]"
          style={{ color: 'var(--k-text-2)' }}
        >
          {t('editor.opacity')}
          <input
            type="range"
            min={20}
            max={100}
            value={Math.round(stroke.opacity * 100)}
            onChange={(e) => p.onOpacity(Number(e.target.value) / 100)}
            className="w-20 accent-[var(--k-accent)]"
          />
        </label>
      )}
      {one?.tool === 'text' &&
        TEXT_STYLES.map((s) => (
          <Chip
            key={s}
            label={t(`editor.textStyle.${s}` as 'editor.textStyle.plain')}
            active={one.style === s}
            onClick={() => p.onTextStyle(s)}
          >
            {t(`editor.textStyle.${s}` as 'editor.textStyle.plain')}
          </Chip>
        ))}
      <span className="mx-1 h-5 w-px" style={{ background: 'var(--k-border)' }} />
      <Chip label={t('editor.front')} onClick={p.onFront}>
        <ArrowUpToLine size={15} />
      </Chip>
      <Chip label={t('editor.back')} onClick={p.onBack}>
        <ArrowDownToLine size={15} />
      </Chip>
      <Chip label={t('editor.delete')} onClick={p.onDelete}>
        <Trash2 size={15} />
      </Chip>
    </div>
  );
}
