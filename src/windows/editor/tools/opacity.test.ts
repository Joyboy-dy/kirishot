import { describe, expect, it } from 'vitest';
import { opacityProps } from './opacity';

describe('opacityProps', () => {
  it('a translucent shape with a fill and a stroke is drawn as one piece', () => {
    expect(opacityProps(0.5, true)).toEqual({ opacity: 0.5, perfectDrawEnabled: true });
  });

  it('an opaque shape, or one with a single paint, needs no buffer', () => {
    expect(opacityProps(1, true)).toEqual({ opacity: 1, perfectDrawEnabled: false });
    expect(opacityProps(0.5, false)).toEqual({ opacity: 0.5, perfectDrawEnabled: false });
  });
});
