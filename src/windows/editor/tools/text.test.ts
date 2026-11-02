import { describe, expect, it } from 'vitest';
import { textKey, textPointer } from './text';

describe('textPointer', () => {
  it('a press never opens the field: its default action would take the focus back', () => {
    expect(textPointer('down', null)).toEqual({ type: 'none' });
    expect(textPointer('down', 't1')).toEqual({ type: 'none' });
  });

  it('a release on a text edits it', () => {
    expect(textPointer('up', 't1')).toEqual({ type: 'edit', id: 't1' });
  });

  it('a release elsewhere creates a text', () => {
    expect(textPointer('up', null)).toEqual({ type: 'create' });
  });

  it('a click that ends an edit does not start another one', () => {
    expect(textPointer('up', null, true)).toEqual({ type: 'none' });
    expect(textPointer('up', 't1', true)).toEqual({ type: 'none' });
  });
});

describe('textKey', () => {
  it('Escape and Ctrl+Enter commit', () => {
    expect(textKey('Escape', false)).toBe('commit');
    expect(textKey('Enter', true)).toBe('commit');
  });

  it('Enter alone is a new line, other keys type', () => {
    expect(textKey('Enter', false)).toBeNull();
    expect(textKey('a', false)).toBeNull();
  });
});
