import { describe, expect, it } from 'vitest';
import { add, newDoc, type Annotation } from '@/editor/document';
import { docHash, saveState, savedDocOnOpen } from './save';

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

describe('reopening a saved capture', () => {
  it('is clean only when its document is the one that was saved', () => {
    const annotated = add(d, step);
    expect(savedDocOnOpen(annotated, 'a.png', docHash(annotated))).toBe(annotated);
    expect(savedDocOnOpen(annotated, 'a.png', docHash(d))).toBeNull();
    expect(savedDocOnOpen(annotated, 'a.png', null)).toBeNull();
    // Saved by the thumbnail (no fingerprint): the file is the original image.
    expect(savedDocOnOpen(d, 'a.png', null)).toBe(d);
    expect(savedDocOnOpen(d, null, null)).toBeNull();
  });

  it('hashes equal documents equally and different ones differently', () => {
    expect(docHash(JSON.parse(JSON.stringify(d)) as typeof d)).toBe(docHash(d));
    expect(docHash(add(d, step))).not.toBe(docHash(d));
  });
});
