// Receives the capture to edit: on Windows the pixels arrive as a WebView2 shared buffer, with
// the session (id, size, title) as the event's additionalData, like the selection overlays;
// elsewhere the same frame arrives base64-encoded in an `editor-frame` event.
import { listen } from '@tauri-apps/api/event';
import { useEffect, useState } from 'react';
import { decodeBase64Frame, decodeFrame } from '@/lib/frame';
import { commands, unwrap, type EditorSession } from '@/lib/ipc';

type SharedBufferEvent = { getBuffer(): ArrayBuffer; additionalData: unknown };
type WebView2 = {
  addEventListener(type: 'sharedbufferreceived', cb: (e: SharedBufferEvent) => void): void;
  removeEventListener(type: 'sharedbufferreceived', cb: (e: SharedBufferEvent) => void): void;
  releaseBuffer(buffer: ArrayBuffer): void;
};

type FrameEvent = { frame: string; session: EditorSession };

const webview = (window as unknown as { chrome?: { webview?: WebView2 } }).chrome?.webview;

export type Loaded = {
  session: EditorSession;
  /** The capture for Konva: decoded once, drawn by the GPU. */
  bitmap: ImageBitmap;
  /** A CPU copy of the pixels, for pixelation and colour reads. */
  pixels: ImageData;
};

export function useEditorSession(): Loaded | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    const applyFrame = (buffer: ArrayBuffer, session: EditorSession) => {
      const frame = decodeFrame(buffer);
      const pixels = new ImageData(frame.pixels.slice(), frame.width, frame.height);
      void createImageBitmap(pixels).then((bitmap) =>
        setLoaded((previous) => {
          previous?.bitmap.close();
          return { session, bitmap, pixels };
        }),
      );
    };

    const onSharedBuffer = (e: SharedBufferEvent) => {
      const buffer = e.getBuffer();
      try {
        applyFrame(buffer, e.additionalData as EditorSession);
      } finally {
        webview!.releaseBuffer(buffer);
      }
    };
    webview?.addEventListener('sharedbufferreceived', onSharedBuffer);
    const unlisten = listen<FrameEvent>('editor-frame', (e) => {
      applyFrame(decodeBase64Frame(e.payload.frame), e.payload.session);
    });
    void commands.editorLoaded().then(unwrap);
    return () => {
      webview?.removeEventListener('sharedbufferreceived', onSharedBuffer);
      void unlisten.then((stop) => stop());
    };
  }, []);

  return loaded;
}
