// The document is saved one second after the last change (spec J2 § 4.4).
import { useEffect, useRef } from 'react';
import type { Doc } from '@/editor/document';
import { commands } from '@/lib/ipc';

export const AUTOSAVE_DELAY = 1000;

/** Whether to save now: something changed, and nothing for `delay` ms. */
export function nextSave(
  now: number,
  lastChange: number,
  pending: boolean,
  delay = AUTOSAVE_DELAY,
) {
  return pending && now - lastChange >= delay;
}

/** Saves `doc` after each pause in the edits, and once more when the page hides. */
export function useAutosave(doc: Doc | null) {
  const pending = useRef(false);
  const lastChange = useRef(0);
  const latest = useRef(doc);

  useEffect(() => {
    if (!doc || doc === latest.current) return;
    latest.current = doc;
    pending.current = true;
    lastChange.current = Date.now();
  }, [doc]);

  useEffect(() => {
    const save = () => {
      const d = latest.current;
      if (!d || !pending.current) return;
      pending.current = false;
      void commands.editorAutosave(d.captureId, JSON.stringify(d)).then((r) => {
        if (r.status === 'error') console.error(r.error);
      });
    };
    const timer = window.setInterval(() => {
      if (nextSave(Date.now(), lastChange.current, pending.current)) save();
    }, 250);
    const onHide = () => {
      if (document.visibilityState === 'hidden') save();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);
}
