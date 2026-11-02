import { commands, type StartModeSetting, type ToolbarPosition } from '@/lib/ipc';
import { NO_CHANGE } from '@/lib/settings';
import { t, type MessageKey } from '@/i18n';
import type { useSettings } from '../useSettings';
import { Choice, Row, Section, SwitchRow } from './Layout';

const START_MODES: StartModeSetting[] = ['region', 'window', 'last'];
const POSITIONS: ToolbarPosition[] = ['top', 'bottom'];

type Settings = ReturnType<typeof useSettings>;

/** Réglages › Capture: the selection screen and what a capture includes (spec J3 § 4.4). */
export function CaptureSettings({
  view,
  update,
}: Pick<Settings, 'update'> & { view: NonNullable<Settings['view']> }) {
  const { capture } = view.settings;
  return (
    <>
      <Section title={t('settings.selection')}>
        <Row label={t('settings.startMode')} hint={t('settings.startMode.hint')}>
          <Choice
            label={t('settings.startMode')}
            value={capture.startMode}
            options={START_MODES.map((v) => ({
              value: v,
              label: t(`settings.startMode.${v}` as MessageKey),
            }))}
            onChange={(startMode) => void update({ ...NO_CHANGE, startMode })}
          />
        </Row>
        <SwitchRow
          label={t('settings.magnifier')}
          hint={t('settings.magnifier.hint')}
          checked={capture.magnifier}
          onChange={(magnifier) => void update({ ...NO_CHANGE, magnifier })}
        />
        <SwitchRow
          label={t('settings.commitOnRelease')}
          hint={t('settings.commitOnRelease.hint')}
          checked={capture.commitOnRelease}
          onChange={(commitOnRelease) => void update({ ...NO_CHANGE, commitOnRelease })}
        />
        <Row label={t('settings.toolbarPosition')} hint={t('settings.toolbarPosition.hint')}>
          <Choice
            label={t('settings.toolbarPosition')}
            value={capture.toolbarPosition}
            options={POSITIONS.map((v) => ({
              value: v,
              label: t(`settings.toolbarPosition.${v}` as MessageKey),
            }))}
            onChange={(toolbarPosition) => void update({ ...NO_CHANGE, toolbarPosition })}
          />
        </Row>
      </Section>
      <Section title={t('settings.feedback')}>
        <SwitchRow
          label={t('settings.sound')}
          hint={t('settings.sound.hint')}
          checked={capture.sound}
          onChange={(sound) => {
            void update({ ...NO_CHANGE, sound });
            if (sound) void commands.playShutterPreview();
          }}
        />
        <SwitchRow
          label={t('settings.flash')}
          hint={t('settings.flash.hint')}
          checked={capture.flash}
          onChange={(flash) => void update({ ...NO_CHANGE, flash })}
        />
        <SwitchRow
          label={t('settings.includeCursor')}
          hint={t('settings.includeCursor.hint')}
          checked={capture.includeCursor}
          onChange={(includeCursor) => void update({ ...NO_CHANGE, includeCursor })}
        />
      </Section>
    </>
  );
}
