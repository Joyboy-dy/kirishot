import { useEffect, useState, type ReactNode } from 'react';
import { ClipboardCheck, Copy, Download, Redo2, Undo2 } from 'lucide-react';
import { Tip } from '@/components/ui/Tip';
import { t } from '@/i18n';
import { toolbarLayout } from './layout';
import { ColorMenu, StyleControls, StyleMenu } from './StylePopover';
import { TOOLS, type ToolId } from './tools/catalog';
import type { Option, StylePatch } from './tools/options';

type Props = {
  tool: ToolId;
  /** The options of the tool, or of the selection with the select tool (spec J2.1 § 3.1). */
  options: Option[];
  value: StylePatch;
  canUndo: boolean;
  canRedo: boolean;
  busy: boolean;
  onTool(tool: ToolId): void;
  onStyle(patch: StylePatch): void;
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
  dense?: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <Tip label={props.label} keys={props.keys}>
      <button
        type="button"
        aria-label={props.label}
        aria-pressed={props.active}
        disabled={props.disabled}
        onClick={props.onClick}
        className={`k-press flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border-0 hover:bg-white/10 disabled:opacity-40 ${props.dense ? 'min-w-7 px-1' : 'min-w-8 px-2'}`}
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

const Divider = () => (
  <span className="mx-0.5 h-5 w-px shrink-0" style={{ background: 'var(--k-border)' }} />
);

/** The window's width, followed as it is resized. */
function useWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

/**
 * Tools on the left, the style in the middle, actions on the right (spec J2 § 4.1). Below
 * 1 100 px the style folds into menus, below 760 px the actions become icons (J2.1 § 4.1).
 */
export function TopBar(p: Props) {
  const layout = toolbarLayout(useWidth());
  const dense = layout === 'narrow';
  const hasColor = p.options.includes('color');
  const menuOptions = layout === 'compact' ? p.options.filter((o) => o !== 'color') : p.options;
  return (
    <header
      role="toolbar"
      aria-label={t('editor.toolbar')}
      // Never a scrollbar: if the narrowest layout still does not fit, it goes to two lines.
      className="flex min-h-12 shrink-0 flex-wrap items-center gap-0.5 px-2 py-1"
      style={{ borderBottom: '1px solid var(--k-border)', background: 'var(--k-surface)' }}
    >
      {TOOLS.map((tool) => (
        <BarButton
          key={tool.id}
          label={tool.label}
          keys={[tool.key]}
          dense={dense}
          active={p.tool === tool.id}
          onClick={() => p.onTool(tool.id)}
        >
          <tool.icon size={17} strokeWidth={1.9} />
        </BarButton>
      ))}
      <Divider />
      <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
        {layout === 'full' && (
          <StyleControls options={p.options} value={p.value} onChange={p.onStyle} />
        )}
        {layout === 'compact' && hasColor && (
          <ColorMenu value={p.value.color} onChange={(color) => p.onStyle({ color })} />
        )}
        {layout !== 'full' && menuOptions.length > 0 && (
          <StyleMenu options={menuOptions} value={p.value} onChange={p.onStyle} iconOnly={dense} />
        )}
      </div>
      <Divider />
      <BarButton
        label={t('editor.undo')}
        keys={['Ctrl', 'Z']}
        dense={dense}
        disabled={!p.canUndo}
        onClick={p.onUndo}
      >
        <Undo2 size={17} strokeWidth={1.9} />
      </BarButton>
      <BarButton
        label={t('editor.redo')}
        keys={['Ctrl', 'Y']}
        dense={dense}
        disabled={!p.canRedo}
        onClick={p.onRedo}
      >
        <Redo2 size={17} strokeWidth={1.9} />
      </BarButton>
      <Divider />
      <BarButton
        label={t('editor.copy')}
        keys={['Ctrl', 'C']}
        dense={dense}
        disabled={p.busy}
        onClick={p.onCopy}
      >
        <Copy size={17} strokeWidth={1.9} />
      </BarButton>
      <BarButton
        label={t('editor.save')}
        keys={['Ctrl', 'S']}
        dense={dense}
        disabled={p.busy}
        onClick={p.onSave}
      >
        <Download size={17} strokeWidth={1.9} />
      </BarButton>
      <Tip label={t('editor.copyAndClose')} keys={['Ctrl', 'Entrée']}>
        <button
          type="button"
          aria-label={t('editor.copyAndClose')}
          disabled={p.busy}
          onClick={p.onCopyAndClose}
          className={`k-press ml-1 flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border-0 text-[13px] font-semibold disabled:opacity-40 ${dense ? 'w-8 px-0' : 'px-3'}`}
          style={{ background: 'var(--k-accent)', color: 'var(--k-ink)' }}
        >
          {layout === 'full' && t('editor.copyAndClose')}
          {layout === 'compact' && t('editor.done')}
          {dense && <ClipboardCheck size={17} strokeWidth={2} />}
        </button>
      </Tip>
    </header>
  );
}
