import { describe, expect, it } from 'vitest';
import { cardSize, empty, push, remove, type StackCard } from './stack';

const card = (id: string) => ({ id }) as StackCard;
const ids = (cards: StackCard[]) => cards.map((c) => c.id);

describe('stack', () => {
  it('fourth card waits, then enters', () => {
    let s = ['a', 'b', 'c', 'd'].map(card).reduce((st, c) => push(st, c), empty);
    expect(ids(s.visible)).toEqual(['a', 'b', 'c']);
    expect(ids(s.queued)).toEqual(['d']);
    s = remove(s, 'b');
    expect(ids(s.visible)).toEqual(['a', 'c', 'd']);
    expect(s.queued).toEqual([]);
  });

  it('removing a queued card drops it', () => {
    let s = ['a', 'b', 'c', 'd', 'e'].map(card).reduce((st, c) => push(st, c), empty);
    s = remove(s, 'e');
    expect(ids(s.queued)).toEqual(['d']);
  });

  it('removing an unknown card changes nothing', () => {
    const s = push(empty, card('a'));
    expect(remove(s, 'z')).toEqual(s);
  });
});

describe('cardSize', () => {
  // Same values as src-tauri/src/thumbnails/layout.rs: the window is sized for these cards.
  it('matches the Rust layout', () => {
    expect(cardSize(1920, 1080)).toEqual({ width: 240, height: 135 });
    expect(cardSize(600, 1200)).toEqual({ width: 90, height: 180 });
    expect(cardSize(2000, 100)).toEqual({ width: 240, height: 60 });
  });
});
