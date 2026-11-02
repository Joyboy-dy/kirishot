// Which settings apply to which annotation: the single source for the top bar and the bubble
// (spec J2.1 § 3.1). An option is only shown where it changes something.
import type { Annotation, Block, Doc, Fill, Stroke, TextStyle } from '@/editor/document';
import { strokeWidth, type SizeStep } from '@/editor/style';
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

export type StylePatch = Partial<{
  color: string;
  size: SizeStep;
  dash: Stroke['dash'];
  fill: Fill['kind'];
  shadow: boolean;
  opacity: number;
  textStyle: TextStyle;
  strength: Block;
}>;

const KEY_OPTION: Record<keyof StylePatch, Option> = {
  color: 'color',
  size: 'size',
  dash: 'dash',
  fill: 'fill',
  shadow: 'shadow',
  opacity: 'opacity',
  textStyle: 'textStyle',
  strength: 'strength',
};

/** `patch` keeping only what applies to `a`, by the table above. */
function applicable(a: Annotation, patch: StylePatch): StylePatch {
  const keys = (Object.keys(patch) as (keyof StylePatch)[]).filter((k) =>
    OPTIONS[a.tool].includes(KEY_OPTION[k]),
  );
  return Object.fromEntries(keys.map((k) => [k, patch[k]])) as StylePatch;
}

/** One annotation with the style applied; sizes are steps turned into image pixels. */
function restyle(a: Annotation, p: StylePatch, image: { w: number; h: number }): Annotation {
  const width = p.size ? strokeWidth(image, p.size) : undefined;
  switch (a.tool) {
    case 'arrow':
    case 'line':
    case 'pen':
    case 'rect':
    case 'ellipse': {
      const stroke = {
        ...a.stroke,
        color: p.color ?? a.stroke.color,
        width: width ?? a.stroke.width,
        dash: p.dash ?? a.stroke.dash,
        opacity: p.opacity ?? a.stroke.opacity,
      };
      if (a.tool === 'pen') return { ...a, stroke };
      if (a.tool === 'arrow' || a.tool === 'line')
        return { ...a, stroke, shadow: p.shadow ?? a.shadow };
      return {
        ...a,
        stroke,
        shadow: p.shadow ?? a.shadow,
        fill: { kind: p.fill ?? a.fill.kind, color: p.color ?? a.fill.color },
      };
    }
    case 'highlighter':
      return {
        ...a,
        color: p.color ?? a.color,
        width: width ? width * 4 : a.width,
        opacity: p.opacity ?? a.opacity,
      };
    case 'text':
      return {
        ...a,
        color: p.color ?? a.color,
        size: width ? width * 6 : a.size,
        style: p.textStyle ?? a.style,
      };
    case 'step':
      return { ...a, color: p.color ?? a.color, size: width ?? a.size };
    case 'pixelate':
      return { ...a, block: p.strength ?? a.block };
  }
}

/** The style applied to the annotations `ids`, each only where it applies: one new document. */
export function applyStyle(doc: Doc, ids: string[], patch: StylePatch): Doc {
  return {
    ...doc,
    annotations: doc.annotations.map((a) =>
      ids.includes(a.id) ? restyle(a, applicable(a, patch), doc.size) : a,
    ),
  };
}

const STEPS: SizeStep[] = [1, 2, 3, 4];

/** The step whose stroke width is `px`, if any. */
function stepOf(px: number, image: { w: number; h: number }): SizeStep | undefined {
  return STEPS.find((s) => strokeWidth(image, s) === px);
}

/** An annotation's settings, as the controls show them (only the ones it has). */
export function styleOf(a: Annotation, image: { w: number; h: number }): StylePatch {
  switch (a.tool) {
    case 'arrow':
    case 'line':
    case 'pen':
    case 'rect':
    case 'ellipse': {
      const base: StylePatch = {
        color: a.stroke.color,
        size: stepOf(a.stroke.width, image),
        dash: a.stroke.dash,
        opacity: a.stroke.opacity,
      };
      if (a.tool === 'pen') return { color: base.color, size: base.size, opacity: base.opacity };
      if (a.tool === 'arrow' || a.tool === 'line') return { ...base, shadow: a.shadow };
      return { ...base, shadow: a.shadow, fill: a.fill.kind };
    }
    case 'highlighter':
      return { color: a.color, size: stepOf(a.width / 4, image), opacity: a.opacity };
    case 'text':
      return { color: a.color, size: stepOf(a.size / 6, image), textStyle: a.style };
    case 'step':
      return { color: a.color, size: stepOf(a.size, image) };
    case 'pixelate':
      return { strength: a.block };
  }
}
