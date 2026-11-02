import { describe, expect, it } from 'vitest';
import { add, newDoc, type Annotation } from './document';
import { commit, init, redo, undo } from './history';

const empty = newDoc('cap', 100, 100);
const step = (id: string): Annotation => ({
  id,
  tool: 'step',
  at: { x: 0, y: 0 },
  color: '#f00',
  size: 4,
});

describe('history', () => {
  it('is capped at 200', () => {
    let h = init(empty);
    for (let i = 0; i < 250; i++) h = commit(h, add(h.present, step(String(i))));
    expect(h.past.length).toBe(200);
  });

  it('undo then redo restores the same document', () => {
    const h1 = commit(init(empty), add(empty, step('a')));
    expect(undo(h1).present).toBe(empty);
    expect(redo(undo(h1)).present).toBe(h1.present);
  });

  it('a new commit clears the redo stack', () => {
    const h1 = commit(init(empty), add(empty, step('a')));
    expect(commit(undo(h1), add(empty, step('b'))).future).toEqual([]);
  });

  it('undo with nothing to undo changes nothing', () => {
    const h = init(empty);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });
});
