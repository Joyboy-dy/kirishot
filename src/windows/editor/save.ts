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
