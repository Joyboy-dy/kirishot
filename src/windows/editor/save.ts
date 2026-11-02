// Whether the capture has something to save (spec J3 § 3.2).
import type { Doc } from '@/editor/document';

export type SaveState = 'never' | 'clean' | 'dirty';

/**
 * `never`: no file yet; `clean`: the document is the one last saved (equal, even after undo);
 * `dirty`: changed since.
 */
export function saveState(doc: Doc, savedDoc: Doc | null, savedPath: string | null): SaveState {
  if (!savedPath) return 'never';
  if (savedDoc && (doc === savedDoc || JSON.stringify(doc) === JSON.stringify(savedDoc)))
    return 'clean';
  return 'dirty';
}

/** A short fingerprint of a document (FNV-1a over its JSON), kept with the saved file. */
export function docHash(doc: Doc): string {
  const json = JSON.stringify(doc);
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * The document to count as saved when a capture opens: the opened one only if it is the one that
 * was saved (same fingerprint). Annotations kept by the history but never written to the file
 * then show as unsaved, so they can be saved (spec J3 § 3.2, § 3.5).
 */
export function savedDocOnOpen(
  opened: Doc,
  savedPath: string | null,
  savedHash: string | null,
): Doc | null {
  if (!savedPath) return null;
  // No fingerprint: saved outside the editor (the thumbnail), so the file is the original image.
  if (!savedHash) return opened.annotations.length === 0 && !opened.crop ? opened : null;
  return docHash(opened) === savedHash ? opened : null;
}
