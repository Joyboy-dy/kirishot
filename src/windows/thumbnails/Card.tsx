import { useRef, useState, type ReactNode } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { ContextMenu } from 'radix-ui';
import { Copy, Download, PencilLine, X } from 'lucide-react';
import { Tip } from '@/components/ui/Tip';
import { t } from '@/i18n';
import { footerText, type CardState } from './cardText';
import { isDrag } from './drag';
import { cardSize } from './stack';

type Props = {
  state: CardState;
  onHover(hovered: boolean): void;
  onEdit(): void;
  onCopy(): void;
  onSave(): void;
  onClose(): void;
  onDelete(): void;
  onReveal(): void;
  onCopyPath(): void;
  /** Drags the card's file into another application. */
  onDrag(): void;
};

function IconButton(props: {
  label: string;
  accent?: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <Tip label={props.label} side="top">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          props.onClick();
        }}
        className="k-press flex h-8 w-8 items-center justify-center rounded-lg border-0"
        style={
          props.accent
            ? { background: 'var(--k-accent)', color: 'var(--k-ink)' }
            : { background: 'rgba(14, 16, 20, 0.85)', color: '#eceef2' }
        }
      >
        {props.children}
      </button>
    </Tip>
  );
}

/** One capture in the stack: click to edit, hover for actions, drag to another app. */
export function Card(props: Props) {
  const { state } = props;
  const { card, clock, status, leaving } = state;
  const [hovered, setHovered] = useState(false);
  // Where the press started, until it becomes a drag or a click.
  const press = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const size = cardSize(card.width, card.height);
  const src = card.src ? convertFileSrc(card.src) : card.preview;
  const saved = status?.kind === 'saved';
  const progress =
    clock.total === null || status ? 0 : Math.max(0, Math.min(1, clock.left / clock.total));

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          className={leaving ? 'k-thumb-out' : 'k-thumb-in'}
          onPointerEnter={() => {
            setHovered(true);
            props.onHover(true);
          }}
          onPointerLeave={() => {
            setHovered(false);
            props.onHover(false);
          }}
          style={{
            width: size.width,
            borderRadius: 12,
            overflow: 'hidden',
            background: '#0e1014',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 10px 28px rgba(0, 0, 0, 0.45)',
          }}
        >
          <div className="relative" style={{ height: size.height }}>
            <button
              type="button"
              aria-label={t('thumb.edit')}
              onClick={() => {
                if (!dragged.current) props.onEdit();
              }}
              onPointerDown={(e) => {
                press.current = { x: e.clientX, y: e.clientY };
                dragged.current = false;
              }}
              onPointerMove={(e) => {
                const from = press.current;
                if (!from || !card.src || !isDrag(from, { x: e.clientX, y: e.clientY })) return;
                press.current = null;
                dragged.current = true;
                props.onDrag();
              }}
              onPointerUp={() => {
                press.current = null;
              }}
              style={{ background: '#16191f', cursor: 'pointer' }}
              className="block h-full w-full border-0 p-0"
            >
              {src && (
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  className="block h-full w-full"
                  style={{ objectFit: 'cover' }}
                />
              )}
            </button>
            {hovered && !leaving && (
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2"
                style={{ background: 'rgba(4, 5, 10, 0.45)' }}
              >
                <div className="pointer-events-auto flex gap-2">
                  <IconButton label={t('thumb.copy')} onClick={props.onCopy}>
                    <Copy size={16} strokeWidth={1.9} />
                  </IconButton>
                  <IconButton label={t('thumb.save')} accent onClick={props.onSave}>
                    <Download size={16} strokeWidth={1.9} />
                  </IconButton>
                  <IconButton label={t('thumb.edit')} onClick={props.onEdit}>
                    <PencilLine size={16} strokeWidth={1.9} />
                  </IconButton>
                </div>
                <div className="pointer-events-auto absolute right-1.5 top-1.5">
                  <IconButton label={t('thumb.close')} onClick={props.onClose}>
                    <X size={14} strokeWidth={2} />
                  </IconButton>
                </div>
              </div>
            )}
          </div>
          <div
            className="flex h-7 items-center px-2.5 text-[12px]"
            style={{
              background: '#0e1014',
              color: status?.kind === 'failed' ? 'var(--k-danger)' : 'var(--k-text-2)',
            }}
          >
            <span className="truncate">{footerText(state)}</span>
          </div>
          <div style={{ height: 2, background: 'rgba(255, 255, 255, 0.06)' }}>
            <div
              style={{
                height: 2,
                width: `${progress * 100}%`,
                background: 'var(--k-accent)',
                transition: 'width 100ms linear',
              }}
            />
          </div>
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="min-w-44 rounded-lg p-1 text-[13px]"
          style={{
            background: 'var(--k-surface-2)',
            color: 'var(--k-text)',
            border: '1px solid var(--k-border)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
          }}
        >
          {[
            { label: t('thumb.reveal'), disabled: !saved, run: props.onReveal },
            { label: t('thumb.copyPath'), disabled: !saved, run: props.onCopyPath },
            { label: t('thumb.delete'), disabled: false, run: props.onDelete },
          ].map((item) => (
            <ContextMenu.Item
              key={item.label}
              disabled={item.disabled}
              onSelect={item.run}
              className="rounded-md px-2.5 py-1.5 outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-white/10"
            >
              {item.label}
            </ContextMenu.Item>
          ))}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
