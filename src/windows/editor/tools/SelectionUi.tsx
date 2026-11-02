import { useEffect, useRef } from 'react';
import type Konva from 'konva';
import { Circle, Rect, Transformer } from 'react-konva';
import type { Annotation, Point, Rect as R } from '@/editor/document';
import { quadPoint } from '@/editor/geometry';

type Props = {
  selected: Annotation[];
  stage: Konva.Stage | null;
  /** CSS pixels per image pixel: handles keep the same size on screen. */
  scale: number;
  /** `final`: the drag ended, the change becomes one undo step. */
  onChange(id: string, patch: Partial<Annotation>, final: boolean): void;
};

const BOXED = new Set(['rect', 'ellipse', 'pixelate']);

function Handle(p: {
  at: Point;
  scale: number;
  onMove(at: Point, final: boolean): void;
  filled?: boolean;
}) {
  return (
    <Circle
      x={p.at.x}
      y={p.at.y}
      radius={6 / p.scale}
      fill={p.filled ? '#FF5B38' : 'white'}
      stroke="#FF5B38"
      strokeWidth={2 / p.scale}
      name="handle"
      draggable
      onMouseDown={(e) => (e.cancelBubble = true)}
      onDragMove={(e) => p.onMove({ x: e.target.x(), y: e.target.y() }, false)}
      onDragEnd={(e) => p.onMove({ x: e.target.x(), y: e.target.y() }, true)}
    />
  );
}

/** Endpoint and bend handles for arrows and lines; a transformer for boxes (spec J2 § 4.2). */
export function SelectionUi({ selected, stage, scale, onChange }: Props) {
  const transformer = useRef<Konva.Transformer>(null);
  const boxed = selected.filter((a) => BOXED.has(a.tool));
  const boxedIds = boxed.map((a) => a.id).join(',');

  useEffect(() => {
    const tr = transformer.current;
    if (!tr || !stage) return;
    const nodes = boxedIds
      .split(',')
      .filter(Boolean)
      .map((id) => stage.findOne(`#${id}`))
      .filter((n): n is Konva.Node => Boolean(n));
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [boxedIds, stage]);

  const single = selected.length === 1 ? selected[0] : null;
  return (
    <>
      <Transformer
        ref={transformer}
        rotateEnabled={false}
        keepRatio={false}
        anchorSize={10}
        anchorCornerRadius={5}
        anchorStroke="#FF5B38"
        borderStroke="#FF5B38"
        ignoreStroke
        onTransformEnd={() => {
          for (const node of transformer.current?.nodes() ?? []) {
            const a = boxed.find((b) => b.id === node.id());
            if (!a) continue;
            const w = node.width() * node.scaleX();
            const h = node.height() * node.scaleY();
            // Ellipses are positioned by their centre.
            const centred = a.tool === 'ellipse';
            const box: R = {
              x: centred ? node.x() - w / 2 : node.x(),
              y: centred ? node.y() - h / 2 : node.y(),
              width: Math.abs(w),
              height: Math.abs(h),
            };
            if (centred) {
              node.scale({ x: 1, y: 1 });
            } else {
              node.scale({ x: 1, y: 1 });
              node.width(box.width);
              node.height(box.height);
            }
            onChange(a.id, { box } as Partial<Annotation>, true);
          }
        }}
      />
      {single && (single.tool === 'arrow' || single.tool === 'line') && (
        <>
          <Handle
            at={single.points[0]}
            scale={scale}
            onMove={(at, final) =>
              onChange(single.id, { points: [at, single.points[1]] } as Partial<Annotation>, final)
            }
          />
          <Handle
            at={single.points[1]}
            scale={scale}
            onMove={(at, final) =>
              onChange(single.id, { points: [single.points[0], at] } as Partial<Annotation>, final)
            }
          />
          {single.tool === 'arrow' && (
            <Handle
              filled
              at={
                single.control
                  ? quadPoint(single.points[0], single.control, single.points[1], 0.5)
                  : {
                      x: (single.points[0].x + single.points[1].x) / 2,
                      y: (single.points[0].y + single.points[1].y) / 2,
                    }
              }
              scale={scale}
              onMove={(mid, final) => {
                // The handle sits on the curve at t = 0.5: solve for the control point.
                const [p, q] = single.points;
                const control = { x: 2 * mid.x - (p.x + q.x) / 2, y: 2 * mid.y - (p.y + q.y) / 2 };
                onChange(single.id, { control } as Partial<Annotation>, final);
              }}
            />
          )}
        </>
      )}
    </>
  );
}

/** The crop frame being drawn or edited: the outside is dimmed. */
export function CropShade({ crop, image }: { crop: R; image: { w: number; h: number } }) {
  const shade = 'rgba(4, 5, 10, 0.6)';
  return (
    <>
      <Rect x={0} y={0} width={image.w} height={crop.y} fill={shade} listening={false} />
      <Rect
        x={0}
        y={crop.y + crop.height}
        width={image.w}
        height={image.h - crop.y - crop.height}
        fill={shade}
        listening={false}
      />
      <Rect x={0} y={crop.y} width={crop.x} height={crop.height} fill={shade} listening={false} />
      <Rect
        x={crop.x + crop.width}
        y={crop.y}
        width={image.w - crop.x - crop.width}
        height={crop.height}
        fill={shade}
        listening={false}
      />
      <Rect
        x={crop.x}
        y={crop.y}
        width={crop.width}
        height={crop.height}
        stroke="white"
        strokeWidth={1}
        dash={[6, 4]}
        listening={false}
        strokeScaleEnabled={false}
      />
    </>
  );
}
