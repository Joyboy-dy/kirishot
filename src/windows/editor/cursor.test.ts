import { describe, expect, it } from 'vitest';
import { cursorFor, hoverOf, type CursorState } from './cursor';

const base: CursorState = {
  tool: 'select',
  panning: false,
  panDragging: false,
  dragging: false,
  hover: 'none',
};

describe('cursorFor', () => {
  it('the select tool shows an arrow over empty space', () => {
    expect(cursorFor(base)).toBe('default');
  });

  it('an annotation under the select tool can be grabbed, and is grabbing while dragged', () => {
    expect(cursorFor({ ...base, hover: 'annotation' })).toBe('grab');
    expect(cursorFor({ ...base, hover: 'annotation', dragging: true })).toBe('grabbing');
  });

  it('arrow and line handles are grabbed too', () => {
    expect(cursorFor({ ...base, hover: 'handle' })).toBe('grab');
    expect(cursorFor({ ...base, hover: 'handle', dragging: true })).toBe('grabbing');
  });

  it('box anchors resize in their direction, even while dragged', () => {
    expect(cursorFor({ ...base, hover: { anchor: 'top-left' } })).toBe('nwse-resize');
    expect(cursorFor({ ...base, hover: { anchor: 'bottom-right' } })).toBe('nwse-resize');
    expect(cursorFor({ ...base, hover: { anchor: 'top-right' } })).toBe('nesw-resize');
    expect(cursorFor({ ...base, hover: { anchor: 'bottom-left' } })).toBe('nesw-resize');
    expect(cursorFor({ ...base, hover: { anchor: 'top-center' } })).toBe('ns-resize');
    expect(cursorFor({ ...base, hover: { anchor: 'bottom-center' } })).toBe('ns-resize');
    expect(cursorFor({ ...base, hover: { anchor: 'middle-left' } })).toBe('ew-resize');
    expect(cursorFor({ ...base, hover: { anchor: 'middle-right' }, dragging: true })).toBe(
      'ew-resize',
    );
  });

  it('drawing tools draw, even over an annotation', () => {
    for (const tool of [
      'arrow',
      'rect',
      'ellipse',
      'line',
      'pen',
      'highlighter',
      'pixelate',
      'step',
      'crop',
    ] as const)
      expect(cursorFor({ ...base, tool, hover: 'annotation' })).toBe('crosshair');
  });

  it('the text tool shows a text cursor', () => {
    expect(cursorFor({ ...base, tool: 'text' })).toBe('text');
  });

  it('panning wins over everything', () => {
    expect(cursorFor({ ...base, tool: 'arrow', panning: true })).toBe('grab');
    expect(cursorFor({ ...base, hover: 'annotation', panDragging: true })).toBe('grabbing');
  });
});

describe('hoverOf', () => {
  const node = (name: string, inAnnotation = false) => ({
    name: () => name,
    findAncestor: (sel: string, includeSelf?: boolean) =>
      sel === '.annotation' && (inAnnotation || (includeSelf && name === 'annotation')) ? {} : null,
  });

  it('reads the transformer anchor from its Konva name', () => {
    expect(hoverOf(node('top-left _anchor'))).toEqual({ anchor: 'top-left' });
  });

  it('knows handles and annotations, including their inner shapes', () => {
    expect(hoverOf(node('handle'))).toBe('handle');
    expect(hoverOf(node('annotation'))).toBe('annotation');
    expect(hoverOf(node('', true))).toBe('annotation');
  });

  it('anything else is empty space', () => {
    expect(hoverOf(node(''))).toBe('none');
    expect(hoverOf(null)).toBe('none');
  });
});
