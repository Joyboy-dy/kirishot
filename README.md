# Kirishot

A clean, fast screenshot tool for Windows.

> **Status:** early development (milestone J1: region capture, save and copy).

Press **Win + Shift + S** (or **PrintScreen**): the screen freezes, you pick a region, a window or the
whole screen, and the capture is saved and copied to the clipboard.

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

[MIT](LICENSE)
