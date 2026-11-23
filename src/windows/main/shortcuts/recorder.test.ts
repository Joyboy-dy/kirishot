import { describe, expect, it } from 'vitest';
import { accelFromKey, displayAccel } from './recorder';

describe('displayAccel', () => {
  it('shows French keycaps', () => {
    expect(displayAccel('Super+Shift+S')).toEqual(['Win', 'Maj', 'S']);
    expect(displayAccel('Shift+PrintScreen')).toEqual(['Maj', 'Impr. écran']);
    expect(displayAccel('Ctrl+Alt+F1')).toEqual(['Ctrl', 'Alt', 'F1']);
  });
});

type Mods = Partial<Record<'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey', boolean>>;

const key = (code: string, mods: Mods = {}) =>
  ({ code, repeat: false, ...mods }) as unknown as KeyboardEvent;

describe('accelFromKey', () => {
  it('writes a combination in Tauri syntax', () => {
    expect(accelFromKey(key('KeyS', { metaKey: true, shiftKey: true }))).toBe('Super+Shift+S');
    expect(accelFromKey(key('PrintScreen'))).toBe('PrintScreen');
    expect(accelFromKey(key('F12'))).toBe('F12');
    expect(accelFromKey(key('Digit1', { ctrlKey: true }))).toBe('Ctrl+1');
  });

  it('waits for a real main key and cancels on Escape', () => {
    expect(accelFromKey(key('ShiftLeft', { shiftKey: true }))).toBeUndefined();
    expect(accelFromKey(key('KeyS', { shiftKey: true }))).toBeUndefined();
    expect(accelFromKey(key('KeyS'))).toBeUndefined();
    expect(accelFromKey(key('Escape'))).toBeNull();
  });
});
