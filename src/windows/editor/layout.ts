// How the editor's top bar fits its width (spec J2.1 § 4.1).

export type ToolbarLayout = 'full' | 'compact' | 'narrow';

/**
 * `fullFrom`: the width from which the full bar fits, raised when it was seen to overflow (its
 * style options are wider for some tools); never below the spec's 1 100 px.
 */
/** Where the selection's actions (order, duplicate, delete) go (spec J3 § 3.1). */
export function selectionActionsPlacement(layout: ToolbarLayout): 'bar' | 'menu' {
  return layout === 'narrow' ? 'menu' : 'bar';
}

export function toolbarLayout(width: number, fullFrom = 1100): ToolbarLayout {
  if (width >= Math.max(1100, fullFrom)) return 'full';
  if (width >= 760) return 'compact';
  return 'narrow';
}
