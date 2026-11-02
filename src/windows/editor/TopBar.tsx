import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Check,
  ChevronDown,
  ClipboardCheck,
  Copy,
  CopyPlus,
  Download,
  LoaderCircle,
  Redo2,
  Trash2,
  Undo2,
} from 'lucide-react';
import { Popover } from 'radix-ui';
import { Tip } from '@/components/ui/Tip';
import { t } from '@/i18n';
import { selectionActionsPlacement, toolbarLayout } from './layout';
import type { SaveState } from './save';
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
  /** What each export button shows: its icon, a spinner or a check (spec J2.1 § 4.2). */
  views: Record<'copy' | 'save' | 'main', 'icon' | 'spinner' | 'check'>;
  onTool(tool: ToolId): void;
  onStyle(patch: StylePatch, live?: boolean): void;
  onStyleSettled(): void;
  onUndo(): void;
  onRedo(): void;
  onCopy(): void;
  onSave(): void;
  /** `clean`: nothing to save, the button is off (spec J3 § 3.2). */
  saveState: SaveState;
  onSaveVersion(): void;
  onSaveAs(): void;
  onCopyAndClose(): void;
  /** The selection's actions; `null` without a selection (spec J3 § 3.1). */
  selectionActions: SelectionActions | null;
};

type SelectionActions = {
  onFront(): void;
  onBack(): void;
  onDuplicate(): void;
  onDelete(): void;
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

function SelectionButtons({ a, dense }: { a: SelectionActions; dense: boolean }) {
  return (
    <>
      <BarButton label={t('editor.front')} keys={['Ctrl', ']']} dense={dense} onClick={a.onFront}>
        <ArrowUpToLine size={17} strokeWidth={1.9} />
      </BarButton>
      <BarButton label={t('editor.back')} keys={['Ctrl', '[']} dense={dense} onClick={a.onBack}>
        <ArrowDownToLine size={17} strokeWidth={1.9} />
      </BarButton>
      <BarButton
        label={t('editor.duplicate')}
        keys={['Ctrl', 'D']}
        dense={dense}
        onClick={a.onDuplicate}
      >
        <CopyPlus size={17} strokeWidth={1.9} />
      </BarButton>
      <BarButton label={t('editor.delete')} keys={['Suppr']} dense={dense} onClick={a.onDelete}>
        <Trash2 size={17} strokeWidth={1.9} />
      </BarButton>
    </>
  );
}

/** « Enregistrer » and its menu: new version, save as (spec J3 § 3.2). */
function SaveButton(p: {
  state: SaveState;
  busy: boolean;
  view: 'icon' | 'spinner' | 'check';
  withLabel: boolean;
  dense: boolean;
  onSave(): void;
  onSaveVersion(): void;
  onSaveAs(): void;
}) {
  const clean = p.state === 'clean';
  const item =
    'k-press flex h-8 w-full items-center whitespace-nowrap rounded-md border-0 bg-transparent px-2.5 text-left text-[13px] hover:bg-white/10 disabled:opacity-40';
  return (
    <span className="flex shrink-0 items-center">
      <Tip label={clean ? t('editor.saveClean') : t('editor.save')} keys={['Ctrl', 'S']}>
        <button
          type="button"
          aria-label={t('editor.save')}
          disabled={p.busy || clean}
          onClick={p.onSave}
          className={`k-press flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-l-lg border-0 bg-transparent text-[13px] hover:bg-white/10 disabled:opacity-40 ${p.dense ? 'px-1' : 'px-2'}`}
          style={{ color: 'var(--k-text)' }}
        >
          <Result view={p.view}>
            <Download size={17} strokeWidth={1.9} />
          </Result>
          {p.withLabel && t('editor.save')}
        </button>
      </Tip>
      <Popover.Root>
        <Tip label={t('editor.saveMenu')}>
          <Popover.Trigger asChild>
            <button
              type="button"
              aria-label={t('editor.saveMenu')}
              disabled={p.busy}
              className="k-press flex h-8 w-5 shrink-0 items-center justify-center rounded-r-lg border-0 bg-transparent hover:bg-white/10 disabled:opacity-40"
              style={{ color: 'var(--k-text-2)' }}
            >
              <ChevronDown size={14} strokeWidth={2} />
            </button>
          </Popover.Trigger>
        </Tip>
        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="end"
            sideOffset={6}
            collisionPadding={8}
            className="z-50 flex min-w-56 flex-col gap-0.5 rounded-xl p-1"
            style={{
              background: 'var(--k-glass)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--k-border)',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
              color: 'var(--k-text)',
            }}
          >
            <Popover.Close asChild>
              <button type="button" className={item} onClick={p.onSaveVersion}>
                {t('editor.saveVersion')}
              </button>
            </Popover.Close>
            <Popover.Close asChild>
              <button type="button" className={item} onClick={p.onSaveAs}>
                <span className="flex-1">{t('editor.saveAs')}</span>
                <span className="text-[11.5px]" style={{ color: 'var(--k-text-3)' }}>
                  Ctrl+Maj+S
                </span>
              </button>
            </Popover.Close>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </span>
  );
}

/** An export button's content: its icon, or the spinner or check that replaces it. */
function Result({ view, children }: { view: 'icon' | 'spinner' | 'check'; children: ReactNode }) {
  if (view === 'spinner')
    return <LoaderCircle size={17} strokeWidth={2} className="animate-spin" />;
  if (view === 'check') return <Check size={17} strokeWidth={2.4} aria-hidden />;
  return <>{children}</>;
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
  const width = useWidth();
  // The full bar's style options are wider for some tools: where it was seen to overflow, the
  // compact layout takes over up to that width (never a cut or scrolling bar).
  const [fullFrom, setFullFrom] = useState(1100);
  const layout = toolbarLayout(width, fullFrom);
  const middle = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = middle.current;
    if (layout !== 'full' || !el) return;
    const extra = el.scrollWidth - el.clientWidth;
    if (extra > 0) setFullFrom(width + extra + 16);
  }, [layout, width, p.options]);
  const dense = layout === 'narrow';
  const hasColor = p.options.includes('color');
  const menuOptions = layout === 'compact' ? p.options.filter((o) => o !== 'color') : p.options;
  const actionsInMenu = p.selectionActions !== null && selectionActionsPlacement(layout) === 'menu';
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
      <div ref={middle} className="flex min-w-0 flex-1 items-center justify-center gap-1">
        {layout === 'full' && (
          <StyleControls
            options={p.options}
            value={p.value}
            onChange={p.onStyle}
            onSettled={p.onStyleSettled}
          />
        )}
        {layout === 'compact' && hasColor && (
          <ColorMenu value={p.value.color} onChange={(color) => p.onStyle({ color })} />
        )}
        {layout !== 'full' && (menuOptions.length > 0 || actionsInMenu) && (
          <StyleMenu
            options={menuOptions}
            value={p.value}
            onChange={p.onStyle}
            onSettled={p.onStyleSettled}
            iconOnly={dense}
            extra={
              actionsInMenu && p.selectionActions ? (
                <SelectionButtons a={p.selectionActions} dense />
              ) : undefined
            }
          />
        )}
        {p.selectionActions && !actionsInMenu && (
          <span
            role="group"
            aria-label={t('editor.actions')}
            className="flex shrink-0 items-center"
          >
            <Divider />
            <SelectionButtons a={p.selectionActions} dense={dense} />
          </span>
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
        <Result view={p.views.copy}>
          <Copy size={17} strokeWidth={1.9} />
        </Result>
      </BarButton>
      <SaveButton
        state={p.saveState}
        busy={p.busy}
        view={p.views.save}
        withLabel={layout === 'full'}
        dense={dense}
        onSave={p.onSave}
        onSaveVersion={p.onSaveVersion}
        onSaveAs={p.onSaveAs}
      />
      <Tip label={t('editor.copyAndClose')} keys={['Ctrl', 'Entrée']}>
        <button
          type="button"
          aria-label={t('editor.copyAndClose')}
          disabled={p.busy}
          onClick={p.onCopyAndClose}
          className={`k-press ml-1 flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border-0 text-[13px] font-semibold disabled:opacity-40 ${dense ? 'w-8 px-0' : 'px-3'}`}
          style={{ background: 'var(--k-accent)', color: 'var(--k-ink)' }}
        >
          {p.views.main !== 'icon' ? (
            <Result view={p.views.main}>{null}</Result>
          ) : (
            <>
              {layout === 'full' && t('editor.copyAndClose')}
              {layout === 'compact' && t('editor.done')}
              {dense && <ClipboardCheck size={17} strokeWidth={2} />}
            </>
          )}
        </button>
      </Tip>
    </header>
  );
}
