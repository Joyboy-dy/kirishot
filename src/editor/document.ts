// The editor's document (spec J2 § 4.3): annotations in image pixels, immutable updates.
// Naming vs spec v1 § 7.2: J2 has no gaussian blur, so the blur annotation is `tool: 'pixelate'`;
// text keeps Geist 600 only, so `font` becomes `size` + `style`.

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type Stroke = {
  color: string;
  width: number;
  opacity: number;
  dash: 'solid' | 'dashed' | 'dotted';
};
export type Fill = { kind: 'none' | 'translucent' | 'solid'; color: string };
export type TextStyle = 'plain' | 'pill' | 'outline';

export type Annotation =
  | {
      id: string;
      tool: 'arrow';
      points: [Point, Point];
      control: Point | null;
      stroke: Stroke;
      shadow: boolean;
    }
  | { id: string; tool: 'line'; points: [Point, Point]; stroke: Stroke }
  | { id: string; tool: 'rect' | 'ellipse'; box: Rect; stroke: Stroke; fill: Fill; shadow: boolean }
  | { id: string; tool: 'pen'; points: Point[]; stroke: Stroke }
  | { id: string; tool: 'highlighter'; points: Point[]; color: string; width: number }
  | {
      id: string;
      tool: 'text';
      at: Point;
      text: string;
      size: number;
      color: string;
      style: TextStyle;
    }
  | { id: string; tool: 'step'; at: Point; color: string; size: number }
  | { id: string; tool: 'pixelate'; box: Rect };

export type Doc = {
  version: 1;
  captureId: string;
  size: { w: number; h: number };
  crop: Rect | null;
  annotations: Annotation[];
};

export function newDoc(captureId: string, w: number, h: number): Doc {
  return { version: 1, captureId, size: { w, h }, crop: null, annotations: [] };
}

export function add(d: Doc, a: Annotation): Doc {
  return { ...d, annotations: [...d.annotations, a] };
}

export function update(d: Doc, id: string, patch: Partial<Annotation>): Doc {
  return {
    ...d,
    annotations: d.annotations.map((a) => (a.id === id ? ({ ...a, ...patch } as Annotation) : a)),
  };
}

export function remove(d: Doc, ids: string[]): Doc {
  return { ...d, annotations: d.annotations.filter((a) => !ids.includes(a.id)) };
}

export function reorder(d: Doc, id: string, to: 'front' | 'back'): Doc {
  const moved = d.annotations.find((a) => a.id === id);
  if (!moved) return d;
  const rest = d.annotations.filter((a) => a.id !== id);
  return { ...d, annotations: to === 'front' ? [...rest, moved] : [moved, ...rest] };
}

const shift = (p: Point, o: Point): Point => ({ x: p.x + o.x, y: p.y + o.y });

/** The same annotation moved by `o`. */
export function translate(a: Annotation, o: Point): Annotation {
  switch (a.tool) {
    case 'arrow':
      return {
        ...a,
        points: [shift(a.points[0], o), shift(a.points[1], o)],
        control: a.control && shift(a.control, o),
      };
    case 'line':
      return { ...a, points: [shift(a.points[0], o), shift(a.points[1], o)] };
    case 'pen':
    case 'highlighter':
      return { ...a, points: a.points.map((p) => shift(p, o)) };
    case 'text':
    case 'step':
      return { ...a, at: shift(a.at, o) };
    case 'rect':
    case 'ellipse':
    case 'pixelate':
      return { ...a, box: { ...a.box, x: a.box.x + o.x, y: a.box.y + o.y } };
  }
}

export function newId(): string {
  return crypto.randomUUID();
}

/** Copies of `ids` moved by `offset`, added on top; returns the copies' ids. */
export function duplicate(d: Doc, ids: string[], offset: Point): { doc: Doc; ids: string[] } {
  const copies = d.annotations
    .filter((a) => ids.includes(a.id))
    .map((a) => ({ ...translate(a, offset), id: newId() }) as Annotation);
  return {
    doc: { ...d, annotations: [...d.annotations, ...copies] },
    ids: copies.map((c) => c.id),
  };
}

/** 1-based number of a step among the steps, in document order. */
export function stepNumber(d: Doc, id: string): number {
  return d.annotations.filter((a) => a.tool === 'step').findIndex((a) => a.id === id) + 1;
}

export function setCrop(d: Doc, crop: Rect | null): Doc {
  if (!crop) return { ...d, crop: null };
  const x = Math.max(0, crop.x);
  const y = Math.max(0, crop.y);
  const right = Math.min(d.size.w, crop.x + crop.width);
  const bottom = Math.min(d.size.h, crop.y + crop.height);
  return {
    ...d,
    crop: { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) },
  };
}
