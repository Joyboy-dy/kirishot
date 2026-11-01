# Spike de latence (J0)

- **Date** : 1er novembre 2026
- **Question** (spec § 9) : l'approche A (capture en Rust, écran figé affiché dans une webview) affiche-t-elle l'écran figé en moins de 150 ms après le raccourci ?
- **Code** : branche `spike/latence`, jetable et non fusionnée. Les scripts sont dans `scripts/spike/` sur cette branche, avec les CSV bruts.

## Machine

- Windows 11 Pro 10.0.26300, x64.
- Un seul écran : 1920 × 1080 px physiques, à l'échelle 125 %. **Aucun test sur deux écrans ni en 4K.**
- Build `release` (sans LTO pour aller plus vite), WebView2 156.

## Méthode

Le raccourci déclenche la mesure.
- `t0` est noté dans le gestionnaire du raccourci.
- Rust capture l'écran avec `xcap` (un fil par écran), puis envoie les pixels RGBA, précédés de 8 octets de taille, à la fenêtre de sélection.
- La page dessine les pixels avec `putImageData` et prévient Rust, qui affiche la fenêtre.
- La page attend d'être visible, puis deux `requestAnimationFrame`, et prévient à nouveau Rust, qui note `total = t1 − t0`.

Chaque combinaison a été mesurée sur 20 captures déclenchées par un script, à 1,5 s d'intervalle. La première capture (chauffe) est écartée, donc les statistiques portent sur n = 19.

Variantes testées :
- **V1** : la fenêtre est créée cachée sur son écran, puis affichée avec `show()`.
- **V2** : la fenêtre est gardée visible hors de l'écran (−32000, −32000), puis déplacée sur l'écran.
- **Moteur de capture** : `xcap` par défaut (GDI), ou avec la feature `wgc` (Windows Graphics Capture).
- **Transport des pixels** :
  - le protocole `kirishot` (`fetch`) ;
  - l'IPC binaire de Tauri (`tauri::ipc::Response`) ;
  - le **SharedBuffer de WebView2** (`CreateSharedBuffer` puis `PostSharedBufferToScript`) : une seule copie mémoire côté Rust, et aucune copie à travers l'IPC.

## Mesures (ms)

Les colonnes `capture`, `transfert` et `dessin` sont des moyennes. `affichage` est le moment moyen où `show()` se termine, compté depuis `t0`.

| Combinaison | Médiane | 90e centile | capture | transfert | dessin | affichage |
|---|---|---|---|---|---|---|
| V1, xcap par défaut, protocole (série 1) | 139 | 156 | 37 | 83 | 1 | 124 |
| V1, xcap par défaut, protocole (série 2) | 154 | 168 | 39 | 86 | 1 | 128 |
| V1, xcap WGC, protocole | 203 | 252 | 97 | 86 | 1 | 188 |
| V2, xcap par défaut, protocole | 148 | 187 | 37 | 82 | 1 | 123 |
| V2, xcap WGC, protocole | 213 | 244 | 97 | 88 | 1 | 189 |
| V1, xcap par défaut, IPC binaire | 152 | 225 | 40 | 93 | 1 | 137 |
| **V1, xcap par défaut, SharedBuffer** | **78** | **87** | 37 | ~0 | 4 | 49 |

Une série de contrôle de 10 captures avec la combinaison retenue donne 66 à 85 ms, après une première capture à 137 ms (chauffe).

**Lecture**
- Avec le protocole ou l'IPC, le transfert de 8,3 Mo coûte ~85 ms, soit environ 100 Mo/s. On est pile à la limite de 150 ms sur un écran 1080p, et un écran 4K (×4 pixels) la dépasserait largement.
- Le SharedBuffer supprime ce coût : il ne reste qu'une copie mémoire (~3 ms) et le dessin (~4 ms).
- Le moteur WGC capture 2,5 fois plus lentement que le moteur par défaut.

## Vérifications

| Point | Résultat |
|---|---|
| Flash blanc, noir ou image périmée (10 captures observées par l'utilisateur) | **Rien de visible.** |
| Recouvrement de la barre des tâches (`WindowFromPoint` au milieu de la barre pendant l'affichage) | **Oui** : la fenêtre de sélection est au-dessus de la barre des tâches. |
| `RegisterHotKey` (plugin global-shortcut) sur `PrintScreen` | L'enregistrement **réussit**, mais **aucun événement n'arrive**. La touche n'atteint jamais Kirishot, que le réglage de Windows soit actif ou désactivé par le registre. |
| Hook clavier bas niveau (`WH_KEYBOARD_LL`) | **Fonctionne** : 3 appuis sur 3 ont déclenché la capture. Le hook avale la touche, donc l'outil de capture de Windows ne s'ouvre pas, **même avec le réglage de Windows par défaut**. |
| Écrire `PrintScreenKeyForSnippingEnabled = 0` dans le registre, sans fermer la session | **Sans effet immédiat** : la superposition de l'outil de capture de Windows s'ouvre toujours. Le registre a été remis dans son état d'origine (valeur absente). |
| Mémoire au repos, une minute après le lancement (1 écran, `kirishot.exe` et 6 processus WebView2) | **109 Mo privés** (objectif : 150 Mo). L'ensemble de travail affiche 315 Mo, mais il compte plusieurs fois les bibliothèques partagées entre processus. |
| `xcap::Monitor` | Ce type n'est ni `Send` ni `Sync`. Chaque fil de capture doit retrouver son écran avec `Monitor::from_point`, à partir du centre de l'écran. |

## Décisions

- **Approche : A**
- **Affichage : V1**
- **Capture : xcap par défaut**
- **Transport : SharedBuffer WebView2.** Cette décision est nouvelle par rapport au plan, qui prévoyait le protocole `kirishot`.
- **Impr. écran : hook bas niveau**
- **Registre : nouvelle session.** Une simple écriture ne suffit pas, et elle devient inutile avec le hook.

## Conséquences pour la suite

1. **J1, tâche 6** : la fenêtre de sélection reçoit ses pixels par SharedBuffer, et non par le protocole `kirishot`. L'en-tête de 8 octets (largeur et hauteur) est conservé.
2. **J1, tâches 10 et 11** : Rust envoie, dans le même message, le buffer et la session de sélection (écran, fenêtres, curseur, réglage `commitOnRelease`), via le JSON `additionalData` de `PostSharedBufferToScript`. La commande `overlay_session` et l'événement `CaptureReady` deviennent inutiles.
3. **J1, tâche 10b** : elle devient obligatoire. Le hook gère `PrintScreen` et `Shift+PrintScreen`, et le plugin global-shortcut garde les autres combinaisons.
4. **J6** : libérer Impr. écran dans le registre n'est plus nécessaire, puisque le hook passe avant Windows. L'étape 1 du premier lancement (§ 3.10) et le bandeau des réglages (§ 3.9) sont à revoir en écrivant le plan de J6.
5. **Risques** :
   - Certains antivirus surveillent les hooks clavier. Le hook ne lit que `VK_SNAPSHOT` et passe tout le reste à `CallNextHookEx`, sans le lire.
   - Windows retire un hook dont la procédure est trop lente. La procédure ne fait donc que lancer un fil.
   - Le comportement sur deux écrans et en 4K reste à mesurer pendant les tests manuels de J1.
