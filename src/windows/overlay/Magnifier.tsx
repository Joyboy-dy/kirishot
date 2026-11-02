import { useEffect, useRef, type RefObject } from 'react';
import { magnifierPlacement, type Point } from '@/lib/geometry';
import { pixelHex, type Frame } from '@/lib/frame';
import { t } from '@/i18n';

const SIZE = 128; // CSS pixels
const PIXELS = 15; // source pixels per side
const CELL = SIZE / PIXELS;
const LABEL = 34; // height of the position and colour line under the grid

type Props = {
  source: RefObject<HTMLCanvasElement | null>;
  /** The frozen screen in memory, to read colours without touching the canvas. */
  frame: Frame | null;
  /** Cursor in physical pixels of the monitor. */
  at: Point;
  scale: number;
};

/** A pixel-accurate zoom of the frozen screen around the cursor, with its position and colour. */
export function Magnifier({ source, frame, at, scale }: Props) {
  const zoom = useRef<HTMLCanvasElement>(null);

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
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
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
  }, [source, at]);

  const hex = frame ? pixelHex(frame, at) : '000000';
  const place = magnifierPlacement(
    { x: at.x / scale, y: at.y / scale },
    { width: SIZE, height: SIZE + LABEL },
    { width: window.innerWidth, height: window.innerHeight },
  );

  return (
    <div style={{ position: 'absolute', left: place.x, top: place.y, pointerEvents: 'none' }}>
      <canvas
        ref={zoom}
        style={{
          display: 'block',
          width: SIZE,
          height: SIZE,
          borderRadius: 14,
          border: '2px solid rgba(255, 255, 255, 0.9)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
        }}
      />
      <div
        className="flex items-center justify-center gap-1.5"
        style={{
          marginTop: 6,
          height: LABEL - 6,
          borderRadius: 8,
          background: 'rgba(14, 16, 20, 0.92)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          color: '#eceef2',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 3,
            background: `#${hex}`,
            border: '1px solid rgba(255, 255, 255, 0.5)',
          }}
        />
        {t('overlay.pixel', { x: at.x, y: at.y, hex: `#${hex}` })}
      </div>
    </div>
  );
}
