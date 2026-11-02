import { describe, expect, it } from 'vitest';
import { add, newDoc, type Annotation } from '@/editor/document';
import { afterChoice, closeDecision, hasUnsavedChanges } from './closing';

const d = newDoc('c', 100, 100);
const arrow: Annotation = {
  id: 'a',
  tool: 'arrow',
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ],
  control: null,
  stroke: { color: '#f00', width: 2, opacity: 1, dash: 'solid' },
  shadow: false,
};

describe('closing the editor', () => {
  it('knows when there are unsaved changes', () => {
    expect(hasUnsavedChanges('clean', d, d)).toBe(false);
    expect(hasUnsavedChanges('dirty', add(d, arrow), d)).toBe(true);
    expect(hasUnsavedChanges('never', d, d)).toBe(false);
    expect(hasUnsavedChanges('never', add(d, arrow), d)).toBe(true);
  });

  it('asks only with unsaved changes and the setting on', () => {
    expect(closeDecision(false, true)).toBe('close');
    expect(closeDecision(true, false)).toBe('close');
    expect(closeDecision(true, true)).toBe('ask');
  });

  it('applies the choice and « Ne plus demander »', () => {
    expect(afterChoice('save', true)).toEqual({ close: true, save: true, disableConfirm: true });
    expect(afterChoice('discard', false)).toEqual({
      close: true,
      save: false,
      disableConfirm: false,
    });
    expect(afterChoice('cancel', true)).toEqual({
      close: false,
      save: false,
      disableConfirm: false,
    });
  });
});
