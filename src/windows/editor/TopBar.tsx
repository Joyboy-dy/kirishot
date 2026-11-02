import type { ReactNode } from 'react';
import { Copy, Download, Redo2, Undo2 } from 'lucide-react';
import { Tip } from '@/components/ui/Tip';
import { PALETTE, type SizeStep } from '@/editor/style';
import { t } from '@/i18n';
import { TOOLS, type ToolId } from './tools/catalog';

export type Style = { color: string; size: SizeStep; fill: boolean; shadow: boolean };

type Props = {
  tool: ToolId;
  style: Style;
  canUndo: boolean;
  canRedo: boolean;
  busy: boolean;
  onTool(tool: ToolId): void;
  onStyle(patch: Partial<Style>): void;
  onUndo(): void;
  onRedo(): void;
  onCopy(): void;
  onSave(): void;
  onCopyAndClose(): void;
};

function BarButton(props: {
  label: string;
  keys?: string[];
  active?: boolean;
  disabled?: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <Tip label={props.label} keys={props.keys}>
      <button
        type="button"
        aria-pressed={props.active}
        disabled={props.disabled}
        onClick={props.onClick}
        className="k-press flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-lg border-0 px-2 hover:bg-white/10 disabled:opacity-40"
        style={
          props.active
            ? { background: 'var(--k-accent-soft)', color: 'var(--k-accent-text)' }
            : { background: 'transparent', color: 'var(--k-text)' }
        }
      >
        {props.children}
      </button>
    </Tip>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px" style={{ background: 'var(--k-border)' }} />;

/** Tools on the left, the current style in the middle, actions on the right (spec J2 § 4.1). */
export function TopBar(p: Props) {
  return (
    <header
      role="toolbar"
      aria-label={t('editor.toolbar')}
      className="flex h-12 shrink-0 items-center gap-1 px-3"
      style={{ borderBottom: '1px solid var(--k-border)', background: 'var(--k-surface)' }}
    >
      {TOOLS.map((tool) => (
        <BarButton
          key={tool.id}
          label={tool.label}
          keys={[tool.key]}
          active={p.tool === tool.id}
          onClick={() => p.onTool(tool.id)}
        >
          <tool.icon size={17} strokeWidth={1.9} />
        </BarButton>
      ))}
      <Divider />
      <div className="flex flex-1 items-center justify-center gap-1">
        {PALETTE.map((color) => (
          <Tip key={color} label={t('editor.color', { color })}>
            <button
              type="button"
              aria-pressed={p.style.color === color}
              onClick={() => p.onStyle({ color })}
              className="k-press h-6 w-6 rounded-full border-0 p-0"
              style={{
                background: color,
                boxShadow:
                  p.style.color === color
                    ? '0 0 0 2px var(--k-surface), 0 0 0 4px var(--k-accent)'
                    : 'inset 0 0 0 1px rgba(255, 255, 255, 0.25)',
              }}
            />
          </Tip>
        ))}
        <Divider />
        {([1, 2, 3, 4] as SizeStep[]).map((size) => (
          <BarButton
            key={size}
            label={t(`editor.size.${size}` as 'editor.size.1')}
            keys={[String(size)]}
            active={p.style.size === size}
            onClick={() => p.onStyle({ size })}
          >
            <span
              className="rounded-full"
              style={{ width: 4 + size * 3, height: 4 + size * 3, background: 'currentColor' }}
            />
          </BarButton>
        ))}
        <Divider />
        <BarButton
          label={t('editor.fill')}
          active={p.style.fill}
          onClick={() => p.onStyle({ fill: !p.style.fill })}
        >
          <span
            className="h-4 w-4 rounded-[4px]"
            style={{
              border: '2px solid currentColor',
              background: p.style.fill ? 'currentColor' : 'transparent',
              opacity: p.style.fill ? 0.6 : 1,
            }}
          />
        </BarButton>
        <BarButton
          label={t('editor.shadow')}
          active={p.style.shadow}
          onClick={() => p.onStyle({ shadow: !p.style.shadow })}
        >
          <span
            className="h-4 w-4 rounded-[4px]"
            style={{ background: 'currentColor', boxShadow: '2px 3px 0 rgba(0,0,0,0.55)' }}
          />
        </BarButton>
      </div>
      <Divider />
      <BarButton
        label={t('editor.undo')}
        keys={['Ctrl', 'Z']}
        disabled={!p.canUndo}
        onClick={p.onUndo}
      >
        <Undo2 size={17} strokeWidth={1.9} />
      </BarButton>
      <BarButton
        label={t('editor.redo')}
        keys={['Ctrl', 'Y']}
        disabled={!p.canRedo}
        onClick={p.onRedo}
      >
        <Redo2 size={17} strokeWidth={1.9} />
      </BarButton>
      <Divider />
      <BarButton label={t('editor.copy')} keys={['Ctrl', 'C']} disabled={p.busy} onClick={p.onCopy}>
        <Copy size={17} strokeWidth={1.9} />
      </BarButton>
      <BarButton label={t('editor.save')} keys={['Ctrl', 'S']} disabled={p.busy} onClick={p.onSave}>
        <Download size={17} strokeWidth={1.9} />
      </BarButton>
      <Tip label={t('editor.copyAndClose')} keys={['Ctrl', 'Entrée']}>
        <button
          type="button"
          disabled={p.busy}
          onClick={p.onCopyAndClose}
          className="k-press ml-1 h-8 rounded-lg border-0 px-3 text-[13px] font-semibold disabled:opacity-40"
          style={{ background: 'var(--k-accent)', color: 'var(--k-ink)' }}
        >
          {t('editor.copyAndClose')}
        </button>
      </Tip>
    </header>
  );
}
