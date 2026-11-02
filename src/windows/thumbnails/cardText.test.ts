import { describe, expect, it } from 'vitest';
import type { ThumbnailPushed } from '@/lib/ipc';
import { footerText, type CardState } from './cardText';
import { start, tick } from './countdown';

const card: ThumbnailPushed = {
  id: 'a',
  src: null,
  preview: null,
  width: 1920,
  height: 1080,
  seconds: 6,
  action: 'saveAndCopy',
  copied: true,
};
const state = (patch: Partial<CardState> = {}): CardState => ({
  card,
  clock: tick(start(6000), 1500).clock,
  status: null,
  leaving: false,
  ...patch,
});

describe('footerText', () => {
  it('announces the save to come', () =>
    expect(footerText(state())).toBe('Copiée · enregistrement dans 5 s'));
  it('without a copy', () =>
    expect(footerText(state({ card: { ...card, copied: false, action: 'save' } }))).toBe(
      'Enregistrement dans 5 s',
    ));
  it('after the save', () =>
    expect(footerText(state({ status: { kind: 'saved', path: 'x' } }))).toBe(
      'Enregistrée et copiée',
    ));
  it('a failure shows its message', () =>
    expect(footerText(state({ status: { kind: 'failed', message: 'Disque plein' } }))).toBe(
      'Échec : Disque plein',
    ));
  it('copy only', () =>
    expect(footerText(state({ card: { ...card, action: 'copy' } }))).toBe('Copiée'));
});
