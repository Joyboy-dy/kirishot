// Which settings apply to which annotation: the single source for the top bar and the bubble
// (spec J2.1 § 3.1). An option is only shown where it changes something.
import type { Annotation } from '@/editor/document';
import type { ToolId } from './catalog';

export type Option =
  'color' | 'size' | 'dash' | 'fill' | 'shadow' | 'opacity' | 'textStyle' | 'strength';

export const OPTIONS: Record<Annotation['tool'], Option[]> = {
  arrow: ['color', 'size', 'dash', 'shadow', 'opacity'],
  line: ['color', 'size', 'dash', 'shadow', 'opacity'],
  rect: ['color', 'size', 'dash', 'fill', 'shadow', 'opacity'],
  ellipse: ['color', 'size', 'dash', 'fill', 'shadow', 'opacity'],
  pen: ['color', 'size', 'opacity'],
  highlighter: ['color', 'size', 'opacity'],
  text: ['color', 'size', 'textStyle'],
  step: ['color', 'size'],
  pixelate: ['strength'],
};

/** The options every selected annotation has, in the table's order. */
export function optionsFor(items: Annotation[]): Option[] {
  if (items.length === 0) return [];
  const [first, ...rest] = items;
  return OPTIONS[first.tool].filter((o) => rest.every((a) => OPTIONS[a.tool].includes(o)));
}

/** The options of the tool about to draw; selection and crop draw nothing. */
export function toolOptions(tool: ToolId): Option[] {
  return tool === 'select' || tool === 'crop' ? [] : OPTIONS[tool];
}
