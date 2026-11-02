// Closing the editor with unsaved changes (spec J3 § 3.5).
import type { Doc } from '@/editor/document';
import type { SaveState } from './save';

/** Modified since the last save, or never saved but changed since it opened. */
export function hasUnsavedChanges(state: SaveState, doc: Doc, openedDoc: Doc): boolean {
  if (state === 'dirty') return true;
  if (state === 'clean') return false;
  return doc !== openedDoc && JSON.stringify(doc) !== JSON.stringify(openedDoc);
}

export function closeDecision(unsaved: boolean, confirm: boolean): 'close' | 'ask' {
  return unsaved && confirm ? 'ask' : 'close';
}

export type CloseChoice = 'save' | 'discard' | 'cancel';

/** What the dialog's answer does; « Ne plus demander » only counts when the editor closes. */
export function afterChoice(
  choice: CloseChoice,
  dontAsk: boolean,
): { close: boolean; save: boolean; disableConfirm: boolean } {
  if (choice === 'cancel') return { close: false, save: false, disableConfirm: false };
  return { close: true, save: choice === 'save', disableConfirm: dontAsk };
}
