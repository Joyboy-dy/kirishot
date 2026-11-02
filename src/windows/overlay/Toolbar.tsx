import type { ReactNode } from 'react';
import { AppWindow, CircleHelp, Monitor, Search, SquareDashed, X } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Tip } from '@/components/ui/Tip';
import { t } from '@/i18n';
import type { Mode } from './selection';

type Props = {
  mode: Mode;
  position: 'top' | 'bottom';
  magnifier: boolean;
  onMode(mode: Mode): void;
  onFullscreen(): void;
  onMagnifier(on: boolean): void;
  onHelp(): void;
  onCancel(): void;
};

function ToolButton(props: {
  label: string;
  keys: string[];
  active?: boolean;
  pressed?: boolean;
  iconOnly?: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <Tip label={props.label} keys={props.keys}>
      <button
        type="button"
        aria-pressed={props.pressed}
        onClick={props.onClick}
        className="k-press flex h-8 items-center gap-2 rounded-lg border-0 px-3 text-[13px] font-medium hover:bg-white/10"
        style={
          props.active
            ? { background: 'var(--k-accent-soft)', color: 'var(--k-accent-text)' }
            : { background: 'transparent', color: 'var(--k-text)' }
        }
      >
        {props.children}
        {!props.iconOnly && props.label}
      </button>
    </Tip>
  );
}

/** Capture modes, shown at the top (or bottom) of the monitor under the pointer only. */
export function Toolbar({
  mode,
  position,
  magnifier,
  onMode,
  onFullscreen,
  onMagnifier,
  onHelp,
  onCancel,
}: Props) {
  // Clicks on the bar must never reach the selection underneath (J1 final review).
  const stop = (e: { stopPropagation(): void }) => e.stopPropagation();
  return (
    <div
      data-toolbar
      role="toolbar"
      aria-label="Kirishot"
      onPointerDown={stop}
      onPointerUp={stop}
      onDoubleClick={stop}
      className={`absolute left-1/2 ${position === 'bottom' ? 'bottom-4' : 'top-4'} flex -translate-x-1/2 items-center gap-1 rounded-xl p-1.5`}
      style={{
        background: 'var(--k-glass)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--k-border)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
        cursor: 'default',
      }}
    >
      <span className="flex h-8 w-8 items-center justify-center" style={{ color: 'var(--k-text)' }}>
        <Logo size={20} />
      </span>
      <span className="mx-1 h-5 w-px" style={{ background: 'var(--k-border)' }} />
      <ToolButton
        label={t('overlay.zone')}
        keys={['R']}
        active={mode === 'region'}
        pressed={mode === 'region'}
        onClick={() => onMode('region')}
      >
        <SquareDashed size={16} strokeWidth={1.9} />
      </ToolButton>
      <ToolButton
        label={t('overlay.window')}
        keys={['W']}
        active={mode === 'window'}
        pressed={mode === 'window'}
        onClick={() => onMode('window')}
      >
        <AppWindow size={16} strokeWidth={1.9} />
      </ToolButton>
      <ToolButton label={t('overlay.fullscreen')} keys={['F']} onClick={onFullscreen}>
        <Monitor size={16} strokeWidth={1.9} />
      </ToolButton>
      <span className="mx-1 h-5 w-px" style={{ background: 'var(--k-border)' }} />
      <ToolButton
        label={t('overlay.magnifier')}
        keys={['M']}
        active={magnifier}
        pressed={magnifier}
        iconOnly
        onClick={() => onMagnifier(!magnifier)}
      >
        <Search size={16} strokeWidth={1.9} />
      </ToolButton>
      <ToolButton label={t('overlay.help')} keys={['?']} iconOnly onClick={onHelp}>
        <CircleHelp size={16} strokeWidth={1.9} />
      </ToolButton>
      <ToolButton label={t('overlay.cancel')} keys={['Échap']} onClick={onCancel}>
        <X size={16} strokeWidth={1.9} />
      </ToolButton>
    </div>
  );
}
