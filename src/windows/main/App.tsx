import { useState } from 'react';
import { t } from '@/i18n';
import { AboutPage } from './about/AboutPage';
import { Page } from './Page';
import { DEFAULT_ROUTE, type Route } from './routes';
import { CaptureSettings } from './settings/CaptureSettings';
import { GeneralSettings } from './settings/GeneralSettings';
import { Sidebar } from './Sidebar';

/** The main window: sidebar and the page it selects (spec J3 § 4.1). */
export function App() {
  const [route, setRoute] = useState<Route>(DEFAULT_ROUTE);
  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--k-bg)', color: 'var(--k-text)' }}
    >
      <Sidebar route={route} onRoute={setRoute} />
      {route === 'about' && <AboutPage />}
      {route === 'history' && <Page title={t('main.history')}>{null}</Page>}
      {route === 'shortcuts' && <Page title={t('main.shortcuts')}>{null}</Page>}
      {route === 'settings' && (
        <Page title={t('main.settings')}>
          <GeneralSettings />
          <div className="max-w-[760px]">
            <CaptureSettings />
          </div>
        </Page>
      )}
    </div>
  );
}
