# Port Linux de Kirishot

Ce document décrit le port Linux du fork `nyx-deb/kirishot`, branche `version_linux`. L'objectif est
un port minimal fonctionnel : compiler sous Linux, capturer l'écran, afficher l'écran de sélection,
éditer et enregistrer une capture. Le reste (curseur, fonctions spécifiques à Windows) reste en
TODO.

## État

Fonctionne :

- capture d'un écran, d'une région ou d'une fenêtre via `xcap` ;
- écran de sélection figé, loupe, accrochage aux fenêtres, raccourcis de l'écran de sélection ;
- éditeur (formes, texte, flèches, pixelisation, recadrage) ;
- sauvegarde PNG, JPG, WebP et historique ;
- presse-papiers image et texte via `arboard` ;
- vignettes flottantes ;
- raccourcis globaux via `tauri-plugin-global-shortcut` ;
- icône de zone de notification (tray) ;
- lancement à l'ouverture de session via `tauri-plugin-autostart` (fichier `.desktop` XDG) ;
- son de l'obturateur via `paplay`, `pw-play` ou `aplay` ;
- chemins de données XDG.

Limitations connues :

- le curseur n'est pas dessiné dans la capture (`includeCursor` est ignoré) ;
- sous Wayland, le support de `xcap` est partiel (wlroots et PipeWire) : selon le compositeur, la
  capture peut échouer ou demander une autorisation ; la liste des fenêtres est vide car le
  protocole n'expose pas les fenêtres des autres applications ;
- les compositions `Super` sont souvent réservées par le compositeur (GNOME, KDE). Les raccourcis
  par défaut `Super+Shift+S` et `PrintScreen` peuvent donc ne pas être reçus ; il faut les changer
  depuis la page Raccourcis ;
- l'enregistrement d'un nouveau raccourci se fait dans la page (pas de hook clavier bas niveau) ;
  une combinaison déjà prise par le compositeur peut être refusée ;
- le thème du panneau n'est pas détecté : l'icône blanche (`tray-dark.png`) est utilisée, elle peut
  être peu visible sur un panneau clair ;
- le glisser-déposer des vignettes dépend de `tauri-plugin-drag` et n'a pas été validé sous Wayland.

## Dépendances système

Debian / Ubuntu :

```bash
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
  librsvg2-dev patchelf build-essential curl wget file libssl-dev libxdo-dev \
  libxcb1-dev libxrandr-dev libdbus-1-dev libwayland-dev libxkbcommon-dev \
  libpipewire-0.3-dev libclang-dev libegl-dev pkg-config
```

Fedora :

```bash
sudo dnf install webkit2gtk4.1-devel gtk3-devel libappindicator-gtk3-devel \
  librsvg2-devel patchelf openssl-devel libxcb-devel libXrandr-devel dbus-devel \
  wayland-devel libxkbcommon-devel pipewire-devel clang-devel mesa-libEGL-devel pkgconf
```

Arch :

```bash
sudo pacman -S webkit2gtk-4.1 gtk3 libayatana-appindicator librsvg patchelf \
  openssl libxcb libxrandr dbus wayland libxkbcommon pipewire clang mesa base-devel
```

Un lecteur audio (`paplay`, `pw-play` ou `aplay`) est nécessaire pour le son de l'obturateur.

## Compilation

```bash
pnpm install
pnpm tauri dev
```

Paquet :

```bash
pnpm tauri build --bundles deb        # ou rpm, appimage
```

La configuration Linux est dans `src-tauri/tauri.linux.conf.json`. Tauri la fusionne avec
`tauri.conf.json` quand la compilation cible Linux. Elle remplace les cibles de paquet (`nsis` sous
Windows) par `deb`, `rpm` et `appimage`.

`Cargo.lock` doit être régénéré au premier build : `arboard` a été ajouté aux dépendances Linux et
`clipboard-win`, `webview2-com` et `windows` sont maintenant limités à Windows.

## Notes d'implémentation

- **Frame de l'écran figé** : WebView2 ne sert que sous Windows. Sous Linux, `frame::post_frame`
  envoie un événement `overlay-frame` contenant la frame en base64 et la session en JSON. La page
  overlay écoute cet événement via `@tauri-apps/api/event`.
- **Fenêtres** : `capture::windows::enumerate_windows` utilise `xcap::Window::all()` sous Linux,
  qui s'appuie sur X11 (`_NET_CLIENT_LIST_STACKING`). Les fenêtres sont déjà triées de la plus haute
  à la plus basse.
- **Presse-papiers** : `arboard` publie l'image en `image/png`, format compris par la plupart des
  applications GTK et Qt.
- **Raccourcis globaux** : tout passe par le plugin, y compris `PrintScreen`. La page Raccourcis
  capture les touches en JavaScript et construit l'accélérateur au format Tauri (`Super+Shift+S`).
- **Chemins** : `$XDG_DATA_HOME/kirishot`, ou `~/.local/share/kirishot` si la variable est absente.
  Les fichiers temporaires restent dans `$TMPDIR/Kirishot`.
- **Zone de notification** : `libayatana-appindicator3` est requis à l'exécution. Le thème du
  panneau n'étant pas exposé, l'icône claire sur fond sombre est toujours choisie.

## Tests

```bash
pnpm lint
pnpm typecheck
pnpm test
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

Le test `capture_all_smoke` est ignoré par défaut : il demande un affichage réel.
