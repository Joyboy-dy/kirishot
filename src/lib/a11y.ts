// Shortcut labels are written the French way on screen (« Ctrl+Maj+S ») and announced to screen
// readers with the names `aria-keyshortcuts` expects.
const ARIA_NAMES: Record<string, string> = {
  Ctrl: 'Control',
  Maj: 'Shift',
  Alt: 'Alt',
  Win: 'Meta',
  Échap: 'Escape',
  Entrée: 'Enter',
  Espace: 'Space',
  Suppr: 'Delete',
  Tab: 'Tab',
};

/** `['Ctrl', 'Maj', 'S']` → `'Control+Shift+S'`, for `aria-keyshortcuts`. */
export function shortcutAria(keys: string[]): string {
  return keys.map((k) => ARIA_NAMES[k] ?? k).join('+');
}
