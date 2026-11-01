// Interface texts. French only until J6 adds English.
import fr from './fr.json';

export type MessageKey = keyof typeof fr;

/** The text for `key`, with each `{name}` replaced by `vars.name`. */
export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  return fr[key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
