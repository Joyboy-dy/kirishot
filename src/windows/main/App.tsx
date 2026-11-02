import { useState } from 'react';
import { AboutPage } from './about/AboutPage';
import { HistoryPage } from './history/HistoryPage';
import { SettingsPage } from './settings/SettingsPage';
import { ShortcutsPage } from './shortcuts/ShortcutsPage';
import { DEFAULT_ROUTE, type Route } from './routes';
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
      {route === 'history' && <HistoryPage />}
      {route === 'shortcuts' && <ShortcutsPage />}
      {route === 'settings' && <SettingsPage />}
    </div>
  );
}
