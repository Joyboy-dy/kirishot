import { describe, expect, it } from 'vitest';
import { keyAction } from './keys';

const k = (
  key: string,
  mods: Partial<{ ctrl: boolean; shift: boolean; alt: boolean }> = {},
  editingText = false,
) => keyAction({ key, ctrl: false, shift: false, alt: false, editingText, ...mods });

describe('keyAction', () => {
  it('letters pick tools', () => {
    expect(k('a')).toEqual({ type: 'tool', tool: 'arrow' });
    expect(k('E')).toEqual({ type: 'tool', tool: 'ellipse' });
    expect(k('v')).toEqual({ type: 'tool', tool: 'select' });
    expect(k('b')).toEqual({ type: 'tool', tool: 'pixelate' });
  });
  it('digits pick sizes', () => expect(k('3')).toEqual({ type: 'size', step: 3 }));
  it('undo and redo', () => {
    expect(k('z', { ctrl: true })).toEqual({ type: 'undo' });
    expect(k('Z', { ctrl: true, shift: true })).toEqual({ type: 'redo' });
    expect(k('y', { ctrl: true })).toEqual({ type: 'redo' });
  });
  it('export shortcuts', () => {
    expect(k('c', { ctrl: true })).toEqual({ type: 'copy' });
    expect(k('s', { ctrl: true })).toEqual({ type: 'save' });
    expect(k('S', { ctrl: true, shift: true })).toEqual({ type: 'saveAs' });
    expect(k('Enter', { ctrl: true })).toEqual({ type: 'copyAndClose' });
  });
  it('editing a text keeps every key for the text', () => {
    expect(k('t', {}, true)).toBeNull();
    expect(k('c', { ctrl: true }, true)).toBeNull();
    expect(k('Delete', {}, true)).toBeNull();
  });
  it('arrows nudge, shift by 10', () => {
    expect(k('ArrowLeft', { shift: true })).toEqual({ type: 'nudge', dx: -10, dy: 0 });
    expect(k('ArrowDown')).toEqual({ type: 'nudge', dx: 0, dy: 1 });
  });
  it('selection keys', () => {
    expect(k('Delete')).toEqual({ type: 'delete' });
    expect(k('Backspace')).toEqual({ type: 'delete' });
    expect(k('d', { ctrl: true })).toEqual({ type: 'duplicate' });
    expect(k('a', { ctrl: true })).toEqual({ type: 'selectAll' });
    expect(k('Escape')).toEqual({ type: 'escape' });
  });
  it('other keys do nothing', () => expect(k('q')).toBeNull());
});
