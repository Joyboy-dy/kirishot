import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { AutoAction, ThumbnailDuration } from '@/lib/ipc';
import { NO_CHANGE } from '@/lib/settings';
import { t, type MessageKey } from '@/i18n';
import type { useSettings } from '../useSettings';
import { Choice, Row, Section, SwitchRow } from './Layout';

const ACTIONS: AutoAction[] = ['saveAndCopy', 'copy', 'save'];
const DURATIONS = ['3', '6', '10', 'untilClosed'] as const;

function toDuration(v: (typeof DURATIONS)[number]): ThumbnailDuration {
  return v === 'untilClosed' ? { kind: 'untilClosed' } : { kind: 'seconds', value: Number(v) };
}

type Settings = ReturnType<typeof useSettings>;

/** Réglages › Après capture: the automatic action, the thumbnail, the editor (spec J3 § 4.4). */
export function AfterCaptureSettings({
  view,
  update,
}: Pick<Settings, 'update'> & { view: NonNullable<Settings['view']> }) {
  const { afterCapture, editor } = view.settings;
  const duration =
    afterCapture.thumbnailSeconds === null ? 'untilClosed' : String(afterCapture.thumbnailSeconds);
  return (
    <>
      <Section title={t('settings.afterCapture')}>
        <Row label={t('settings.autoAction')} hint={t('settings.autoAction.hint')}>
          <RadioGroup
            value={afterCapture.autoAction}
            onValueChange={(v) => void update({ ...NO_CHANGE, autoAction: v as AutoAction })}
            className="gap-2.5"
          >
            {ACTIONS.map((a) => (
              <label key={a} className="flex cursor-pointer items-center gap-2.5 text-[13.5px]">
                <RadioGroupItem
                  value={a}
                  className="data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                />
                {t(`settings.action.${a}` as MessageKey)}
              </label>
            ))}
          </RadioGroup>
        </Row>
        <SwitchRow
          label={t('settings.thumbnail')}
          hint={t('settings.thumbnail.hint')}
          checked={afterCapture.thumbnail}
          onChange={(thumbnail) => void update({ ...NO_CHANGE, thumbnail })}
        />
        <Row label={t('settings.thumbnailDuration')} hint={t('settings.thumbnailDuration.hint')}>
          <Choice
            label={t('settings.thumbnailDuration')}
            value={duration}
            disabled={!afterCapture.thumbnail}
            options={DURATIONS.map((d) => ({
              value: d,
              label: t(`settings.duration.${d}` as MessageKey),
            }))}
            onChange={(d) =>
              void update({
                ...NO_CHANGE,
                thumbnailDuration: toDuration(d as (typeof DURATIONS)[number]),
              })
            }
          />
        </Row>
        <SwitchRow
          label={t('settings.alwaysOpenEditor')}
          hint={t('settings.alwaysOpenEditor.hint')}
          checked={afterCapture.alwaysOpenEditor}
          onChange={(alwaysOpenEditor) => void update({ ...NO_CHANGE, alwaysOpenEditor })}
        />
      </Section>
      <Section title={t('settings.editor')}>
        <SwitchRow
          label={t('settings.confirmClose')}
          hint={t('settings.confirmClose.hint')}
          checked={editor.confirmClose}
          onChange={(confirmClose) => void update({ ...NO_CHANGE, confirmClose })}
        />
      </Section>
    </>
  );
}
