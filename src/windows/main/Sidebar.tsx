import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { commands } from '@/lib/ipc';
import { t } from '@/i18n';

/** Navigation of the main window. J1 has the settings page only; history comes in J2. */
export function Sidebar() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    void commands.appInfo().then((r) => {
      if (r.status === 'ok') setVersion(r.data.version);
    });
  }, []);

  return (
    <aside
      className="flex w-60 shrink-0 flex-col gap-6 p-4"
      style={{ background: 'var(--k-surface)', borderRight: '1px solid var(--k-border)' }}
    >
      <div className="flex items-center gap-2.5 px-2 pt-1">
        <Logo size={24} />
        <span className="text-[17px] font-semibold tracking-tight">kirishot</span>
      </div>
      <nav className="flex flex-col gap-1">
        <a
          aria-current="page"
          className="flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13.5px] font-medium"
          style={{ background: 'var(--k-accent-soft)', color: 'var(--k-accent-text)' }}
        >
          <Settings size={16} strokeWidth={1.9} />
          {t('main.settings')}
        </a>
      </nav>
      {version && (
        <p className="mt-auto px-2 text-[12px]" style={{ color: 'var(--k-text-3)' }}>
          {t('main.version', { version })}
        </p>
      )}
    </aside>
  );
}
