// Drawing a new annotation: from the press (`anchor`) to the current pointer, in image pixels.
import { newId, type Annotation, type Point, type Rect } from '@/editor/document';
import { snapAngle } from '@/editor/geometry';
import { strokeWidth } from '@/editor/style';
import type { Style } from '../TopBar';
import type { ToolId } from './catalog';

export type Mods = { shift: boolean; alt: boolean };
type Image = { w: number; h: number };

/** Tools drawn by dragging; text, steps, selection and crop work differently. */
export const DRAG_TOOLS: ToolId[] = [
  'arrow',
  'rect',
  'ellipse',
  'line',
  'pen',
  'highlighter',
  'pixelate',
];

function box(a: Point, b: Point, square: boolean): Rect {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  if (square) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * side;
    dy = Math.sign(dy || 1) * side;
  }
  return {
    x: Math.min(a.x, a.x + dx),
    y: Math.min(a.y, a.y + dy),
    width: Math.abs(dx),
    height: Math.abs(dy),
  };
}

export function strokeOf(style: Style, image: Image) {
  return {
    color: style.color,
    width: strokeWidth(image, style.size),
    opacity: 1,
    dash: 'solid' as const,
  };
}

export function begin(tool: ToolId, at: Point, style: Style, image: Image): Annotation | null {
  const id = newId();
  const stroke = strokeOf(style, image);
  const fill = {
    kind: style.fill ? ('translucent' as const) : ('none' as const),
    color: style.color,
  };
  const zero = { ...at, width: 0, height: 0 };
  switch (tool) {
    case 'arrow':
      return { id, tool, points: [at, at], control: null, stroke, shadow: style.shadow };
    case 'line':
      return { id, tool, points: [at, at], stroke, shadow: style.shadow };
    case 'rect':
    case 'ellipse':
      return { id, tool, box: zero, stroke, fill, shadow: style.shadow };
    case 'pen':
      return { id, tool, points: [at], stroke };
    case 'highlighter':
      return { id, tool, points: [at], color: style.color, width: stroke.width * 4, opacity: 1 };
    case 'pixelate':
      return { id, tool, box: zero, block: 16 };
    default:
      return null;
  }
}

export function extend(a: Annotation, anchor: Point, at: Point, mods: Mods): Annotation {
  switch (a.tool) {
    case 'arrow':
    case 'line':
      return { ...a, points: [anchor, mods.shift ? snapAngle(anchor, at) : at] };
    case 'rect':
    case 'ellipse':
    case 'pixelate':
      return { ...a, box: box(anchor, at, mods.shift && a.tool !== 'pixelate') };
    case 'pen':
      return { ...a, points: [...a.points, at] };
    case 'highlighter':
      // Shift: a straight stroke from the press.
      return { ...a, points: mods.shift ? [anchor, at] : [...a.points, at] };
    default:
      return a;
  }
}

/** The finished annotation, or `null` when it is too small to mean anything. */
export function finish(a: Annotation): Annotation | null {
  const MIN = 3;
  switch (a.tool) {
    case 'arrow':
    case 'line': {
      const [p, q] = a.points;
      return Math.hypot(q.x - p.x, q.y - p.y) < MIN ? null : a;
    }
    case 'rect':
    case 'ellipse':
    case 'pixelate':
      return a.box.width < MIN || a.box.height < MIN ? null : a;
    case 'pen':
    case 'highlighter':
      return a.points.length < 2 ? null : a;
    default:
      return a;
  }
}
