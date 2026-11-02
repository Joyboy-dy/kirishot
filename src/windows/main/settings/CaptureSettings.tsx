import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { commands, type ThumbnailDuration } from '@/lib/ipc';
import { NO_CHANGE } from '@/lib/settings';
import { t, type MessageKey } from '@/i18n';
import { useSettings } from '../useSettings';
import { Row, Section } from './Layout';

const DURATIONS = ['3', '6', '10', 'untilClosed'] as const;

function toDuration(v: (typeof DURATIONS)[number]): ThumbnailDuration {
  return v === 'untilClosed' ? { kind: 'untilClosed' } : { kind: 'seconds', value: Number(v) };
}

/** Settings › Capture: magnifier, sound, flash, thumbnail (spec J2 § 5). */
export function CaptureSettings() {
  const { view, update } = useSettings();
  if (!view) return null;
  const { capture, afterCapture } = view.settings;
  const duration =
    afterCapture.thumbnailSeconds === null ? 'untilClosed' : String(afterCapture.thumbnailSeconds);

  const toggle = (
    label: MessageKey,
    checked: boolean,
    change: (on: boolean) => void,
    hint: MessageKey,
  ) => (
    <Row label={t(label)} hint={t(hint)}>
      <Switch checked={checked} onCheckedChange={change} aria-label={t(label)} />
    </Row>
  );

  return (
    <Section title={t('settings.capture')}>
      {toggle(
        'settings.magnifier',
        capture.magnifier,
        (on) => void update({ ...NO_CHANGE, magnifier: on }),
        'settings.magnifier.hint',
      )}
      {toggle(
        'settings.sound',
        capture.sound,
        (on) => {
          void update({ ...NO_CHANGE, sound: on });
          if (on) void commands.playShutterPreview();
        },
        'settings.sound.hint',
      )}
      {toggle(
        'settings.flash',
        capture.flash,
        (on) => void update({ ...NO_CHANGE, flash: on }),
        'settings.flash.hint',
      )}
      {toggle(
        'settings.thumbnail',
        afterCapture.thumbnail,
        (on) => void update({ ...NO_CHANGE, thumbnail: on }),
        'settings.thumbnail.hint',
      )}
      <Row label={t('settings.thumbnailDuration')} hint={t('settings.thumbnailDuration.hint')}>
        <ToggleGroup
          type="single"
          variant="outline"
          value={duration}
          disabled={!afterCapture.thumbnail}
          onValueChange={(v) => {
            if (v)
              void update({
                ...NO_CHANGE,
                thumbnailDuration: toDuration(v as (typeof DURATIONS)[number]),
              });
          }}
        >
          {DURATIONS.map((d) => (
            <ToggleGroupItem
              key={d}
              value={d}
              className="px-3 data-[state=on]:border-[var(--k-accent)] data-[state=on]:bg-[var(--k-accent-soft)] data-[state=on]:text-[var(--k-accent-text)]"
            >
              {t(`settings.duration.${d}` as MessageKey)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Row>
      {toggle(
        'settings.alwaysOpenEditor',
        afterCapture.alwaysOpenEditor,
        (on) => void update({ ...NO_CHANGE, alwaysOpenEditor: on }),
        'settings.alwaysOpenEditor.hint',
      )}
    </Section>
  );
}
