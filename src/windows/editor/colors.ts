// Custom colours: the recent list, typed hex values and the eyedropper (spec J3 § 3.4).

const RECENT_MAX = 8;

/** `abc`, `#abc`, `a1b2c3`, `#A1B2C3` → `#A1B2C3`; anything else → `null`. */
export function normalizeHex(input: string): string | null {
  const hex = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) return `#${[...hex].map((c) => c + c).join('')}`.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(hex)) return `#${hex}`.toUpperCase();
  return null;
}

/** `color` first, without repeating it, eight colours at most. */
export function pushRecent(list: string[], color: string): string[] {
  const c = normalizeHex(color) ?? color.toUpperCase();
  return [c, ...list.filter((x) => x.toUpperCase() !== c)].slice(0, RECENT_MAX);
}

/** The EyeDropper API (WebView2): picks a colour anywhere on the screen. */
export function hasEyeDropper(w: Window): boolean {
  return 'EyeDropper' in w;
}

type EyeDropperApi = { open(): Promise<{ sRGBHex: string }> };

/** A colour picked on the screen, or `null` when cancelled (Échap). */
export async function pickScreenColor(): Promise<string | null> {
  const Ctor = (window as unknown as { EyeDropper?: new () => EyeDropperApi }).EyeDropper;
  if (!Ctor) return null;
  try {
    const { sRGBHex } = await new Ctor().open();
    return normalizeHex(sRGBHex);
  } catch {
    return null;
  }
}
