import { useEffect, useState } from 'react';
import { commands, events, unwrap, type SettingsPatch, type SettingsView } from '@/lib/ipc';

/** The settings as Rust sees them, kept in sync through the `settings-changed` event. */
export function useSettings() {
  const [view, setView] = useState<SettingsView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void commands
      .settingsGet()
      .then(unwrap)
      .then(setView)
      .catch((e: Error) => setError(e.message));
    const unlisten = events.settingsChanged.listen((e) => setView(e.payload));
    return () => void unlisten.then((stop) => stop());
  }, []);

  const update = async (patch: SettingsPatch) => {
    try {
      setView(unwrap(await commands.settingsUpdate(patch)));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return { view, update, error };
}
