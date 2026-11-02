// File names shown and edited in the status bar (spec J3 § 3.3).

/** `name.ext` → `{ stem: 'name', ext: '.ext' }`; the extension is never edited. */
export function splitName(name: string): { stem: string; ext: string } {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { stem: name, ext: '' };
  return { stem: name.slice(0, dot), ext: name.slice(dot) };
}

/** The file name at the end of a Windows (or POSIX) path. */
export function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}
