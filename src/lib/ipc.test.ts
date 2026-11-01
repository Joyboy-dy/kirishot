import { describe, expect, it } from 'vitest';
import { KirishotException, unwrap } from './ipc';

describe('unwrap', () => {
  it('returns data on ok', () => {
    expect(unwrap({ status: 'ok', data: 42 })).toBe(42);
  });

  it('throws KirishotException on error', () => {
    expect(() =>
      unwrap({ status: 'error', error: { code: 'save', message: 'Disque plein' } }),
    ).toThrow(KirishotException);
  });
});
