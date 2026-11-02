import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { commands, type ImageFormat, type Theme } from '@/lib/ipc';
import { NO_CHANGE } from '@/lib/settings';
import { t, type MessageKey } from '@/i18n';
import type { useSettings } from '../useSettings';
import { Choice, Row, Section, SwitchRow } from './Layout';
import { NameTemplate } from './NameTemplate';

const FORMATS: ImageFormat[] = ['png', 'jpg', 'webp'];
const FORMAT_LABELS: Record<ImageFormat, string> = { png: 'PNG', jpg: 'JPG', webp: 'WebP' };
const THEMES: Theme[] = ['system', 'dark', 'light'];

type Settings = ReturnType<typeof useSettings>;

/** Réglages › Général: where and how captures are saved, startup and theme (spec J3 § 4.4). */
export function GeneralSettings({
  view,
  update,
}: Pick<Settings, 'update'> & { view: NonNullable<Settings['view']> }) {
  const { settings } = view;

  const chooseFolder = async () => {
    const path = await open({ directory: true, defaultPath: view.saveFolder });
    if (typeof path === 'string') {
      await update({ ...NO_CHANGE, saveFolder: { kind: 'custom', path } });
    }
  };

  return (
    <>
      <Section title={t('settings.saving')}>
        <Row label={t('settings.folder')} hint={view.saveFolderDisplay}>
          <Button variant="secondary" onClick={() => void commands.openSaveFolder()}>
            <FolderOpen size={16} strokeWidth={1.9} />
            {t('settings.open')}
          </Button>
          <Button variant="secondary" onClick={() => void chooseFolder()}>
            {t('settings.change')}
          </Button>
        </Row>
        {settings.save.folder !== null && (
          <div className="px-5 pb-4">
            <button
              type="button"
              className="border-0 bg-transparent p-0 text-[12.5px] underline"
              style={{ color: 'var(--k-accent-text)' }}
              onClick={() => void update({ ...NO_CHANGE, saveFolder: { kind: 'default' } })}
            >
              {t('settings.defaultFolder')}
            </button>
          </div>
        )}
        <Row
          label={t('settings.format')}
          hint={t(`settings.format.${settings.save.format}` as MessageKey)}
        >
          <Choice
            label={t('settings.format')}
            value={settings.save.format}
            options={FORMATS.map((f) => ({ value: f, label: FORMAT_LABELS[f] }))}
            onChange={(saveFormat) => void update({ ...NO_CHANGE, saveFormat })}
          />
        </Row>
        <Row label={t('settings.nameTemplate')} hint={t('settings.nameTemplate.hint')}>
          <NameTemplate
            value={settings.save.nameTemplate}
            onChange={(nameTemplate) => void update({ ...NO_CHANGE, nameTemplate })}
          />
        </Row>
      </Section>

      <Section title={t('settings.system')}>
        <SwitchRow
          label={t('settings.launchAtStartup')}
          hint={t('settings.launchAtStartup.hint')}
          checked={settings.system.launchAtStartup}
          onChange={(launchAtStartup) => void update({ ...NO_CHANGE, launchAtStartup })}
        />
        <Row label={t('settings.theme')} hint={t('settings.theme.hint')}>
          <Choice
            label={t('settings.theme')}
            value={settings.system.theme}
            options={THEMES.map((v) => ({
              value: v,
              label: t(`settings.theme.${v}` as MessageKey),
            }))}
            onChange={(theme) => void update({ ...NO_CHANGE, theme })}
          />
        </Row>
      </Section>
    </>
  );
}
