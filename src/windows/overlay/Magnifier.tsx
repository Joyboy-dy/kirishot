import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Point } from '@/lib/geometry';
import { t } from '@/i18n';

const SIZE = 132; // CSS pixels
const PIXELS = 11; // source pixels per side
const CELL = SIZE / PIXELS; // 12 CSS pixels per source pixel

type Props = {
  source: RefObject<HTMLCanvasElement | null>;
  /** Cursor in physical pixels of the monitor. */
  at: Point;
  scale: number;
};

/** A pixel-accurate zoom of the frozen screen around the cursor, with its position and color. */
export function Magnifier({ source, at, scale }: Props) {
  const zoom = useRef<HTMLCanvasElement>(null);
  const [hex, setHex] = useState('000000');

  useEffect(() => {
    const src = source.current;
    const dst = zoom.current;
    if (!src || !dst || src.width === 0) return;
    const ctx = dst.getContext('2d')!;
    const ratio = window.devicePixelRatio;
    dst.width = SIZE * ratio;
    dst.height = SIZE * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0e1014';
    ctx.fillRect(0, 0, SIZE, SIZE);
    const half = Math.floor(PIXELS / 2);
    ctx.drawImage(src, at.x - half, at.y - half, PIXELS, PIXELS, 0, 0, SIZE, SIZE);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 1; i < PIXELS; i++) {
      const p = Math.round(i * CELL) + 0.5;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, SIZE);
      ctx.moveTo(0, p);
      ctx.lineTo(SIZE, p);
      ctx.stroke();
    }
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--k-accent');
    ctx.lineWidth = 2;
    ctx.strokeRect(half * CELL, half * CELL, CELL, CELL);
    const [r, g, b] = src.getContext('2d')!.getImageData(at.x, at.y, 1, 1).data;
    setHex(
      [r, g, b]
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase(),
    );
  }, [source, at.x, at.y]);

  // Next to the cursor, flipped near the right and bottom edges.
  const cx = at.x / scale;
  const cy = at.y / scale;
  const left = cx + 24 + SIZE > window.innerWidth ? cx - 24 - SIZE : cx + 24;
  const top = cy + 24 + SIZE + 30 > window.innerHeight ? cy - 24 - SIZE - 30 : cy + 24;

  return (
    <div style={{ position: 'absolute', left, top, pointerEvents: 'none' }}>
      <canvas
        ref={zoom}
        style={{
          display: 'block',
          width: SIZE,
          height: SIZE,
          borderRadius: '50%',
          border: '2px solid rgba(255, 255, 255, 0.9)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
        }}
      />
      <div
        className="mono"
        style={{
          marginTop: 8,
          padding: '3px 8px',
          borderRadius: 6,
          background: 'rgba(14, 16, 20, 0.88)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          color: '#eceef2',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {t('overlay.pixel', { x: at.x, y: at.y, hex })}
      </div>
    </div>
  );
}
