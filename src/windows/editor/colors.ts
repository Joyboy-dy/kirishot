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

/**
 * The eyedropper: the colour of the capture's pixel at `at` (image pixels), or `null` outside it.
 * It reads the capture itself: WebView2 exposes the screen EyeDropper API but never opens it.
 */
export function pixelColor(
  pixels: { width: number; height: number; data: ArrayLike<number> },
  at: { x: number; y: number },
): string | null {
  const x = Math.floor(at.x);
  const y = Math.floor(at.y);
  if (x < 0 || y < 0 || x >= pixels.width || y >= pixels.height) return null;
  const i = (y * pixels.width + x) * 4;
  const hex = [0, 1, 2].map((c) => pixels.data[i + c].toString(16).padStart(2, '0')).join('');
  return `#${hex}`.toUpperCase();
}
