import { useEffect, useRef, useState } from 'react';
import { commands, events, type ThumbStatus } from '@/lib/ipc';
import { t } from '@/i18n';
import { Card } from './Card';
import type { CardState } from './cardText';
import { pause, resume, start, tick } from './countdown';
import { empty, push, remove, type Stack as StackModel } from './stack';

const TICK_MS = 100;
const EXIT_MS = 150;
/** How long a card shows the result of an action before leaving. */
const CONFIRM_MS = 800;
const RESULT_MS = 1500;

function report(result: Promise<{ status: 'ok' | 'error'; error?: unknown }>) {
  return result.then((r) => {
    if (r.status === 'error') console.error(r.error);
  });
}

/** The cards in the bottom-right corner, newest at the bottom (spec J2 § 3). */
export function ThumbnailStack() {
  const [stack, setStack] = useState<StackModel>(empty);
  const [cards, setCards] = useState<Record<string, CardState>>({});
  const [announce, setAnnounce] = useState('');
  const cardsRef = useRef(cards);
  useEffect(() => {
    cardsRef.current = cards;
  });

  const patch = (id: string, f: (c: CardState) => CardState) =>
    setCards((all) => (all[id] ? { ...all, [id]: f(all[id]) } : all));

  const leave = (id: string, close = true) => {
    patch(id, (c) => ({ ...c, leaving: true }));
    window.setTimeout(() => {
      setStack((s) => remove(s, id));
      setCards((all) => {
        const next = { ...all };
        delete next[id];
        return next;
      });
      if (close) void report(commands.thumbnailClose(id));
    }, EXIT_MS);
  };
  const leaveRef = useRef(leave);
  useEffect(() => {
    leaveRef.current = leave;
  });

  useEffect(() => {
    const onStatus = (id: string, status: ThumbStatus) => {
      if (status.kind === 'removed') return leaveRef.current(id, false);
      patch(id, (c) => ({ ...c, status }));
      if (status.kind === 'copied') setAnnounce(t('thumb.announceCopied'));
      if (status.kind === 'saved') setAnnounce(t('thumb.announceSaved'));
    };
    const unlisteners = [
      events.thumbnailPushed.listen(({ payload }) => {
        setCards((all) => ({
          ...all,
          [payload.id]: {
            card: payload,
            clock: start(payload.seconds === null ? null : payload.seconds * 1000),
            status: null,
            leaving: false,
          },
        }));
        setStack((s) => push(s, payload));
        if (payload.copied) setAnnounce(t('thumb.announceCopied'));
      }),
      events.thumbnailUpdate.listen(({ payload }) => onStatus(payload.id, payload.status)),
    ];
    void Promise.all(unlisteners).then(() => report(commands.thumbnailsReady()));
    return () => unlisteners.forEach((p) => void p.then((unlisten) => unlisten()));
  }, []);

  // One clock for every visible card; an expired card runs its action, shows the result, leaves.
  const visibleIds = stack.visible.map((c) => c.id).join(',');
  useEffect(() => {
    if (!visibleIds) return;
    const timer = window.setInterval(() => {
      const expired: string[] = [];
      setCards((all) => {
        const next = { ...all };
        for (const id of visibleIds.split(',')) {
          const c = next[id];
          if (!c || c.leaving) continue;
          const r = tick(c.clock, TICK_MS);
          if (r.expiredNow) expired.push(id);
          next[id] = { ...c, clock: r.clock };
        }
        return next;
      });
      for (const id of expired) {
        void report(commands.thumbnailExpire(id)).then(() =>
          window.setTimeout(() => leaveRef.current(id), RESULT_MS),
        );
      }
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [visibleIds]);

  // Rust sizes and places the window for the visible cards.
  const queued = stack.queued.length;
  useEffect(() => {
    void report(commands.thumbnailsLayout(visibleIds ? visibleIds.split(',') : [], queued));
  }, [visibleIds, queued]);

  const act = (id: string, run: () => Promise<{ status: 'ok' | 'error'; error?: unknown }>) =>
    void report(run()).then(() => window.setTimeout(() => leaveRef.current(id), CONFIRM_MS));

  return (
    <div className="fixed bottom-0 right-0 flex flex-col items-end gap-2">
      {queued > 0 && (
        <div
          className="flex h-6 items-center rounded-full px-2.5 font-mono text-[12px]"
          style={{ background: 'rgba(14, 16, 20, 0.92)', color: '#eceef2' }}
        >
          {t('thumb.more', { n: queued })}
        </div>
      )}
      {stack.visible.map((c) => {
        const state = cards[c.id];
        if (!state) return null;
        return (
          <Card
            key={c.id}
            state={state}
            onHover={(on) =>
              patch(c.id, (s) => ({ ...s, clock: on ? pause(s.clock) : resume(s.clock) }))
            }
            onEdit={() => {
              void report(commands.thumbnailEdit(c.id));
              leave(c.id);
            }}
            onCopy={() => act(c.id, () => commands.thumbnailCopy(c.id))}
            onSave={() => act(c.id, () => commands.thumbnailSave(c.id))}
            onClose={() => leave(c.id)}
            onDelete={() => void report(commands.thumbnailDelete(c.id))}
            onReveal={() => void report(commands.thumbnailReveal(c.id))}
            onCopyPath={() => void report(commands.thumbnailCopyPath(c.id))}
            onDragStart={() => {}}
          />
        );
      })}
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>
    </div>
  );
}
