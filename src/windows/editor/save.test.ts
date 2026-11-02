import { describe, expect, it } from 'vitest';
import { add, newDoc, type Annotation } from '@/editor/document';
import { saveState } from './save';

const d = newDoc('c', 100, 100);
const step: Annotation = { id: 's', tool: 'step', at: { x: 1, y: 1 }, color: '#f00', size: 4 };

describe('saveState', () => {
  it('never saved without a file', () => {
    expect(saveState(d, null, null)).toBe('never');
  });

  it('clean when the document is the saved one', () => {
    expect(saveState(d, d, 'a.png')).toBe('clean');
  });

  it('dirty after a change', () => {
    expect(saveState(add(d, step), d, 'a.png')).toBe('dirty');
  });

  it('clean again after undoing back to an equal document', () => {
    const saved = add(d, step);
    const undone = JSON.parse(JSON.stringify(saved)) as typeof saved;
    expect(saveState(undone, saved, 'a.png')).toBe('clean');
  });
});
