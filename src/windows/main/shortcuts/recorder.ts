// Showing a global shortcut (spec J3 § 4.3). Recording one happens in Rust on Windows, in the
// keyboard hook, because Windows keeps Win combinations from the page; on Linux the page records
// the combination itself.
import { isLinux } from '@/lib/platform';

const NAMES: Record<string, string> = {
  Super: isLinux ? 'Super' : 'Win',
  Shift: 'Maj',
  PrintScreen: 'Impr. écran',
  Space: 'Espace',
  Insert: 'Inser',
  Home: 'Début',
  End: 'Fin',
  PageUp: 'Pg. préc.',
  PageDown: 'Pg. suiv.',
};

/** `Super+Shift+S` → `['Win', 'Maj', 'S']` (or `['Super', …]` on Linux). */
export function displayAccel(accel: string): string[] {
  return accel.split('+').map((k) => NAMES[k] ?? k);
}

const KEY_NAMES: Record<string, string> = {
  Space: 'Space',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  PrintScreen: 'PrintScreen',
  ArrowLeft: 'ArrowLeft',
  ArrowUp: 'ArrowUp',
  ArrowRight: 'ArrowRight',
  ArrowDown: 'ArrowDown',
};

/** The Tauri name of a physical key; `null` for modifiers and keys a shortcut cannot use. */
function keyName(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  return KEY_NAMES[code] ?? null;
}

/**
 * What a key press means while recording on Linux, in Tauri syntax (`Super+Shift+S`).
 * `undefined` waits for another key, `null` cancels (Échap).
 */
export function accelFromKey(e: KeyboardEvent): string | null | undefined {
  if (e.code === 'Escape') return null;
  const name = keyName(e.code);
  if (!name) return undefined;
  const mods = [
    [e.metaKey, 'Super'],
    [e.ctrlKey, 'Ctrl'],
    [e.altKey, 'Alt'],
    [e.shiftKey, 'Shift'],
  ]
    .filter(([on]) => on)
    .map(([, n]) => n as string);
  // A plain key would steal typing everywhere; PrintScreen and F-keys may stand alone. A
  // letter or digit needs Ctrl or Super: Maj+A or Alt+1 are typed every day.
  const standsAlone = name === 'PrintScreen' || /^F\d+$/.test(name);
  if (mods.length === 0 && !standsAlone) return undefined;
  const typed = name.length === 1;
  if (typed && !(e.ctrlKey || e.metaKey)) return undefined;
  return [...mods, name].join('+');
}
