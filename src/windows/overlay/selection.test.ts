import { describe, expect, it } from 'vitest';
import type { Handle } from '@/lib/geometry';
import type { Rect, WindowInfo } from '@/lib/ipc';
import {
  cursorFor,
  initialState,
  step,
  type Ctx,
  type Outcome,
  type SelEvent,
  type SelState,
} from './selection';

const W: WindowInfo = {
  index: 0,
  title: 'main.rs — kirishot',
  appName: 'code',
  bounds: { x: 990, y: 196, width: 390, height: 452 },
};
const ctx: Ctx = {
  mode: 'region',
  windows: [W],
  bounds: { width: 1920, height: 1080 },
  commitOnRelease: false,
};
const run = (events: SelEvent[], c = ctx, from: SelState = initialState) =>
  events.reduce(
    (acc, e) => {
      const r = step(acc.state, e, c);
      return { state: r.state, outcomes: [...acc.outcomes, r.outcome] };
    },
    { state: from, outcomes: [] as Outcome[] },
  );
const down = (x: number, y: number, inside = false, handle: Handle | null = null): SelEvent => ({
  type: 'pointerDown',
  at: { x, y },
  handle,
  inside,
});
const move = (x: number, y: number, shift = false, alt = false, space = false): SelEvent => ({
  type: 'pointerMove',
  at: { x, y },
  shift,
  alt,
  space,
});
const up = (x: number, y: number): SelEvent => ({ type: 'pointerUp', at: { x, y } });
const key = (k: string, shift = false, ctrl = false): SelEvent => ({
  type: 'key',
  key: k,
  shift,
  ctrl,
});
const adjusting = (rect: Rect): SelState => ({ kind: 'adjusting', rect });
const ZONE = { x: 324, y: 266, width: 604, height: 280 };

describe('selection', () => {
  it('hovering a window highlights it', () => {
    expect(run([move(1000, 200)]).state).toEqual({ kind: 'idle', hover: W });
  });

  it('drag then release enters adjusting and claims first', () => {
    const r = run([down(324, 266), move(928, 546), up(928, 546)]);
    expect(r.outcomes[0]).toEqual({ type: 'claim' });
    expect(r.state).toEqual(adjusting(ZONE));
  });

  it('commitOnRelease commits on release', () => {
    const r = run([down(324, 266), move(928, 546), up(928, 546)], {
      ...ctx,
      commitOnRelease: true,
    });
    expect(r.outcomes.at(-1)).toEqual({ type: 'commit', target: { kind: 'region', rect: ZONE } });
  });

  it('a click on a hovered window commits that window', () => {
    const r = run([move(1000, 200), down(1000, 200), up(1001, 201)]);
    expect(r.outcomes.at(-1)).toEqual({ type: 'commit', target: { kind: 'window', index: 0 } });
  });

  it('a click on empty space commits nothing', () => {
    const r = run([move(10, 10), down(10, 10), up(10, 10)]);
    expect(r.state).toEqual({ kind: 'idle', hover: null });
    expect(r.outcomes.some((o) => o.type === 'commit')).toBe(false);
  });

  it('Enter and double-click commit the adjusted region', () => {
    const commit = { type: 'commit', target: { kind: 'region', rect: ZONE } };
    expect(step(adjusting(ZONE), key('Enter'), ctx).outcome).toEqual(commit);
    expect(step(adjusting(ZONE), { type: 'doubleClick', inside: true }, ctx).outcome).toEqual(
      commit,
    );
    expect(step(adjusting(ZONE), { type: 'doubleClick', inside: false }, ctx).outcome).toEqual({
      type: 'none',
    });
  });

  it('arrows nudge 1 px, shift-arrows 10 px, clamped', () => {
    const start = adjusting({ x: 0, y: 0, width: 10, height: 10 });
    expect(run([key('ArrowRight')], ctx, start).state).toEqual(
      adjusting({ x: 1, y: 0, width: 10, height: 10 }),
    );
    expect(run([key('ArrowRight'), key('ArrowDown', true)], ctx, start).state).toEqual(
      adjusting({ x: 1, y: 10, width: 10, height: 10 }),
    );
    const lefts = Array.from({ length: 5 }, () => key('ArrowLeft'));
    expect(run([key('ArrowRight'), ...lefts], ctx, start).state).toEqual(
      adjusting({ x: 0, y: 0, width: 10, height: 10 }),
    );
  });

  it('handle drag resizes', () => {
    const start = adjusting({ x: 100, y: 100, width: 100, height: 100 });
    const r = run([down(200, 200, false, 'se'), move(500, 400), up(500, 400)], ctx, start);
    expect(r.state).toEqual(adjusting({ x: 100, y: 100, width: 400, height: 300 }));
  });

  it('inside drag moves', () => {
    const start = adjusting({ x: 100, y: 100, width: 100, height: 100 });
    const r = run([down(150, 150, true), move(160, 155), up(160, 155)], ctx, start);
    expect(r.state).toEqual(adjusting({ x: 110, y: 105, width: 100, height: 100 }));
  });

  it('a press outside starts a new selection and claims', () => {
    const r = run([down(10, 10)], ctx, adjusting(ZONE));
    expect(r.state.kind).toBe('dragging');
    expect(r.outcomes[0]).toEqual({ type: 'claim' });
  });

  it('Escape cancels from any state', () => {
    const states: SelState[] = [
      initialState,
      { kind: 'dragging', anchor: { x: 0, y: 0 }, last: { x: 0, y: 0 }, rect: ZONE, hover: null },
      adjusting(ZONE),
    ];
    for (const s of states) expect(step(s, key('Escape'), ctx).outcome).toEqual({ type: 'cancel' });
  });

  it('window mode never drags', () => {
    const r = run([down(10, 10), move(400, 400)], { ...ctx, mode: 'window' });
    expect(r.state.kind).not.toBe('dragging');
  });

  it('window mode ignores a release whose press was not on the overlay', () => {
    // A toolbar button stops pointerdown, so its pointerup arrives alone.
    const r = run([move(1000, 200), up(1000, 200)], { ...ctx, mode: 'window' });
    expect(r.outcomes.at(-1)).toEqual({ type: 'none' });
    expect(r.state).toEqual({ kind: 'idle', hover: W });
  });

  it('window mode click commits the hovered window', () => {
    const r = run([move(1000, 200), down(1000, 200), up(1000, 200)], { ...ctx, mode: 'window' });
    expect(r.outcomes.at(-1)).toEqual({ type: 'commit', target: { kind: 'window', index: 0 } });
  });

  it('reset returns to idle', () => {
    expect(step(adjusting(ZONE), { type: 'reset' }, ctx).state).toEqual(initialState);
  });

  it('R W F switch modes', () => {
    expect(step(initialState, key('r'), ctx).outcome).toEqual({ type: 'mode', mode: 'region' });
    expect(step(initialState, key('W', true), ctx).outcome).toEqual({
      type: 'mode',
      mode: 'window',
    });
    expect(step(adjusting(ZONE), key('f'), ctx).outcome).toEqual({ type: 'fullscreen' });
    expect(step(initialState, key('r', false, true), ctx).outcome).toEqual({ type: 'none' });
  });

  it('space while dragging moves the rectangle instead of resizing it', () => {
    const r = run([down(100, 100), move(300, 200), move(350, 260, false, false, true)]);
    expect(r.state).toMatchObject({
      kind: 'dragging',
      rect: { x: 150, y: 160, width: 200, height: 100 },
    });
    const r2 = run([move(400, 300)], ctx, r.state);
    expect(r2.state).toMatchObject({ rect: { x: 150, y: 160, width: 250, height: 140 } });
  });

  it('alt draws from the centre', () => {
    const r = run([down(500, 500), move(600, 550, false, true)]);
    expect(r.state).toMatchObject({ rect: { x: 400, y: 450, width: 200, height: 100 } });
  });

  it('ctrl+C on an adjusted selection commits copy-only', () => {
    const r = step(adjusting(ZONE), key('c', false, true), ctx);
    expect(r.outcome).toEqual({
      type: 'commit',
      target: { kind: 'region', rect: ZONE },
      copyOnly: true,
    });
  });

  it('cursor follows the handle and the state', () => {
    expect(cursorFor('nw', 'adjusting', false, false)).toBe('nwse-resize');
    expect(cursorFor('n', 'adjusting', false, false)).toBe('ns-resize');
    expect(cursorFor(null, 'idle', false, false)).toBe('crosshair');
    expect(cursorFor(null, 'dragging', true, false)).toBe('grabbing');
    expect(cursorFor(null, 'adjusting', false, true)).toBe('move');
    expect(cursorFor(null, 'moving', false, true)).toBe('move');
  });
});
