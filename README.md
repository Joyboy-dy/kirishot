# Kirishot

A clean, fast screenshot tool for Windows and Linux.

> **Status:** first public release, 0.1.0. Windows 11 only upstream.
>
> **Linux port:** this fork (`version_linux`) adds a minimal Linux port. Dependencies, build steps
> and known limitations are in [docs/port-linux.md](docs/port-linux.md) (French).

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
- Editable global shortcuts, a theme setting, and launch at login.

## Download

Get `Kirishot_<version>_x64-setup.exe` from the [latest release](https://github.com/Joyboy-dy/kirishot/releases/latest)
and run it. It installs for the current user, without administrator rights, and can launch Kirishot
right away.

The installer is not code-signed yet, so Windows SmartScreen may warn about an unknown publisher:
choose **More info**, then **Run anyway**. Kirishot is uninstalled from **Settings › Apps**.

## Shortcuts

| Action                       | Default                                |
| ---------------------------- | -------------------------------------- |
| Capture a region or a window | **Win + Shift + S** or **PrintScreen** |
| Capture the whole screen     | **Shift + PrintScreen**                |

Both can be changed on the **Shortcuts** page, which also lists the keys of the frozen screen and the
editor. On the frozen screen, the **?** button shows them too.

## Privacy

Kirishot works offline. It sends nothing over the network: no account, no telemetry, no update
check. Captures, their history and the settings stay on your computer, in `%APPDATA%\Kirishot`
(`$XDG_DATA_HOME/kirishot` on Linux) and the folder you save to (the `Kirishot` subfolder of your
Pictures folder by default).

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

### Linux

Requirements:

- X11 or Wayland (XWayland recommended for the window list)
- Node.js 24 and pnpm 10
- Rust stable
- WebKitGTK 4.1, GTK 3, libayatana-appindicator, librsvg and patchelf

```bash
# Debian / Ubuntu
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
  librsvg2-dev patchelf libxdo-dev libxcb1-dev libxrandr-dev libdbus-1-dev \
  libwayland-dev libxkbcommon-dev libpipewire-0.3-dev libclang-dev libegl-dev pkg-config

pnpm install
pnpm tauri dev
```

Packages (in `src-tauri/target/release/bundle/`):

```bash
pnpm tauri build --bundles deb      # or rpm, appimage
```

`Cargo.lock` is regenerated on the first Linux build. Full details and known limitations:
[docs/port-linux.md](docs/port-linux.md) (French).

## Contributing

Bug reports, ideas and pull requests are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md). Security issues: see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE). Third-party code and its licenses: [THIRD_PARTY.md](THIRD_PARTY.md).
