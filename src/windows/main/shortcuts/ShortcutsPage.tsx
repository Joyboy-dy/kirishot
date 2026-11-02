import { useEffect, useState } from 'react';
import { Kbd } from '@/components/ui/Kbd';
import { commands, events, type BindingSlot } from '@/lib/ipc';
import { EDITOR_SHORTCUTS, SELECTION_SHORTCUTS, type ShortcutGroup } from '@/lib/shortcuts';
import { t, type MessageKey } from '@/i18n';
import { Page } from '../Page';
import { Row, Section } from '../settings/Layout';
import { useSettings } from '../useSettings';
import { displayAccel } from './recorder';

const SLOTS: { slot: BindingSlot; label: MessageKey; hint: MessageKey }[] = [
  { slot: 'region', label: 'keys.global.region', hint: 'keys.global.region.hint' },
  { slot: 'regionAlt', label: 'keys.global.regionAlt', hint: 'keys.global.regionAlt.hint' },
  { slot: 'fullscreen', label: 'keys.global.fullscreen', hint: 'keys.global.fullscreen.hint' },
];

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="flex shrink-0 gap-1">
      {keys.map((k, i) => (
        <Kbd key={`${k}-${i}`}>{k}</Kbd>
      ))}
    </span>
  );
}

const small =
  'k-press h-8 whitespace-nowrap rounded-lg border px-2.5 text-[12.5px] font-medium hover:bg-white/5 disabled:opacity-40';
const smallStyle = {
  borderColor: 'var(--k-border)',
  background: 'transparent',
  color: 'var(--k-text)',
};

/** Global shortcuts, editable, and the in-app ones, explained (spec J3 § 4.3). */
export function ShortcutsPage() {
  const { view } = useSettings();
  const [recording, setRecording] = useState<BindingSlot | null>(null);
  const [errors, setErrors] = useState<Partial<Record<BindingSlot, string>>>({});

  const set = async (slot: BindingSlot, accel: string | null) => {
    const r = await commands.shortcutSet(slot, accel);
    setErrors((e) => ({ ...e, [slot]: r.status === 'error' ? r.error.message : undefined }));
  };

  // The keyboard hook records the next combination and sends it here.
  useEffect(() => {
    if (!recording) return;
    const slot = recording;
    const unlisten = events.shortcutRecorded.listen((e) => {
      setRecording(null);
      if (e.payload.accel) void set(slot, e.payload.accel);
    });
    void commands.shortcutRecord(true);
    return () => {
      void commands.shortcutRecord(false);
      void unlisten.then((stop) => stop());
    };
  }, [recording]);

  const shortcuts = view?.settings.shortcuts;
  const valueOf = (slot: BindingSlot) =>
    slot === 'region'
      ? shortcuts?.region
      : slot === 'regionAlt'
        ? shortcuts?.regionAlt
        : shortcuts?.fullscreen;

  const group = (g: ShortcutGroup) => (
    <Section key={g.title} title={g.title}>
      {g.entries.map((e) => (
        <Row key={e.label + e.keys.join()} label={e.label}>
          <Keys keys={e.keys} />
        </Row>
      ))}
    </Section>
  );

  return (
    <Page title={t('main.shortcuts')}>
      <div className="flex max-w-[760px] flex-col gap-8">
        <Section title={t('keys.global')}>
          {SLOTS.map(({ slot, label, hint }) => {
            const value = valueOf(slot);
            const waiting = recording === slot;
            return (
              <Row
                key={slot}
                label={t(label)}
                hint={errors[slot] ?? t(hint)}
                error={Boolean(errors[slot])}
              >
                <button
                  type="button"
                  aria-label={t('keys.change', { action: t(label) })}
                  aria-pressed={waiting}
                  onClick={() => setRecording(waiting ? null : slot)}
                  className="k-press flex h-9 min-w-40 items-center justify-center rounded-lg border px-3 text-[13px]"
                  style={{
                    borderColor: waiting ? 'var(--k-accent)' : 'var(--k-border)',
                    background: waiting ? 'var(--k-accent-soft)' : 'var(--k-surface-2)',
                    color: waiting ? 'var(--k-accent-text)' : 'var(--k-text)',
                  }}
                >
                  {waiting ? (
                    t('keys.waiting')
                  ) : value ? (
                    <Keys keys={displayAccel(value)} />
                  ) : (
                    <span style={{ color: 'var(--k-text-3)' }}>{t('keys.none')}</span>
                  )}
                </button>
                <button
                  type="button"
                  className={small}
                  style={smallStyle}
                  onClick={() =>
                    void commands.shortcutDefault(slot).then((r) => {
                      if (r.status === 'ok') void set(slot, r.data);
                    })
                  }
                >
                  {t('keys.default')}
                </button>
                <button
                  type="button"
                  className={small}
                  style={smallStyle}
                  disabled={!value}
                  onClick={() => void set(slot, null)}
                >
                  {t('keys.clear')}
                </button>
              </Row>
            );
          })}
        </Section>
        <p className="m-0 text-[12.5px]" style={{ color: 'var(--k-text-3)' }}>
          {t('keys.inAppNote')}
        </p>
        <h2 className="m-0 text-[17px] font-semibold">{t('keys.selection')}</h2>
        {SELECTION_SHORTCUTS.map(group)}
        <h2 className="m-0 text-[17px] font-semibold">{t('keys.editor')}</h2>
        {EDITOR_SHORTCUTS.map(group)}
      </div>
    </Page>
  );
}
