import { describe, expect, it } from 'vitest';
import { afterDrawing } from './afterDraw';

describe('afterDrawing', () => {
  it('keeps the tool by default: the next shape can be drawn at once', () => {
    expect(afterDrawing('keep', 'a1')).toBeNull();
  });

  it('can switch to the selection with the new shape selected', () => {
    expect(afterDrawing('select', 'a1')).toEqual({ tool: 'select', selected: ['a1'] });
  });
});
