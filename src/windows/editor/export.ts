// The final image: the same Konva nodes as on screen, redrawn at 1 image pixel per pixel,
// without the drawing and handle layers (spec J2 § 4.3).
import type Konva from 'konva';
import { invoke } from '@tauri-apps/api/core';
import type { Doc, Rect } from '@/editor/document';
import type { ExportResult } from '@/lib/ipc';

export type ExportIntent = 'copy' | 'save' | 'saveAs' | 'copyAndClose';

/** The part of the image that is exported: the crop, or the whole image. */
export function exportRect(doc: Doc): Rect {
  return doc.crop ?? { x: 0, y: 0, width: doc.size.w, height: doc.size.h };
}

async function renderPng(stage: Konva.Stage, doc: Doc): Promise<Uint8Array> {
  const hidden = stage.find('.draft, .ui');
  const content = stage.find('.content');
  const views = content.map((layer) => ({
    layer,
    x: layer.x(),
    y: layer.y(),
    scale: layer.scaleX(),
  }));
  hidden.forEach((layer) => layer.hide());
  // Image pixels on output pixels, 1:1: no rounding of the size, no sub-pixel offset.
  const r = exportRect(doc);
  content.forEach((layer) => layer.setAttrs({ x: -r.x, y: -r.y, scaleX: 1, scaleY: 1 }));
  try {
    const canvas = stage.toCanvas({ x: 0, y: 0, width: r.width, height: r.height, pixelRatio: 1 });
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'),
    );
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    views.forEach((v) => v.layer.setAttrs({ x: v.x, y: v.y, scaleX: v.scale, scaleY: v.scale }));
    hidden.forEach((layer) => layer.show());
  }
}

/** Sends the final image to Rust, which copies and/or saves it. */
export async function exportImage(
  stage: Konva.Stage,
  doc: Doc,
  intent: ExportIntent,
): Promise<ExportResult> {
  const png = await renderPng(stage, doc);
  return invoke<ExportResult>('editor_export', png, {
    headers: { 'x-kirishot-intent': intent, 'x-kirishot-capture': doc.captureId },
  });
}
