import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react';
import type Konva from 'konva';
import { Image as KImage, Layer, Stage } from 'react-konva';
import type { Point } from '@/editor/document';
import { cursorFor, hoverOf, type Hover } from './cursor';
import type { ToolId } from './tools/catalog';
import { pan, zoomAt, type View } from './viewport';

export type CanvasPointer = {
  /** In image pixels. */
  at: Point;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
  /** The Konva node under the pointer, for selection. */
  target: Konva.Node;
  /** Cancels the browser's default action (the focus change of a press). */
  preventDefault(): void;
};

type Props = {
  bitmap: ImageBitmap;
  view: View;
  size: { width: number; height: number };
  /** Space held: dragging pans instead of drawing. */
  panning: boolean;
  /** Picks the cursor, with what the pointer is over. */
  tool: ToolId;
  onView(v: View): void;
  onDown(p: CanvasPointer): void;
  onMove(p: CanvasPointer): void;
  onUp(p: CanvasPointer): void;
  onDoubleClick(p: CanvasPointer): void;
  /** Layer 1, with the image: committed annotations (blend modes need the same layer). */
  annotations: ReactNode;
  /** Layer 2: the annotation being drawn. */
  draft: ReactNode;
  /** Layer 3: handles, transformer, crop frame. Never exported. */
  overlay: ReactNode;
};

/** The image and its annotations, zoomed and panned (spec J2 § 4.1). */
export const Canvas = forwardRef<Konva.Stage, Props>(function Canvas(p, stageRef) {
  const [dragPan, setDragPan] = useState<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<Hover>('none');
  const [dragging, setDragging] = useState(false);
  const viewRef = useRef(p.view);
  useEffect(() => {
    viewRef.current = p.view;
  });

  const pointer = (e: Konva.KonvaEventObject<MouseEvent>): CanvasPointer | null => {
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return null;
    const v = viewRef.current;
    return {
      at: { x: (pos.x - v.x) / v.scale, y: (pos.y - v.y) / v.scale },
      shift: e.evt.shiftKey,
      alt: e.evt.altKey,
      ctrl: e.evt.ctrlKey,
      target: e.target,
      preventDefault: () => e.evt.preventDefault(),
    };
  };

  return (
    <Stage
      ref={stageRef}
      width={p.size.width}
      height={p.size.height}
      style={{
        cursor: cursorFor({
          tool: p.tool,
          panning: p.panning,
          panDragging: dragPan !== null,
          dragging,
          hover,
        }),
      }}
      // Konva drag events bubble here from annotations, handles and anchors.
      onDragStart={() => setDragging(true)}
      onDragEnd={() => setDragging(false)}
      onMouseLeave={() => setHover('none')}
      onWheel={(e) => {
        if (!e.evt.ctrlKey) return;
        e.evt.preventDefault();
        const pos = e.target.getStage()?.getPointerPosition();
        if (pos) p.onView(zoomAt(viewRef.current, Math.pow(1.1, -e.evt.deltaY / 100), pos));
      }}
      onMouseDown={(e) => {
        if (e.evt.button === 1 || (e.evt.button === 0 && p.panning)) {
          e.evt.preventDefault();
          setDragPan({ x: e.evt.clientX, y: e.evt.clientY });
          return;
        }
        if (e.evt.button !== 0) return;
        const ptr = pointer(e);
        if (ptr) p.onDown(ptr);
      }}
      onMouseMove={(e) => {
        if (dragPan) {
          p.onView(pan(viewRef.current, e.evt.clientX - dragPan.x, e.evt.clientY - dragPan.y));
          setDragPan({ x: e.evt.clientX, y: e.evt.clientY });
          return;
        }
        // While dragging, the cursor stays what it was at the press.
        if (!dragging) {
          const next = hoverOf(e.target === e.target.getStage() ? null : e.target);
          setHover((h) => (JSON.stringify(h) === JSON.stringify(next) ? h : next));
        }
        const ptr = pointer(e);
        if (ptr) p.onMove(ptr);
      }}
      onMouseUp={(e) => {
        if (dragPan) return setDragPan(null);
        const ptr = pointer(e);
        if (ptr) p.onUp(ptr);
      }}
      onDblClick={(e) => {
        const ptr = pointer(e);
        if (ptr) p.onDoubleClick(ptr);
      }}
    >
      <Layer name="content" x={p.view.x} y={p.view.y} scaleX={p.view.scale} scaleY={p.view.scale}>
        <KImage image={p.bitmap} listening={false} perfectDrawEnabled={false} />
        {p.annotations}
      </Layer>
      <Layer
        name="draft"
        x={p.view.x}
        y={p.view.y}
        scaleX={p.view.scale}
        scaleY={p.view.scale}
        listening={false}
      >
        {p.draft}
      </Layer>
      <Layer name="ui" x={p.view.x} y={p.view.y} scaleX={p.view.scale} scaleY={p.view.scale}>
        {p.overlay}
      </Layer>
    </Stage>
  );
});
