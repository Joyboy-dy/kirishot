# Vendored crates

- `drag/`: `drag` 2.1.1 from crates.io (MIT or Apache-2.0, see its license files), plus the
  stuck-drag timeout of [crabnebula-dev/drag-rs#95](https://github.com/crabnebula-dev/drag-rs/pull/95),
  not merged yet. Without it, a `DoDragDrop` that never returns freezes every Kirishot window
  ([drag-rs#94](https://github.com/crabnebula-dev/drag-rs/issues/94)). Remove this folder and the
  `[patch.crates-io]` entry in `src-tauri/Cargo.toml` once a release includes the fix.
