import { useState } from 'react';
import { Tabs } from 'radix-ui';
import { t, type MessageKey } from '@/i18n';
import { Page } from '../Page';
import { useSettings } from '../useSettings';
import { AfterCaptureSettings } from './AfterCaptureSettings';
import { CaptureSettings } from './CaptureSettings';
import { GeneralSettings } from './GeneralSettings';
import { HistorySettings } from './HistorySettings';
import { SETTINGS_TABS, type SettingsTab } from './settingsModel';

/** Réglages, in four tabs; only settings that work are shown (spec J3 § 4.4). */
export function SettingsPage() {
  const { view, update, error } = useSettings();
  const [tab, setTab] = useState<SettingsTab>('general');
  return (
    <Page title={t('main.settings')}>
      <Tabs.Root
        value={tab}
        onValueChange={(v) => setTab(v as SettingsTab)}
        className="flex max-w-[760px] flex-col gap-8"
      >
        <Tabs.List
          aria-label={t('main.settings')}
          className="flex gap-1 self-start rounded-xl p-1"
          style={{ background: 'var(--k-surface)', border: '1px solid var(--k-border)' }}
        >
          {SETTINGS_TABS.map((id) => (
            <Tabs.Trigger
              key={id}
              value={id}
              className="k-press h-8 rounded-lg border-0 bg-transparent px-3.5 text-[13px] font-medium data-[state=active]:bg-[var(--k-accent-soft)] data-[state=active]:text-[var(--k-accent-text)]"
              style={{ color: 'var(--k-text-2)' }}
            >
              {t(`settings.tab.${id}` as MessageKey)}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {view && (
          <>
            <Tabs.Content value="general" className="flex flex-col gap-10 outline-none">
              <GeneralSettings view={view} update={update} />
            </Tabs.Content>
            <Tabs.Content value="capture" className="flex flex-col gap-10 outline-none">
              <CaptureSettings view={view} update={update} />
            </Tabs.Content>
            <Tabs.Content value="afterCapture" className="flex flex-col gap-10 outline-none">
              <AfterCaptureSettings view={view} update={update} />
            </Tabs.Content>
            <Tabs.Content value="history" className="flex flex-col gap-10 outline-none">
              <HistorySettings view={view} update={update} />
            </Tabs.Content>
          </>
        )}
        {error && (
          <p role="alert" className="m-0 text-[13px]" style={{ color: 'var(--k-danger)' }}>
            {error}
          </p>
        )}
      </Tabs.Root>
    </Page>
  );
}
