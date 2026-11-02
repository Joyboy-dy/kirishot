# Contributing to Kirishot

Thanks for your interest in Kirishot! Bug reports, ideas and pull requests are all welcome.

By taking part, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting a bug

Open an [issue](https://github.com/Joyboy-dy/kirishot/issues/new/choose) with the bug template:

- the Kirishot version (**About** page) and your Windows version;
- the steps that lead to the problem, what you expected and what happened;
- a screenshot or a short recording when the problem is visible;
- the log file if Kirishot crashed or misbehaved (**About › Logs folder**).

Security issues go through private reporting instead: see [SECURITY.md](SECURITY.md).

## Suggesting a feature

Open an issue with the feature template and describe the need first (what you are trying to do),
then the solution you have in mind. Kirishot aims to stay small, fast and focused, so a discussion
before any large change saves everyone time.

## Development setup

Requirements: Windows 11 (x64) with WebView2, Node.js 24, pnpm 10 and Rust stable (MSVC toolchain).

```bash
pnpm install
pnpm tauri dev
```

The front end (React, TypeScript) is in `src/`, with one folder per window in `src/windows/`. The
Rust side (Tauri) is in `src-tauri/src/`. Commands and events between the two are typed with
tauri-specta: `cargo test` regenerates `src/lib/bindings.ts`, which must be committed with the Rust
change.

## Pull requests

1. Fork the repository and create a branch from `main` (`fix/thumbnail-focus`, `feat/blur-tool`…).
2. Keep the change focused on one thing, with tests for new behavior and for bug fixes.
3. Run the same checks as the CI before pushing:

   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   cargo fmt --manifest-path src-tauri/Cargo.toml --check
   cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
   cargo test --manifest-path src-tauri/Cargo.toml
   ```

4. For a change you can see or feel (capture, thumbnails, editor), try it in the app and say how in
   the pull request. The manual checklist in [`docs/tests-manuels.md`](docs/tests-manuels.md) lists
   the behaviors worth checking.
5. Open the pull request against `main` and fill in the template.

### Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):
`type(scope): summary`, in English, in the imperative or as a statement of the new behavior.

- Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`.
- Examples: `fix(editor): the view stays fitted to the window`,
  `feat(main): shortcuts page with editable global shortcuts`.

### Style

- Prettier and ESLint for the front end, `rustfmt` and Clippy for Rust: the checks above enforce
  them.
- Match the surrounding code: its naming, its comment density, its idioms.
- User-facing text is in French for now and lives in `src/i18n/fr.json` (and in
  `src-tauri/src/messages.rs` for messages built on the Rust side).

## Design documents

The design notes and specifications behind each milestone are in [`docs/`](docs), in French. They
explain why things work the way they do; reading the relevant one before a larger change helps.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
