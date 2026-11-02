import { describe, expect, it } from 'vitest';
import type { Annotation } from '@/editor/document';
import { OPTIONS, optionsFor, toolOptions } from './options';

const stroke = { color: '#f00', width: 4, opacity: 1, dash: 'solid' as const };
const arrow: Annotation = {
  id: 'a',
  tool: 'arrow',
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ],
  control: null,
  stroke,
  shadow: false,
};
const highlighter: Annotation = {
  id: 'h',
  tool: 'highlighter',
  points: [],
  color: '#ff0',
  width: 20,
  opacity: 1,
};
const text: Annotation = {
  id: 't',
  tool: 'text',
  at: { x: 0, y: 0 },
  text: 'a',
  size: 20,
  color: '#fff',
  style: 'plain',
};
const pixelate: Annotation = {
  id: 'p',
  tool: 'pixelate',
  box: { x: 0, y: 0, width: 10, height: 10 },
  block: 16,
};

describe('options', () => {
  it('options of each tool match the spec table', () => {
    expect(OPTIONS).toEqual({
      arrow: ['color', 'size', 'dash', 'shadow', 'opacity'],
      line: ['color', 'size', 'dash', 'shadow', 'opacity'],
      rect: ['color', 'size', 'dash', 'fill', 'shadow', 'opacity'],
      ellipse: ['color', 'size', 'dash', 'fill', 'shadow', 'opacity'],
      pen: ['color', 'size', 'opacity'],
      highlighter: ['color', 'size', 'opacity'],
      text: ['color', 'size', 'textStyle'],
      step: ['color', 'size'],
      pixelate: ['strength'],
    });
  });

  it('optionsFor an arrow and a highlighter is colour, size and opacity', () => {
    expect(optionsFor([arrow, highlighter])).toEqual(['color', 'size', 'opacity']);
  });

  it('optionsFor nothing is empty', () => {
    expect(optionsFor([])).toEqual([]);
  });

  it('optionsFor a text and a pixelate area is empty', () => {
    expect(optionsFor([text, pixelate])).toEqual([]);
  });

  it('toolOptions follows the drawing tool, none for select and crop', () => {
    expect(toolOptions('rect')).toEqual(OPTIONS.rect);
    expect(toolOptions('select')).toEqual([]);
    expect(toolOptions('crop')).toEqual([]);
  });
});
