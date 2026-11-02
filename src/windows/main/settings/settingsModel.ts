// The settings page's tabs and the name-template helper (spec J3 § 4.4).

export const SETTINGS_TABS = ['general', 'capture', 'afterCapture', 'history'] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

/** The name-template tokens offered under the field (spec v1 § 7.3). */
export const NAME_TOKENS = ['{date}', '{heure}', '{fenêtre}', '{n}'] as const;

/** `token` inserted at `caret`; the caret moves after it. */
export function insertToken(
  value: string,
  caret: number,
  token: string,
): { value: string; caret: number } {
  const at = Math.max(0, Math.min(caret, value.length));
  return { value: value.slice(0, at) + token + value.slice(at), caret: at + token.length };
}
