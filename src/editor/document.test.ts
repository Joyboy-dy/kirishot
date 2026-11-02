import { describe, expect, it } from 'vitest';
import {
  add,
  duplicate,
  newDoc,
  remove,
  reorder,
  setCrop,
  stepNumber,
  update,
  type Annotation,
} from './document';

const empty = newDoc('cap', 1920, 1080);
const step = (id: string): Annotation => ({
  id,
  tool: 'step',
  at: { x: 0, y: 0 },
  color: '#f00',
  size: 4,
});
const rect = (id: string): Annotation => ({
  id,
  tool: 'rect',
  box: { x: 10, y: 10, width: 50, height: 40 },
  stroke: { color: '#f00', width: 4, opacity: 1, dash: 'solid' },
  fill: { kind: 'none', color: '#f00' },
  shadow: true,
});

describe('document', () => {
  it('steps renumber after a deletion', () => {
    let d = [step('s1'), rect('r'), step('s2'), step('s3')].reduce(add, empty);
    expect(stepNumber(d, 's3')).toBe(3);
    d = remove(d, ['s2']);
    expect(stepNumber(d, 's3')).toBe(2);
  });

  it('documents are immutable', () => {
    const d = add(empty, rect('a'));
    add(d, rect('b'));
    expect(d.annotations.length).toBe(1);
    expect(empty.annotations.length).toBe(0);
  });

  it('update merges into one annotation', () => {
    const d = update(add(empty, rect('a')), 'a', { shadow: false });
    expect(d.annotations[0]).toMatchObject({ id: 'a', shadow: false, tool: 'rect' });
  });

  it('reorder moves to the front or the back', () => {
    const d = ['a', 'b', 'c'].map(rect).reduce(add, empty);
    expect(reorder(d, 'a', 'front').annotations.map((a) => a.id)).toEqual(['b', 'c', 'a']);
    expect(reorder(d, 'c', 'back').annotations.map((a) => a.id)).toEqual(['c', 'a', 'b']);
  });

  it('duplicate offsets the copies and gives them new ids', () => {
    const { doc, ids } = duplicate(add(empty, rect('a')), ['a'], { x: 12, y: 12 });
    expect(doc.annotations.length).toBe(2);
    expect(ids.length).toBe(1);
    expect(ids[0]).not.toBe('a');
    expect(doc.annotations[1]).toMatchObject({ box: { x: 22, y: 22, width: 50, height: 40 } });
  });

  it('crop is clamped to the image', () =>
    expect(setCrop(newDoc('c', 100, 50), { x: -10, y: 0, width: 500, height: 20 }).crop).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 20,
    }));
});

describe('crop', () => {
  it('is rounded to whole pixels, so the export never resamples', () =>
    // Edges are rounded: 10.4 → 10, 10.4 + 100.3 = 110.7 → 111, so the width is 101.
    expect(
      setCrop(newDoc('c', 1920, 1080), { x: 10.4, y: 20.6, width: 100.3, height: 50.5 }).crop,
    ).toEqual({ x: 10, y: 21, width: 101, height: 50 }));
});
