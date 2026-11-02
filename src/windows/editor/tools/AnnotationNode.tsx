import { useMemo } from 'react';
import type Konva from 'konva';
import {
  Circle,
  Ellipse,
  Group,
  Image as KImage,
  Label,
  Line,
  Rect,
  Shape,
  Tag,
  Text,
} from 'react-konva';
import { getStroke } from 'perfect-freehand';
import { stepNumber, type Annotation, type Doc, type Point, type Stroke } from '@/editor/document';
import { arrowOutline } from '@/editor/geometry';
import { pixelateBlocks } from '@/editor/pixelate';

export type NodeEvents = {
  draggable: boolean;
  onSelect(id: string, add: boolean): void;
  onMoved(id: string, dx: number, dy: number, duplicate: boolean): void;
  onEditText(id: string): void;
};

const SHADOW = { shadowColor: 'black', shadowBlur: 6, shadowOffsetY: 2, shadowOpacity: 0.35 };
const DASH: Record<Stroke['dash'], (w: number) => number[] | undefined> = {
  solid: () => undefined,
  dashed: (w) => [w * 3, w * 2],
  dotted: (w) => [0.01, w * 2],
};

function fillPath(ctx: Konva.Context, pts: number[][] | Point[]) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const [x, y] = Array.isArray(p) ? p : [p.x, p.y];
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

/** The pixelated copy of an area, recomputed only when the area changes. */
function Pixelated({
  a,
  pixels,
  common,
}: {
  a: Extract<Annotation, { tool: 'pixelate' }>;
  pixels: ImageData;
  common: object;
}) {
  const { x, y, width, height } = a.box;
  const canvas = useMemo(() => {
    const out = pixelateBlocks(pixels, { x, y, width, height }, 16, a.id.charCodeAt(0) * 7919);
    const c = document.createElement('canvas');
    c.width = Math.max(1, out.width);
    c.height = Math.max(1, out.height);
    if (out.width > 0 && out.height > 0)
      c.getContext('2d')!.putImageData(
        new ImageData(out.data as Uint8ClampedArray<ArrayBuffer>, out.width, out.height),
        0,
        0,
      );
    return c;
  }, [pixels, x, y, width, height, a.id]);
  return (
    <KImage
      {...common}
      image={canvas}
      x={Math.max(0, Math.round(x))}
      y={Math.max(0, Math.round(y))}
    />
  );
}

/** One annotation as Konva nodes. Display and export draw the same nodes (spec J2 § 4.3). */
export function AnnotationNode({
  a,
  doc,
  pixels,
  events,
}: {
  a: Annotation;
  doc: Doc;
  pixels: ImageData;
  events: NodeEvents;
}) {
  const common = {
    id: a.id,
    name: 'annotation',
    draggable: events.draggable,
    hitStrokeWidth: 14,
    perfectDrawEnabled: false,
    onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!events.draggable) return;
      e.cancelBubble = true;
      events.onSelect(a.id, e.evt.shiftKey);
    },
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      // Nodes remember where the document puts them; the drag is the difference.
      const node = e.target as Konva.Node;
      const baseX = Number(node.getAttr('baseX') ?? 0);
      const baseY = Number(node.getAttr('baseY') ?? 0);
      const dx = node.x() - baseX;
      const dy = node.y() - baseY;
      node.position({ x: baseX, y: baseY });
      events.onMoved(a.id, dx, dy, e.evt.altKey);
    },
  };

  switch (a.tool) {
    case 'arrow': {
      const [from, to] = a.points;
      const outline = arrowOutline(from, to, a.control, a.stroke.width);
      return (
        <Shape
          {...common}
          baseX={0}
          baseY={0}
          fill={a.stroke.color}
          stroke="white"
          strokeWidth={Math.max(1, a.stroke.width * 0.5)}
          opacity={a.stroke.opacity}
          {...(a.shadow ? SHADOW : {})}
          sceneFunc={(ctx, shape) => {
            fillPath(ctx, outline);
            ctx.fillStrokeShape(shape);
          }}
        />
      );
    }
    case 'line':
      return (
        <Line
          {...common}
          baseX={0}
          baseY={0}
          points={a.points.flatMap((p) => [p.x, p.y])}
          stroke={a.stroke.color}
          strokeWidth={a.stroke.width}
          opacity={a.stroke.opacity}
          dash={DASH[a.stroke.dash](a.stroke.width)}
          lineCap="round"
        />
      );
    case 'rect':
    case 'ellipse': {
      const fill =
        a.fill.kind === 'none'
          ? undefined
          : a.fill.kind === 'solid'
            ? a.fill.color
            : `${a.fill.color}33`;
      const shape = {
        stroke: a.stroke.color,
        strokeWidth: a.stroke.width,
        opacity: a.stroke.opacity,
        dash: DASH[a.stroke.dash](a.stroke.width),
        fill,
        ...(a.shadow ? SHADOW : {}),
      };
      return a.tool === 'rect' ? (
        <Rect
          {...common}
          {...shape}
          baseX={a.box.x}
          baseY={a.box.y}
          x={a.box.x}
          y={a.box.y}
          width={a.box.width}
          height={a.box.height}
          cornerRadius={6}
        />
      ) : (
        <Ellipse
          {...common}
          {...shape}
          baseX={a.box.x + a.box.width / 2}
          baseY={a.box.y + a.box.height / 2}
          x={a.box.x + a.box.width / 2}
          y={a.box.y + a.box.height / 2}
          radiusX={a.box.width / 2}
          radiusY={a.box.height / 2}
        />
      );
    }
    case 'pen':
    case 'highlighter': {
      const isPen = a.tool === 'pen';
      const size = isPen ? a.stroke.width : a.width;
      const outline = getStroke(
        a.points.map((p) => [p.x, p.y]),
        isPen
          ? { size, thinning: 0.5, smoothing: 0.5, streamline: 0.5 }
          : {
              size,
              thinning: 0,
              smoothing: 0.5,
              streamline: 0.4,
              start: { cap: false },
              end: { cap: false },
            },
      );
      return (
        <Shape
          {...common}
          baseX={0}
          baseY={0}
          fill={isPen ? a.stroke.color : a.color}
          opacity={isPen ? a.stroke.opacity : 1}
          globalCompositeOperation={isPen ? 'source-over' : 'multiply'}
          sceneFunc={(ctx, shape) => {
            fillPath(ctx, outline);
            ctx.fillShape(shape);
          }}
        />
      );
    }
    case 'text': {
      const font = {
        text: a.text || ' ',
        fontSize: a.size,
        fontFamily: 'Geist Variable, sans-serif',
        fontStyle: '600',
        padding: a.style === 'pill' ? a.size * 0.35 : 0,
      };
      const textEvents = { onDblClick: () => events.onEditText(a.id) };
      if (a.style === 'pill')
        return (
          <Label {...common} {...textEvents} baseX={a.at.x} baseY={a.at.y} x={a.at.x} y={a.at.y}>
            <Tag fill={a.color} cornerRadius={a.size * 0.4} {...SHADOW} />
            <Text {...font} fill="white" />
          </Label>
        );
      return (
        <Text
          {...common}
          {...textEvents}
          {...font}
          baseX={a.at.x}
          baseY={a.at.y}
          x={a.at.x}
          y={a.at.y}
          fill={a.color}
          {...(a.style === 'outline'
            ? {
                stroke: 'white',
                strokeWidth: Math.max(2, a.size * 0.12),
                fillAfterStrokeEnabled: true,
              }
            : SHADOW)}
        />
      );
    }
    case 'step': {
      const r = (a.size * 7) / 2;
      return (
        <Group {...common} baseX={a.at.x} baseY={a.at.y} x={a.at.x} y={a.at.y}>
          <Circle
            radius={r}
            fill={a.color}
            stroke="white"
            strokeWidth={Math.max(2, r * 0.14)}
            {...SHADOW}
          />
          <Text
            text={String(stepNumber(doc, a.id))}
            fontSize={r}
            fontFamily="Geist Variable, sans-serif"
            fontStyle="700"
            fill="white"
            width={r * 2}
            height={r * 2}
            offsetX={r}
            offsetY={r}
            align="center"
            verticalAlign="middle"
          />
        </Group>
      );
    }
    case 'pixelate':
      return (
        <Pixelated
          a={a}
          pixels={pixels}
          common={{
            ...common,
            baseX: Math.max(0, Math.round(a.box.x)),
            baseY: Math.max(0, Math.round(a.box.y)),
          }}
        />
      );
  }
}
