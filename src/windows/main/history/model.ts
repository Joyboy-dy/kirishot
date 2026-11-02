// The history page's logic: days, filters, search and sizes (spec J3 § 4.2).
import type { HistoryEntry } from '@/lib/ipc';

export type Filter = 'all' | 'saved' | 'copied' | 'annotated';
export const FILTERS: Filter[] = ['all', 'saved', 'copied', 'annotated'];

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Entries grouped by local day, newest first: « Aujourd'hui », « Hier », then the date. */
export function groupByDay(
  entries: HistoryEntry[],
  now: Date,
): { label: string; entries: HistoryEntry[] }[] {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const groups: { key: string; label: string; entries: HistoryEntry[] }[] = [];
  for (const e of entries) {
    const d = new Date(e.createdAt);
    const key = dayKey(d);
    let group = groups.find((g) => g.key === key);
    if (!group) {
      const label =
        key === today
          ? "Aujourd'hui"
          : key === yesterday
            ? 'Hier'
            : d.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              });
      group = { key, label, entries: [] };
      groups.push(group);
    }
    group.entries.push(e);
  }
  return groups.map(({ label, entries: list }) => ({ label, entries: list }));
}

/** Lower case, without accents: « Paramètres » matches « parametres ». */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** The saved file's name, or nothing. */
export function fileNameOf(e: HistoryEntry): string {
  return e.savedPath?.split(/[\\/]/).pop() ?? '';
}

/** `dd/mm/yyyy` of the capture, in local time. */
export function dateOf(e: HistoryEntry): string {
  return new Date(e.createdAt).toLocaleDateString('fr-FR');
}

export function filterEntries(
  entries: HistoryEntry[],
  filter: Filter,
  query: string,
): HistoryEntry[] {
  const q = fold(query.trim());
  return entries.filter((e) => {
    if (filter === 'saved' && !e.savedPath) return false;
    if (filter === 'copied' && !e.copied) return false;
    if (filter === 'annotated' && !e.annotated) return false;
    if (!q) return true;
    return [fileNameOf(e), e.source.windowTitle ?? '', dateOf(e)].some((field) =>
      fold(field).includes(q),
    );
  });
}

/** `1023 o`, `12 Ko`, `144 Mo`, `3 Go` (base 1024, rounded). */
export function formatBytes(n: number): string {
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${Math.round(value)} ${units[unit]}`;
}
