import { t } from '@/i18n';
import { Sidebar } from './Sidebar';

export function App() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-10 py-8">
        <h1 className="m-0 text-[26px] font-semibold tracking-tight">{t('main.settings')}</h1>
      </main>
    </div>
  );
}
