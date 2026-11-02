// Showing a global shortcut (spec J3 § 4.3). Recording one happens in Rust, in the keyboard
// hook: Windows keeps Win combinations from the page.

const NAMES: Record<string, string> = {
  Super: 'Win',
  Shift: 'Maj',
  PrintScreen: 'Impr. écran',
  Space: 'Espace',
  Insert: 'Inser',
  Home: 'Début',
  End: 'Fin',
  PageUp: 'Pg. préc.',
  PageDown: 'Pg. suiv.',
};

/** `Super+Shift+S` → `['Win', 'Maj', 'S']`. */
export function displayAccel(accel: string): string[] {
  return accel.split('+').map((k) => NAMES[k] ?? k);
}
