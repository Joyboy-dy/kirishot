// The theme setting applied to a window (spec J3 § 4.4). The selection screen stays dark.
import { commands, events, type Theme } from '@/lib/ipc';

export function resolveTheme(setting: Theme, systemDark: boolean): 'dark' | 'light' {
  if (setting === 'system') return systemDark ? 'dark' : 'light';
  return setting;
}

/** Applies the theme setting to this window now and whenever it or Windows' theme changes. */
export function followTheme(): void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let setting: Theme = 'system';
  const apply = () => {
    document.documentElement.dataset.theme = resolveTheme(setting, media.matches);
  };
  media.addEventListener('change', apply);
  void commands.settingsGet().then((r) => {
    if (r.status === 'ok') {
      setting = r.data.settings.system.theme;
      apply();
    }
  });
  void events.settingsChanged.listen((e) => {
    setting = e.payload.settings.system.theme;
    apply();
  });
  apply();
}
