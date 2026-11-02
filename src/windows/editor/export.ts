// The final image: a copy of the same Konva nodes as on screen, redrawn at 1 image pixel per
// pixel, without the drawing and handle layers (spec J2 § 4.3, J2.1 § 3.2).
import Konva from 'konva';
import { invoke } from '@tauri-apps/api/core';
import type { Doc, Rect } from '@/editor/document';
import type { ExportResult } from '@/lib/ipc';

export type ExportIntent = 'copy' | 'save' | 'saveVersion' | 'saveAs' | 'copyAndClose';

/** The part of the image that is exported: the crop, or the whole image. */
export function exportRect(doc: Doc): Rect {
  return doc.crop ?? { x: 0, y: 0, width: doc.size.w, height: doc.size.h };
}

/**
 * The content layer redrawn at 1 image pixel per pixel on a stage of its own, off screen: the
 * visible stage is never moved, so the view does not flash or jump (spec J2.1 § 3.2).
 */
async function renderPng(stage: Konva.Stage, doc: Doc): Promise<Uint8Array> {
  const content = stage.findOne<Konva.Layer>('.content');
  if (!content) throw new Error("L'image n'est pas affichée");
  const r = exportRect(doc);
  const offscreen = new Konva.Stage({
    container: document.createElement('div'),
    width: r.width,
    height: r.height,
  });
  try {
    offscreen.add(content.clone({ x: -r.x, y: -r.y, scaleX: 1, scaleY: 1 }));
    const canvas = offscreen.toCanvas({
      x: 0,
      y: 0,
      width: r.width,
      height: r.height,
      pixelRatio: 1,
    });
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'),
    );
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    offscreen.destroy();
  }
}

/** Sends the final image to Rust, which copies and/or saves it. */
export async function exportImage(
  stage: Konva.Stage,
  doc: Doc,
  intent: ExportIntent,
  file: { path: string | null; name: string | null } = { path: null, name: null },
): Promise<ExportResult> {
  const png = await renderPng(stage, doc);
  // Headers are ASCII: the path and the name are percent-encoded (Rust decodes them).
  return invoke<ExportResult>('editor_export', png, {
    headers: {
      'x-kirishot-intent': intent,
      'x-kirishot-capture': doc.captureId,
      'x-kirishot-path': encodeURIComponent(file.path ?? ''),
      'x-kirishot-name': encodeURIComponent(file.name ?? ''),
    },
  });
}
