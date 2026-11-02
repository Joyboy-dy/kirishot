// The final image: the same Konva nodes as on screen, redrawn at 1 image pixel per pixel,
// without the drawing and handle layers (spec J2 § 4.3).
import type Konva from 'konva';
import { invoke } from '@tauri-apps/api/core';
import type { Doc, Rect } from '@/editor/document';
import type { ExportResult } from '@/lib/ipc';
import type { View } from './viewport';

export type ExportIntent = 'copy' | 'save' | 'saveAs' | 'copyAndClose';

/** The part of the image that is exported: the crop, or the whole image. */
export function exportRect(doc: Doc): Rect {
  return doc.crop ?? { x: 0, y: 0, width: doc.size.w, height: doc.size.h };
}

async function renderPng(stage: Konva.Stage, doc: Doc, view: View): Promise<Uint8Array> {
  const hidden = stage.find('.draft, .ui');
  hidden.forEach((layer) => layer.hide());
  try {
    const r = exportRect(doc);
    const canvas = stage.toCanvas({
      x: view.x + r.x * view.scale,
      y: view.y + r.y * view.scale,
      width: r.width * view.scale,
      height: r.height * view.scale,
      pixelRatio: 1 / view.scale,
    });
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'),
    );
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    hidden.forEach((layer) => layer.show());
  }
}

/** Sends the final image to Rust, which copies and/or saves it. */
export async function exportImage(
  stage: Konva.Stage,
  doc: Doc,
  view: View,
  intent: ExportIntent,
): Promise<ExportResult> {
  const png = await renderPng(stage, doc, view);
  return invoke<ExportResult>('editor_export', png, {
    headers: { 'x-kirishot-intent': intent, 'x-kirishot-capture': doc.captureId },
  });
}
