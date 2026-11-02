import { useEffect, useState, type ReactNode } from 'react';
import { Camera, Info } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { commands } from '@/lib/ipc';
import { t } from '@/i18n';
import { navItems, type Route } from './routes';

function NavLink(p: { active: boolean; onClick(): void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-current={p.active ? 'page' : undefined}
      onClick={p.onClick}
      className="k-press flex h-9 w-full items-center gap-2.5 rounded-lg border-0 px-3 text-left text-[13.5px] font-medium hover:bg-white/5"
      style={
        p.active
          ? { background: 'var(--k-accent-soft)', color: 'var(--k-accent-text)' }
          : { background: 'transparent', color: 'var(--k-text-2)' }
      }
    >
      {p.children}
    </button>
  );
}

/** Navigation of the main window (spec J3 § 4.1). */
export function Sidebar({ route, onRoute }: { route: Route; onRoute(r: Route): void }) {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    void commands.appInfo().then((r) => {
      if (r.status === 'ok') setVersion(r.data.version);
    });
  }, []);

  return (
    <aside
      className="flex w-60 shrink-0 flex-col gap-5 p-4"
      style={{ background: 'var(--k-surface)', borderRight: '1px solid var(--k-border)' }}
    >
      <div className="flex items-center gap-2.5 px-2 pt-1">
        <Logo size={24} />
        <span className="text-[17px] font-semibold tracking-tight">kirishot</span>
      </div>
      <button
        type="button"
        onClick={() => void commands.startCapture()}
        className="k-press flex h-10 items-center justify-center gap-2 rounded-lg border-0 text-[13.5px] font-semibold"
        style={{ background: 'var(--k-accent)', color: 'var(--k-ink)' }}
      >
        <Camera size={16} strokeWidth={2} />
        {t('main.newCapture')}
      </button>
      <nav aria-label="Kirishot" className="flex flex-col gap-1">
        {navItems().map((item) => (
          <NavLink
            key={item.route}
            active={route === item.route}
            onClick={() => onRoute(item.route)}
          >
            <item.icon size={16} strokeWidth={1.9} />
            {t(item.label)}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-2">
        <NavLink active={route === 'about'} onClick={() => onRoute('about')}>
          <Info size={16} strokeWidth={1.9} />
          {t('main.about')}
        </NavLink>
        {version && (
          <p className="m-0 px-3 text-[12px]" style={{ color: 'var(--k-text-3)' }}>
            {t('main.version', { version })}
          </p>
        )}
      </div>
    </aside>
  );
}
