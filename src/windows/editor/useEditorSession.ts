// Receives the capture to edit: the pixels arrive as a WebView2 shared buffer, with the session
// (id, size, title) as the event's additionalData, like the selection overlays.
import { useEffect, useState } from 'react';
import { decodeFrame } from '@/lib/frame';
import { commands, unwrap, type EditorSession } from '@/lib/ipc';

type SharedBufferEvent = { getBuffer(): ArrayBuffer; additionalData: unknown };
type WebView2 = {
  addEventListener(type: 'sharedbufferreceived', cb: (e: SharedBufferEvent) => void): void;
  removeEventListener(type: 'sharedbufferreceived', cb: (e: SharedBufferEvent) => void): void;
  releaseBuffer(buffer: ArrayBuffer): void;
};

const webview = (window as unknown as { chrome: { webview: WebView2 } }).chrome.webview;

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
    const onFrame = (e: SharedBufferEvent) => {
      const buffer = e.getBuffer();
      const session = e.additionalData as EditorSession;
      let pixels: ImageData;
      try {
        const frame = decodeFrame(buffer);
        pixels = new ImageData(frame.pixels.slice(), frame.width, frame.height);
      } finally {
        webview.releaseBuffer(buffer);
      }
      void createImageBitmap(pixels).then((bitmap) =>
        setLoaded((previous) => {
          previous?.bitmap.close();
          return { session, bitmap, pixels };
        }),
      );
    };
    webview.addEventListener('sharedbufferreceived', onFrame);
    void commands.editorLoaded().then(unwrap);
    return () => webview.removeEventListener('sharedbufferreceived', onFrame);
  }, []);

  return loaded;
}
