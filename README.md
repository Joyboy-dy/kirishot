# Kirishot

A clean, fast screenshot tool for Windows.

> **Status:** early development (milestone J2: daily use).

Press **Win + Shift + S** (or **PrintScreen**): the screen freezes, you pick a region, a window or the
whole screen, and the capture is copied at once. A thumbnail appears in the corner: click it to
annotate, drag it into another app, or let it save itself.

- Frozen-screen selection with a pixel magnifier, window snapping and keyboard shortcuts.
- Floating thumbnails that never steal the keyboard focus.
- An editor with arrows, shapes, pen, highlighter, text, numbered steps, pixelation and crop.
- PNG, JPG or WebP; a soft shutter sound and flash, both optional.

## Requirements

- Windows 11 (x64) with WebView2
- Node.js 24 and pnpm 10
- Rust stable (MSVC toolchain)

## Development

```bash
pnpm install
pnpm tauri dev
```

Tests:

```bash
pnpm test
cargo test --manifest-path src-tauri/Cargo.toml
```

## License

[MIT](LICENSE). Third-party code and its licenses: [THIRD_PARTY.md](THIRD_PARTY.md).
