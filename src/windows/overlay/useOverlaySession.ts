// Receives frozen screens from Rust: the pixels arrive as a WebView2 shared buffer, with the
// session (monitor, windows, cursor) as the event's additionalData.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { decodeFrame } from '@/lib/frame';
import { commands, events, unwrap, type OverlaySession } from '@/lib/ipc';

type SharedBufferEvent = { getBuffer(): ArrayBuffer; additionalData: unknown };
type WebView2 = {
  addEventListener(type: 'sharedbufferreceived', cb: (e: SharedBufferEvent) => void): void;
  removeEventListener(type: 'sharedbufferreceived', cb: (e: SharedBufferEvent) => void): void;
  releaseBuffer(buffer: ArrayBuffer): void;
};

const webview = (window as unknown as { chrome: { webview: WebView2 } }).chrome.webview;

export type OverlayHandlers = {
  /** A new capture arrived: the selection starts over. */
  onSession(session: OverlaySession): void;
  /** Another monitor started a selection: drop ours, keep the image. */
  onClaimedElsewhere(): void;
  /** The capture ended. */
  onReset(): void;
};

export function useOverlaySession(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  handlers: OverlayHandlers,
) {
  const [session, setSession] = useState<OverlaySession | null>(null);
  const sessionRef = useRef<OverlaySession | null>(null);
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const onFrame = (e: SharedBufferEvent) => {
      const buffer = e.getBuffer();
      const next = e.additionalData as OverlaySession;
      try {
        const frame = decodeFrame(buffer);
        const canvas = canvasRef.current!;
        canvas.width = frame.width;
        canvas.height = frame.height;
        canvas
          .getContext('2d')!
          .putImageData(new ImageData(frame.pixels, frame.width, frame.height), 0, 0);
        const scale = next.monitor.scale ?? window.devicePixelRatio;
        if (Math.abs(scale - window.devicePixelRatio) > 0.01) {
          console.warn(`scale ${scale} ≠ devicePixelRatio ${window.devicePixelRatio}`);
        }
      } finally {
        // The canvas holds a copy: the shared memory can go right away.
        webview.releaseBuffer(buffer);
      }
      sessionRef.current = next;
      setSession(next);
      handlersRef.current.onSession(next);
      void commands.overlayReady().then(unwrap);
    };
    webview.addEventListener('sharedbufferreceived', onFrame);

    const unlisteners = [
      events.overlayReset.listen(() => {
        const canvas = canvasRef.current;
        if (canvas) canvas.width = 0; // frees the frozen screen's memory
        sessionRef.current = null;
        setSession(null);
        handlersRef.current.onReset();
      }),
      events.overlayClaimed.listen((e) => {
        if (e.payload.monitorIndex !== sessionRef.current?.monitor.index) {
          handlersRef.current.onClaimedElsewhere();
        }
      }),
    ];
    void commands.overlayLoaded().then(unwrap);

    return () => {
      webview.removeEventListener('sharedbufferreceived', onFrame);
      unlisteners.forEach((p) => void p.then((unlisten) => unlisten()));
    };
  }, [canvasRef]);

  return session;
}
