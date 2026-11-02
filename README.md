# Kirishot

A clean, fast screenshot tool for Windows.

> **Status:** first public release, 0.1.0. Windows 11 only for now.

Press **Win + Shift + S** (or **PrintScreen**): the screen freezes, you pick a region, a window or the
whole screen, and the capture is copied at once. A thumbnail appears in the corner: click it to
annotate, drag it into another app, or let it save itself.

- Frozen-screen selection with a pixel magnifier, window snapping and keyboard shortcuts.
- Floating thumbnails that never steal the keyboard focus.
- An editor with arrows, shapes, pen, highlighter, text, numbered steps, pixelation and crop.
- PNG, JPG or WebP; a soft shutter sound and flash, both optional.
- A searchable history of every capture, to copy, reopen with its annotations, or find on disk.
- Smart saving: nothing to save when nothing changed, replace or keep a new version, rename in place,
  and a question before closing unsaved changes.
- Custom colours and an eyedropper that picks a colour in the capture.
- Editable global shortcuts, a theme setting, and launch at Windows startup.

## Download

Get `Kirishot_<version>_x64-setup.exe` from the [latest release](https://github.com/Joyboy-dy/kirishot/releases/latest)
and run it. It installs for the current user, without administrator rights, and can launch Kirishot
right away.

The installer is not code-signed yet, so Windows SmartScreen may warn about an unknown publisher:
choose **More info**, then **Run anyway**. Kirishot is uninstalled from **Settings › Apps**.

## Shortcuts

| Action | Default |
| --- | --- |
| Capture a region or a window | **Win + Shift + S** or **PrintScreen** |
| Capture the whole screen | **Shift + PrintScreen** |

Both can be changed on the **Shortcuts** page, which also lists the keys of the frozen screen and the
editor. On the frozen screen, the **?** button shows them too.

## Privacy

Kirishot works offline. It sends nothing over the network: no account, no telemetry, no update
check. Captures, their history and the settings stay on your computer, in `%APPDATA%\Kirishot` and
the folder you save to (`Pictures\Kirishot` by default).

## Building from source

Requirements:

- Windows 11 (x64) with WebView2
- Node.js 24 and pnpm 10
- Rust stable (MSVC toolchain)

```bash
pnpm install
pnpm tauri dev
```

Tests:

```bash
pnpm test
cargo test --manifest-path src-tauri/Cargo.toml
```

Installer (in `src-tauri/target/release/bundle/nsis/`):

```bash
pnpm tauri build --bundles nsis
```

## Contributing

Bug reports and ideas are welcome in [Issues](https://github.com/Joyboy-dy/kirishot/issues). For a
pull request, keep `pnpm lint`, `pnpm test` and `cargo test` green. Design notes and the manual test
checklist are in [`docs/`](docs). Security issues: see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE). Third-party code and its licenses: [THIRD_PARTY.md](THIRD_PARTY.md).
