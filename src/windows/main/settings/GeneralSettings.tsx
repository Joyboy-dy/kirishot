import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { commands, type AutoAction, type ImageFormat } from '@/lib/ipc';
import { NO_CHANGE } from '@/lib/settings';
import { t, type MessageKey } from '@/i18n';
import { useSettings } from '../useSettings';
import { Row, Section } from './Layout';

const FORMATS: ImageFormat[] = ['png', 'jpg', 'webp'];
const FORMAT_LABELS: Record<ImageFormat, string> = { png: 'PNG', jpg: 'JPG', webp: 'WebP' };
const ACTIONS: AutoAction[] = ['saveAndCopy', 'copy', 'save'];

/** Settings › General, J1 subset: destination folder, format, automatic action (spec § 3.9). */
export function GeneralSettings() {
  const { view, update, error } = useSettings();
  if (!view) return null;
  const { settings } = view;

  const chooseFolder = async () => {
    const path = await open({ directory: true, defaultPath: view.saveFolder });
    if (typeof path === 'string') {
      await update({ ...NO_CHANGE, saveFolder: { kind: 'custom', path } });
    }
  };

  return (
    <div className="flex max-w-[760px] flex-col gap-8">
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
          <ToggleGroup
            type="single"
            variant="outline"
            value={settings.save.format}
            onValueChange={(v) => {
              if (v) void update({ ...NO_CHANGE, saveFormat: v as ImageFormat });
            }}
          >
            {FORMATS.map((f) => (
              <ToggleGroupItem
                key={f}
                value={f}
                className="px-4 data-[state=on]:border-[var(--k-accent)] data-[state=on]:bg-[var(--k-accent-soft)] data-[state=on]:text-[var(--k-accent-text)]"
              >
                {FORMAT_LABELS[f]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Row>
      </Section>

      <Section title={t('settings.afterCapture')}>
        <Row label={t('settings.autoAction')} hint={t('settings.autoAction.hint')}>
          <RadioGroup
            value={settings.afterCapture.autoAction}
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
      </Section>

      {error && (
        <p className="m-0 text-[13px]" style={{ color: 'var(--k-danger)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
