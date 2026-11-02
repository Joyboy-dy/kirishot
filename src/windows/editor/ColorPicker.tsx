import { useEffect, useState } from 'react';
import { Pipette, Plus } from 'lucide-react';
import { Popover } from 'radix-ui';
import { HexColorPicker } from 'react-colorful';
import { Tip } from '@/components/ui/Tip';
import { t } from '@/i18n';
import { commands, events } from '@/lib/ipc';
import { NO_CHANGE } from '@/lib/settings';
import { hasEyeDropper, normalizeHex, pickScreenColor, pushRecent } from './colors';

/** Keeps `color` at the front of the recent custom colours (settings `editor.recentColors`). */
export async function rememberColor(color: string): Promise<void> {
  const r = await commands.settingsGet();
  if (r.status !== 'ok') return;
  const recentColors = pushRecent(r.data.settings.editor.recentColors, color);
  await commands.settingsUpdate({ ...NO_CHANGE, recentColors });
}

/** The recent custom colours, kept in sync with the settings. */
function useRecentColors(): string[] {
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    void commands.settingsGet().then((r) => {
      if (r.status === 'ok') setRecent(r.data.settings.editor.recentColors);
    });
    const unlisten = events.settingsChanged.listen((e) =>
      setRecent(e.payload.settings.editor.recentColors),
    );
    return () => void unlisten.then((stop) => stop());
  }, []);
  return recent;
}

/** « + » after the palette: any colour, the recent ones, and the eyedropper (spec J3 § 3.4). */
export function ColorPicker({
  value,
  onChange,
}: {
  value?: string;
  onChange(color: string): void;
}) {
  const recent = useRecentColors();
  const [draft, setDraft] = useState(value ?? '#FF5B38');
  const [hex, setHex] = useState(draft);
  const choose = (color: string) => {
    onChange(color);
    void rememberColor(color);
  };
  const eyedropper = hasEyeDropper(window);
  return (
    <Popover.Root
      onOpenChange={(open) => {
        if (!open) return;
        setDraft(value ?? draft);
        setHex(value ?? draft);
      }}
    >
      <Tip label={t('editor.customColor')}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={t('editor.customColor')}
            className="k-press flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-0 p-0"
            style={{
              background: 'conic-gradient(#f04438, #facc15, #22c55e, #3b82f6, #8b5cf6, #f04438)',
              color: '#fff',
            }}
          >
            <Plus size={13} strokeWidth={3} style={{ filter: 'drop-shadow(0 0 1px #000)' }} />
          </button>
        </Popover.Trigger>
      </Tip>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="center"
          sideOffset={8}
          collisionPadding={8}
          aria-label={t('editor.customColor')}
          className="z-50 flex w-[232px] flex-col gap-3 rounded-xl p-3"
          style={{
            background: 'var(--k-glass)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--k-border)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
            color: 'var(--k-text)',
          }}
        >
          <HexColorPicker
            color={draft}
            onChange={(c) => {
              setDraft(c);
              setHex(c.toUpperCase());
            }}
            style={{ width: '100%', height: 150 }}
          />
          <div className="flex items-center gap-2">
            <span
              className="h-7 w-7 shrink-0 rounded-md"
              style={{ background: draft, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25)' }}
            />
            <input
              value={hex}
              aria-label={t('editor.hex')}
              spellCheck={false}
              onChange={(e) => {
                setHex(e.target.value);
                const c = normalizeHex(e.target.value);
                if (c) setDraft(c);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                const c = normalizeHex(hex);
                if (e.key === 'Enter' && c) choose(c);
              }}
              className="h-7 min-w-0 flex-1 rounded-md border px-2 font-mono text-[12.5px] uppercase outline-none"
              style={{
                background: 'var(--k-surface-2)',
                borderColor: normalizeHex(hex) ? 'var(--k-border)' : 'var(--k-danger)',
                color: 'var(--k-text)',
              }}
            />
            {eyedropper && (
              <Tip label={t('editor.eyedropper')} keys={['I']}>
                <button
                  type="button"
                  aria-label={t('editor.eyedropper')}
                  onClick={() =>
                    void pickScreenColor().then((c) => {
                      if (!c) return;
                      setDraft(c);
                      setHex(c);
                      choose(c);
                    })
                  }
                  className="k-press flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-0 bg-transparent hover:bg-white/10"
                  style={{ color: 'var(--k-text)' }}
                >
                  <Pipette size={15} />
                </button>
              </Tip>
            )}
          </div>
          {recent.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11.5px]" style={{ color: 'var(--k-text-3)' }}>
                {t('editor.recentColors')}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {recent.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={t('editor.color', { color: c })}
                    onClick={() => {
                      setDraft(c);
                      setHex(c);
                      choose(c);
                    }}
                    className="k-press h-5 w-5 rounded-full border-0 p-0"
                    style={{
                      background: c,
                      boxShadow:
                        value === c
                          ? '0 0 0 2px var(--k-surface), 0 0 0 3px var(--k-accent)'
                          : 'inset 0 0 0 1px rgba(255,255,255,0.25)',
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          <Popover.Close asChild>
            <button
              type="button"
              disabled={!normalizeHex(hex)}
              onClick={() => choose(normalizeHex(hex) ?? draft)}
              className="k-press h-8 rounded-lg border-0 text-[13px] font-semibold disabled:opacity-40"
              style={{ background: 'var(--k-accent)', color: 'var(--k-ink)' }}
            >
              {t('editor.useColor')}
            </button>
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
