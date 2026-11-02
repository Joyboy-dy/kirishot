import { describe, expect, it } from 'vitest';
import type { HistoryEntry } from '@/lib/ipc';
import { fileNameOf, filterEntries, formatBytes, groupByDay } from './model';

const entry = (id: string, createdAt: string, more: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id,
  createdAt,
  size: { w: 10, h: 10 },
  source: { kind: 'region', windowTitle: null },
  savedPath: null,
  copied: false,
  annotated: false,
  bytes: 100,
  ...more,
});

describe('groupByDay', () => {
  const now = new Date(2026, 10, 2, 15, 0);
  it('splits today and yesterday at midnight, then dated days', () => {
    const groups = groupByDay(
      [
        entry('a', new Date(2026, 10, 2, 0, 30).toISOString()),
        entry('b', new Date(2026, 10, 1, 23, 50).toISOString()),
        entry('c', new Date(2026, 9, 27, 9, 0).toISOString()),
      ],
      now,
    );
    expect(groups.map((g) => g.label)).toEqual(["Aujourd'hui", 'Hier', 'mardi 27 octobre 2026']);
    expect(groups.map((g) => g.entries.map((e) => e.id))).toEqual([['a'], ['b'], ['c']]);
  });
});

describe('filterEntries', () => {
  const saved = entry('s', '2026-11-02T10:00:00+01:00', {
    savedPath: 'C:\\Users\\me\\Pictures\\Kirishot\\Rapport final.png',
    copied: true,
  });
  const titled = entry('t', '2026-11-01T10:00:00+01:00', {
    source: { kind: 'window', windowTitle: 'Paramètres du compte' },
    annotated: true,
  });
  const all = [saved, titled];

  it('filters by what was done', () => {
    expect(filterEntries(all, 'saved', '').map((e) => e.id)).toEqual(['s']);
    expect(filterEntries(all, 'copied', '').map((e) => e.id)).toEqual(['s']);
    expect(filterEntries(all, 'annotated', '').map((e) => e.id)).toEqual(['t']);
    expect(filterEntries(all, 'all', '')).toHaveLength(2);
  });

  it('searches names, window titles and dates, without case or accents', () => {
    expect(filterEntries(all, 'all', 'rapport').map((e) => e.id)).toEqual(['s']);
    expect(filterEntries(all, 'all', 'parametres').map((e) => e.id)).toEqual(['t']);
    expect(filterEntries(all, 'all', '01/11/2026').map((e) => e.id)).toEqual(['t']);
  });
});

describe('formatBytes', () => {
  it('writes French units, base 1024', () => {
    expect(formatBytes(1023)).toBe('1023 o');
    expect(formatBytes(12 * 1024)).toBe('12 Ko');
    expect(formatBytes(151_000_000)).toBe('144 Mo');
    expect(formatBytes(3 * 1024 ** 3)).toBe('3 Go');
  });
});

describe('fileNameOf', () => {
  it('keeps only the file name of a Windows path', () => {
    const e = entry('x', '2026-11-02T10:00:00+01:00', { savedPath: String.raw`C:\a\b\Shot 1.png` });
    expect(fileNameOf(e)).toBe('Shot 1.png');
  });
});
