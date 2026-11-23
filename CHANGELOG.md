# Changelog

## Non publié

Port Linux (branche `version_linux`) :

- Compilation sous Linux : dépendances Windows (`clipboard-win`, `webview2-com`, `windows`)
  limitées à Windows, ajout de `arboard` pour le presse-papiers.
- Capture d'écran, écran de sélection, éditeur, sauvegarde, historique et vignettes fonctionnels
  sous X11 et Wayland (via `xcap` et le portail PipeWire).
- Transfert de l'écran figé par un événement `overlay-frame` en base64, à la place du buffer
  partagé WebView2.
- Liste des fenêtres sous Linux via `xcap::Window::all()`.
- Presse-papiers image (`image/png`) et texte via `arboard`.
- Raccourcis globaux gérés par `tauri-plugin-global-shortcut`, enregistrement des combinaisons
  depuis la page Raccourcis.
- Son de l'obturateur via `paplay`, `pw-play` ou `aplay`.
- Chemins de données XDG (`$XDG_DATA_HOME/kirishot`).
- Configuration de paquet Linux (`deb`, `rpm`, `appimage`) et icône de zone de notification.
- Libellés de l'interface neutralisés (système au lieu de Windows).
- Limites connues : curseur non dessiné, liste des fenêtres vide sous Wayland pur, compositions
  `Super` parfois réservées par le compositeur. Voir `docs/port-linux.md`.

## 0.1.0 (2026-11-02)

First public release.

- Frozen-screen capture of a region, a window or the whole screen, with a magnifier, window snapping
  and keyboard shortcuts; the default start mode can be set.
- Floating thumbnails: copy, save, edit, or drag the capture into another app.
- Editor: arrows, lines, shapes, pen, highlighter, text, numbered steps, pixelation and crop; custom
  colours and an eyedropper; a view fitted to the window.
- Smart saving: replace, new version or save as; rename in place; a question before closing unsaved
  changes.
- History of every capture, searchable, with its annotations kept.
- Editable global shortcuts, light and dark themes, launch at Windows startup.
