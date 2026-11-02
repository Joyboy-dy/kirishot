// Defaults that make annotations look right with no setting changed (spec J2 § 4.1).

/** Kirishot orange, red, yellow, green, blue, violet, black, white. */
export const PALETTE: readonly string[] = [
  '#FF5B38',
  '#F04438',
  '#FACC15',
  '#22C55E',
  '#3B82F6',
  '#8B5CF6',
  '#111318',
  '#FFFFFF',
];

export type SizeStep = 1 | 2 | 3 | 4;
const FACTORS: Record<SizeStep, number> = { 1: 0.5, 2: 1, 3: 1.75, 4: 2.75 };

/** Stroke width in image pixels: « moyen » is max(2, round(min(w, h) / 300)). */
export function strokeWidth(image: { w: number; h: number }, step: SizeStep): number {
  const medium = Math.max(2, Math.round(Math.min(image.w, image.h) / 300));
  return Math.max(1, Math.round(medium * FACTORS[step]));
}
