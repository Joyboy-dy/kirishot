import type { ToolId } from './tools/catalog';

/** What the pointer is over on the canvas. */
export type Hover = 'none' | 'annotation' | 'handle' | { anchor: string };

export type CursorState = {
  tool: ToolId;
  /** Space held: a drag pans the view. */
  panning: boolean;
  /** The view is being panned. */
  panDragging: boolean;
  /** An annotation, a handle or an anchor is being dragged. */
  dragging: boolean;
  hover: Hover;
};

const RESIZE: Record<string, string> = {
  'top-left': 'nwse-resize',
  'bottom-right': 'nwse-resize',
  'top-right': 'nesw-resize',
  'bottom-left': 'nesw-resize',
  'top-center': 'ns-resize',
  'bottom-center': 'ns-resize',
  'middle-left': 'ew-resize',
  'middle-right': 'ew-resize',
};

/** One cursor per interaction, as in graphic editors: grab what moves, resize what resizes. */
export function cursorFor(s: CursorState): string {
  if (s.panDragging) return 'grabbing';
  if (s.panning) return 'grab';
  if (s.tool === 'text') return 'text';
  if (s.tool !== 'select') return 'crosshair';
  if (typeof s.hover === 'object') return RESIZE[s.hover.anchor] ?? 'default';
  if (s.hover === 'none') return 'default';
  return s.dragging ? 'grabbing' : 'grab';
}

type NodeLike = {
  name(): string;
  findAncestor(selector: string, includeSelf?: boolean): unknown;
};

/** The hover kind of a Konva node: transformer anchors are named `<position> _anchor`. */
export function hoverOf(node: NodeLike | null): Hover {
  if (!node) return 'none';
  const name = node.name();
  if (name.includes('_anchor')) return { anchor: name.split(' ')[0] };
  if (name === 'handle') return 'handle';
  if (node.findAncestor('.annotation', true)) return 'annotation';
  return 'none';
}
