// Shapes the editor draws, computed in image pixels (spec J2 § 4.2).
import type { Point } from './document';

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
const unit = (a: Point): Point | null => {
  const len = Math.hypot(a.x, a.y);
  return len < 1e-9 ? null : { x: a.x / len, y: a.y / len };
};
const normal = (d: Point): Point => ({ x: -d.y, y: d.x });

export function quadPoint(from: Point, control: Point, to: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
  };
}

/** `to` moved onto the nearest multiple of `stepDeg` around `from`, at the same distance. */
export function snapAngle(from: Point, to: Point, stepDeg = 15): Point {
  const step = (stepDeg * Math.PI) / 180;
  const angle = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / step) * step;
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  return { x: from.x + len * Math.cos(angle), y: from.y + len * Math.sin(angle) };
}

/**
 * The filled outline of a tapered arrow: a body from 0.35 × `width` at the tail to `width`, and
 * a solid head of length max(3.2 × width, 10) and half-width 1.6 × width, along the tangent at
 * the tip. Empty when the arrow has no length.
 */
export function arrowOutline(
  from: Point,
  to: Point,
  control: Point | null,
  width: number,
): Point[] {
  const d = unit(sub(to, control ?? from));
  if (!d) return [];
  const headLength = Math.max(3.2 * width, 10);
  const headHalf = 1.6 * width;
  const base = sub(to, mul(d, headLength));
  const n = normal(d);

  // The body's centre line, from the tail to the head's base.
  let spine: Point[] = [from, base];
  if (control) {
    const samples = Array.from({ length: 25 }, (_, i) => quadPoint(from, control, to, i / 24));
    spine = [...samples.filter((p) => Math.hypot(p.x - to.x, p.y - to.y) > headLength), base];
  }
  const half = (i: number) => {
    const f = spine.length < 2 ? 1 : i / (spine.length - 1);
    return width * (0.175 + (0.5 - 0.175) * f);
  };
  const normalAt = (i: number) => {
    if (i === spine.length - 1) return n;
    const local = unit(sub(spine[i + 1], spine[i]));
    return local ? normal(local) : n;
  };
  const left = spine.map((p, i) => add(p, mul(normalAt(i), half(i))));
  const right = spine.map((p, i) => sub(p, mul(normalAt(i), half(i))));
  return [
    ...left,
    add(base, mul(n, headHalf)),
    to,
    sub(base, mul(n, headHalf)),
    ...right.reverse(),
  ];
}
