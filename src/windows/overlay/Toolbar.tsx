import type { ReactNode } from 'react';
import { AppWindow, Monitor, SquareDashed, X } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { t } from '@/i18n';
import type { Mode } from './selection';

type Props = {
  mode: Mode;
  onMode(mode: Mode): void;
  onFullscreen(): void;
  onCancel(): void;
};

function ToolButton(props: { active?: boolean; onClick(): void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="flex h-8 items-center gap-2 rounded-lg border-0 px-3 text-[13px] font-medium transition-colors hover:bg-white/10"
      style={
        props.active
          ? { background: 'var(--k-accent-soft)', color: 'var(--k-accent-text)' }
          : { background: 'transparent', color: 'var(--k-text)' }
      }
    >
      {props.children}
    </button>
  );
}

/** Capture modes, shown at the top of the monitor under the pointer only. */
export function Toolbar({ mode, onMode, onFullscreen, onCancel }: Props) {
  return (
    <div
      data-toolbar
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-1 rounded-xl p-1.5"
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
      <ToolButton active={mode === 'region'} onClick={() => onMode('region')}>
        <SquareDashed size={16} strokeWidth={1.9} />
        {t('overlay.zone')}
      </ToolButton>
      <ToolButton active={mode === 'window'} onClick={() => onMode('window')}>
        <AppWindow size={16} strokeWidth={1.9} />
        {t('overlay.window')}
      </ToolButton>
      <ToolButton onClick={onFullscreen}>
        <Monitor size={16} strokeWidth={1.9} />
        {t('overlay.fullscreen')}
      </ToolButton>
      <span className="mx-1 h-5 w-px" style={{ background: 'var(--k-border)' }} />
      <ToolButton onClick={onCancel}>
        <X size={16} strokeWidth={1.9} />
        {t('overlay.cancel')}
      </ToolButton>
    </div>
  );
}
