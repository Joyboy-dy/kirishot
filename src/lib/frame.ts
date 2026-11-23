// A frozen screen as Rust sends it: width (u32 LE), height (u32 LE), then RGBA pixels.

export type Frame = { width: number; height: number; pixels: Uint8ClampedArray<ArrayBuffer> };

export function decodeFrame(buf: ArrayBuffer): Frame {
  const view = new DataView(buf);
  const width = view.getUint32(0, true);
  const height = view.getUint32(4, true);
  const size = width * height * 4;
  if (buf.byteLength !== 8 + size) {
    throw new Error(`Frame of ${buf.byteLength} bytes does not match ${width}×${height}`);
  }
  return { width, height, pixels: new Uint8ClampedArray(buf, 8, size) };
}

/** Decodes the base64 frame Rust sends on platforms without WebView2 shared buffers. */
export function decodeBase64Frame(encoded: string): ArrayBuffer {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** The colour of a pixel as `RRGGBB`, read from the CPU copy; outside points are clamped. */
export function pixelHex(frame: Frame, at: { x: number; y: number }): string {
  const x = Math.min(Math.max(Math.round(at.x), 0), frame.width - 1);
  const y = Math.min(Math.max(Math.round(at.y), 0), frame.height - 1);
  const i = (y * frame.width + x) * 4;
  return [frame.pixels[i], frame.pixels[i + 1], frame.pixels[i + 2]]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}
