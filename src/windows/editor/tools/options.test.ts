import { describe, expect, it } from 'vitest';
import { newDoc, type Annotation } from '@/editor/document';
import { strokeWidth } from '@/editor/style';
import { applyStyle, OPTIONS, optionsFor, styleOf, toolOptions } from './options';

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

describe('applyStyle', () => {
  const pen: Annotation = { id: 'p', tool: 'pen', points: [], stroke };
  const doc = { ...newDoc('c', 900, 600), annotations: [arrow, pen, highlighter] };

  it('a dash changes only what has a dash option', () => {
    const next = applyStyle(doc, ['a', 'p'], { dash: 'dotted' });
    expect(next.annotations[0]).toMatchObject({ stroke: { dash: 'dotted' } });
    expect(next.annotations[1]).toEqual(pen);
  });

  it('opacity changes strokes and highlighters alike', () => {
    const next = applyStyle(doc, ['a', 'h'], { opacity: 0.4 });
    expect(next.annotations[0]).toMatchObject({ stroke: { opacity: 0.4 } });
    expect(next.annotations[2]).toMatchObject({ opacity: 0.4 });
  });

  it('only the listed annotations change', () => {
    const next = applyStyle(doc, ['h'], { color: '#00f' });
    expect(next.annotations[0]).toEqual(arrow);
    expect(next.annotations[2]).toMatchObject({ color: '#00f' });
  });

  it('strength sets the pixelation block', () => {
    const d = { ...doc, annotations: [pixelate] };
    expect(applyStyle(d, ['p'], { strength: 28 }).annotations[0]).toMatchObject({ block: 28 });
  });

  it('fill sets the kind and follows the colour', () => {
    const rect: Annotation = {
      id: 'r',
      tool: 'rect',
      box: { x: 0, y: 0, width: 10, height: 10 },
      stroke,
      fill: { kind: 'none', color: '#f00' },
      shadow: false,
    };
    const d = { ...doc, annotations: [rect] };
    expect(applyStyle(d, ['r'], { fill: 'solid' }).annotations[0]).toMatchObject({
      fill: { kind: 'solid', color: '#f00' },
    });
    expect(applyStyle(d, ['r'], { color: '#0f0' }).annotations[0]).toMatchObject({
      stroke: { color: '#0f0' },
      fill: { color: '#0f0' },
    });
  });
});

describe('styleOf', () => {
  it('reads an annotation back as top-bar values, size as a step', () => {
    const image = { w: 900, h: 600 };
    const a: Annotation = { ...arrow, stroke: { ...stroke, width: strokeWidth(image, 3) } };
    expect(styleOf(a, image)).toEqual({
      color: '#f00',
      size: 3,
      dash: 'solid',
      shadow: false,
      opacity: 1,
    });
    expect(styleOf(pixelate, image)).toEqual({ strength: 16 });
    expect(styleOf({ ...text, size: strokeWidth(image, 2) * 6 }, image)).toMatchObject({
      size: 2,
      textStyle: 'plain',
    });
  });
});
