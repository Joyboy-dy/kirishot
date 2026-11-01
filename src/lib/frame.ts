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
