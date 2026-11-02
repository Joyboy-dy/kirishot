import type { CSSProperties } from 'react';
import { physicalToCss, type Handle } from '@/lib/geometry';
import type { Rect, WindowInfo } from '@/lib/ipc';
import { t } from '@/i18n';
import { cursorFor, truncateTitle } from './selection';

const DIM = 'rgba(4, 5, 10, 0.58)';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const chip: CSSProperties = {
  position: 'absolute',
  padding: '3px 7px',
  borderRadius: 6,
  background: 'rgba(14, 16, 20, 0.88)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  color: '#eceef2',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  lineHeight: '16px',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
};

/** Places a chip above the rectangle's top-left corner, or inside when there is no room. */
function chipPosition(r: Rect): CSSProperties {
  return r.y >= 28 ? { left: r.x, top: r.y - 26 } : { left: r.x + 6, top: r.y + 6 };
}

function handleStyle(h: Handle, r: Rect): CSSProperties {
  const x = h.includes('w') ? r.x : h.includes('e') ? r.x + r.width : r.x + r.width / 2;
  const y = h.includes('n') ? r.y : h.includes('s') ? r.y + r.height : r.y + r.height / 2;
  return {
    position: 'absolute',
    left: x - 4,
    top: y - 4,
    width: 8,
    height: 8,
    boxSizing: 'border-box',
    borderRadius: 2,
    background: '#fff',
    border: '1.5px solid var(--k-accent)',
    cursor: cursorFor(h, 'adjusting', false, false),
  };
}

type Props = {
  scale: number;
  /** The selection, in physical pixels; `null` while nothing is drawn. */
  rect: Rect | null;
  hover: WindowInfo | null;
  withHandles: boolean;
};

/** Dims the frozen screen except the selection or the hovered window. */
export function SelectionLayer({ scale, rect, hover, withHandles }: Props) {
  const target = rect ?? hover?.bounds ?? null;
  if (!target) return <div style={{ position: 'absolute', inset: 0, background: DIM }} />;

  const r = physicalToCss(target, scale);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: r.x,
          top: r.y,
          width: r.width,
          height: r.height,
          boxShadow: `0 0 0 100000px ${DIM}`,
          outline: rect ? '1.5px solid var(--k-accent)' : '2px solid var(--k-accent)',
          outlineOffset: rect ? 0 : -2,
          pointerEvents: 'none',
        }}
      />
      {rect ? (
        <span style={{ ...chip, ...chipPosition(r) }}>
          {t('overlay.size', { w: rect.width, h: rect.height })}
        </span>
      ) : (
        hover && (
          <span style={{ ...chip, ...chipPosition(r) }}>
            {t('overlay.windowLabel', {
              title: truncateTitle(hover.title),
              w: hover.bounds.width,
              h: hover.bounds.height,
            })}
          </span>
        )
      )}
      {rect &&
        withHandles &&
        HANDLES.map((h) => <div key={h} data-handle={h} style={handleStyle(h, r)} />)}
    </>
  );
}
