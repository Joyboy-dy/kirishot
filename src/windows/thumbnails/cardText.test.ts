import { describe, expect, it } from 'vitest';
import type { ThumbnailPushed } from '@/lib/ipc';
import { editThenLeave, footerText, tickAll, type CardState } from './cardText';
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

describe('tickAll', () => {
  it('reports the cards that expire, outside any React updater', () => {
    const cards = {
      a: state({ clock: start(1000) }),
      b: state({ clock: start(5000) }),
    };
    const r = tickAll(cards, ['a', 'b'], 1000);
    expect(r.expired).toEqual(['a']);
    expect(r.cards.a.clock.expired).toBe(true);
    expect(r.cards.b.clock.left).toBe(4000);
    expect(tickAll(r.cards, ['a', 'b'], 100).expired).toEqual([]);
  });

  it('skips leaving cards', () =>
    expect(
      tickAll({ a: state({ clock: start(100), leaving: true }) }, ['a'], 1000).expired,
    ).toEqual([]));
});

describe('editThenLeave', () => {
  it('leaves only once the edit request has answered', async () => {
    const order: string[] = [];
    let answer = () => {};
    const edit = new Promise<void>((resolve) => (answer = resolve));
    const done = editThenLeave(edit, () => order.push('leave'));
    await Promise.resolve();
    expect(order).toEqual([]);
    order.push('edited');
    answer();
    await done;
    expect(order).toEqual(['edited', 'leave']);
  });
});
