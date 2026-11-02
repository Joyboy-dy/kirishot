import { describe, expect, it } from 'vitest';
import { displayAccel } from './recorder';

describe('displayAccel', () => {
  it('shows French keycaps', () => {
    expect(displayAccel('Super+Shift+S')).toEqual(['Win', 'Maj', 'S']);
    expect(displayAccel('Shift+PrintScreen')).toEqual(['Maj', 'Impr. écran']);
    expect(displayAccel('Ctrl+Alt+F1')).toEqual(['Ctrl', 'Alt', 'F1']);
  });
});
