// How the editor's top bar fits its width (spec J2.1 § 4.1).

export type ToolbarLayout = 'full' | 'compact' | 'narrow';

export function toolbarLayout(width: number): ToolbarLayout {
  if (width >= 1100) return 'full';
  if (width >= 760) return 'compact';
  return 'narrow';
}
