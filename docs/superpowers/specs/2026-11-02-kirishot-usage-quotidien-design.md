# Kirishot : jalon « Usage quotidien » (J2)

Ce document est la spec du jalon qui suit J1. Il complète la spec de la v1 (`2026-11-01-kirishot-design.md`) et la remplace sur les points listés au § 8. Les recherches qui le fondent sont résumées dans `docs/recherche-ux.md`.

## 1. Le besoin

### Ce qui a été dit (retours sur J1, 02/11/2026, note 6/20)

- Les éléments cliquables n'ont pas tous le curseur « main ».
- La loupe doit pouvoir s'activer et se couper pendant la sélection, et être désactivable durablement dans les réglages.
- Les outils d'édition (formes, annotations) manquent. L'éditeur doit rivaliser avec les meilleures applications, avec une interface moderne, élégante et originale, sans design vieillissant.
- Après une capture, une vraie vignette interactive en bas à droite, pas une notification Windows. Un clic l'ouvre dans l'éditeur.
- Un son discret de déclencheur, activable et désactivable dans les réglages.
- Du soin partout : interactions, retours visuels et sonores, transitions, accessibilité, cohérence.
- Ordre choisi : finitions, vignette et éditeur d'abord ; historique, OCR et épingles ensuite.

### Hypothèses

- « Activer la loupe depuis l'éditeur » désigne l'écran de sélection. L'outil Loupe de l'éditeur reste prévu, au jalon suivant.
- Le son est actif par défaut.

### Critère de réussite

L'utilisateur se sert de Kirishot tous les jours à la place de l'Outil Capture d'écran : capture, vignette, annotation rapide, copie, sans friction.

## 2. Écran de sélection : finitions

### 2.1 Curseurs

| Endroit | Curseur |
|---|---|
| Écran figé, hors sélection | `crosshair` |
| Intérieur d'une sélection ajustable | `move` |
| Poignées | `nwse-resize`, `nesw-resize`, `ns-resize`, `ew-resize` selon la poignée |
| Barre d'outils, boutons, liens, cartes cliquables (toutes fenêtres) | `pointer` |
| Glisser en cours (Espace + glisser) | `grabbing` |

La règle est globale : tout élément interactif (`button`, `a`, `[role=button]`, `[role=radio]`, `label` d'une case ou d'un bouton radio, déclencheurs de menu) a `cursor: pointer`, sauf s'il est désactivé (`not-allowed`).

### 2.2 Loupe

- Carré arrondi d'environ 128 px (logiques) qui suit le curseur, décalé en bas à droite. Près d'un bord, il passe de l'autre côté.
- Il montre 15×15 pixels physiques agrandis, sans lissage, avec une grille et la case centrale entourée.
- Sous la grille : la position `x, y` en pixels physiques et la couleur `#RRGGBB`.
- **M** ou le bouton Loupe de la barre d'outils l'active ou la coupe. L'état est mémorisé dans les réglages (`capture.magnifier`) et sert de valeur de départ à la capture suivante.
- **C** copie la couleur visée dans le presse-papiers (`#RRGGBB`), et une pastille « #CFD4DC copié » s'affiche 1,2 s près du curseur.
- La couleur est lue dans une copie CPU de l'image (`Uint8ClampedArray`), jamais avec `getImageData` sur le canvas.

### 2.3 Raccourcis ajoutés

- **Espace + glisser** pendant le tracé : déplace la sélection sans la redimensionner.
- **Alt** pendant le tracé ou le redimensionnement : depuis le centre.
- **R**, **W**, **F** : modes Zone, Fenêtre, Plein écran.
- **Ctrl+C** sur une sélection ajustable : copie seulement (pas de fichier, pas de vignette), avec son et flash.
- L'aide clavier du bas reprend ces raccourcis.

### 2.4 Son et flash

- **Son** : un clic doux d'environ 120 ms, sans échantillon d'appareil photo, créé pour le projet (WAV PCM, intégré au binaire). Rust le joue avec `PlaySoundW(SND_MEMORY | SND_ASYNC | SND_NODEFAULT)` au moment où la capture est validée, avant la fermeture de l'écran figé. Réglage `capture.sound`, actif par défaut.
- **Flash** : un voile blanc de 0 à 30 % puis 0, en 120 ms, sur la zone capturée seulement, juste avant la fermeture. Réglage `capture.flash`, actif par défaut, ignoré quand Windows demande de réduire les animations.

### 2.5 Accessibilité de la barre d'outils

- Info-bulles « Zone · R », « Fenêtre · W », « Plein écran · F », « Loupe · M », « Annuler · Échap », après 400 ms puis immédiates en passant d'un bouton à l'autre.
- `aria-label`, `aria-keyshortcuts`, `aria-pressed` sur les boutons à bascule.
- Tab parcourt la barre ; le focus se voit avec `:focus-visible` (contour accent de 2 px).

## 3. Vignette après capture

### 3.1 Apparence

- Carte d'environ 240 px de large (logiques), aux proportions de la capture, hauteur maximale 180 px. Coins de 12 px, ombre douce, fond sombre opaque derrière le texte.
- Placée à 16 px du coin bas droit de la zone de travail (`rcWork`, sans la barre des tâches) de l'écran de la capture.
- Entrée : translation de 20 px vers le haut et fondu, 220 ms, `cubic-bezier(0.2, 0, 0, 1)`. Sortie : fondu et 8 px vers la droite, 150 ms, ease-in. Aucune animation si Windows demande de réduire les animations.

### 3.2 Interactions

- **Clic sur l'image** : ouvre l'éditeur sur cette capture et annule l'action automatique. La vignette disparaît.
- **Survol** : voile sombre sur l'image et boutons Copier, Enregistrer, Modifier, plus × en coin. Copier et Enregistrer font l'action, la confirment dans le pied (« Copiée », « Enregistrée »), puis ferment la vignette après 800 ms. × ferme sans enregistrer.
- **Glisser** (au-delà de 6 px) : dépose le fichier PNG temporaire dans l'application visée. Le compte à rebours est gelé pendant le glisser. Un dépôt réussi compte comme un enregistrement par l'autre application : l'action automatique s'applique quand même à la fin.
- **Clic droit** : menu Ouvrir le dossier, Copier le chemin, Supprimer (désactivés tant que le fichier final n'existe pas, sauf Supprimer qui jette la capture).
- Curseurs : `pointer` sur l'image et les boutons, `grabbing` pendant le glisser.

### 3.3 Compte à rebours et action automatique

- Durée `afterCapture.thumbnailSeconds` : 3, 6 (par défaut) ou 10 s, ou `null` pour « jusqu'à fermeture ».
- Une barre de 2 px en bas de la carte montre le temps restant. Le survol met en pause ; le compte reprend à la sortie de la souris.
- **Dès la capture**, l'image est copiée dans le presse-papiers si l'action automatique comprend la copie (`saveAndCopy` ou `copy`). Ctrl+V marche donc tout de suite.
- **À la fin du compte**, Kirishot écrit le fichier si l'action comprend l'enregistrement (`saveAndCopy` ou `save`). Le pied annonce l'action pendant le compte : « Enregistrement dans 4 s », puis « Enregistrée et copiée ».
- `afterCapture.alwaysOpenEditor` : la vignette est sautée, l'éditeur s'ouvre directement.
- `afterCapture.thumbnail` à `false` : comportement de J1 (action immédiate et notification Windows).

### 3.4 Empilement

- Jusqu'à 3 vignettes visibles, la plus récente en bas (la plus proche du coin), 8 px d'écart, chacune avec son compte à rebours.
- Au-delà, une pastille « +N » au-dessus de la pile. Quand une vignette part, la suivante en attente entre.
- Une capture faite sur un autre écran déplace la pile sur cet écran.

### 3.5 Fonctionnement technique

- **Une seule fenêtre** `thumbnails`, créée cachée au démarrage : `focusable(false)`, `focused(false)`, `always_on_top`, `skip_taskbar`, `decorations(false)`, `transparent`, `shadow(false)`. Rust la redimensionne à la taille exacte de la pile et l'ancre au coin de la zone de travail, en pixels physiques.
- Affichage avec `ShowWindow(SW_SHOWNOACTIVATE)`. La fenêtre est sous-classée pour répondre `MA_NOACTIVATE` à `WM_MOUSEACTIVATE`, pour qu'un clic dans WebView2 ne l'active pas. Le focus reste dans l'application de l'utilisateur.
- À la capture, Rust encode un PNG dans `%TEMP%\Kirishot\<id>.png`. Ce fichier sert à l'image de la vignette (`convertFileSrc`, protocole asset limité à ce dossier) et au glisser. Il est supprimé quand la vignette et l'éditeur de cette capture sont fermés, et le dossier est vidé au démarrage.
- Glisser : `tauri-plugin-drag` (`startDrag({ item: [path], icon })`). `DoDragDrop` peut ne jamais rendre la main (drag-rs #94) : l'appel est protégé par un délai de 30 s, avec le correctif du PR #95 repris dans une copie locale du plugin si la version publiée ne l'a pas.
- Le compte à rebours vit dans le front ; à son terme, le front appelle `thumbnail_expire(id)` et Rust applique l'action. Rust reste la source de vérité : une capture ne reçoit son action automatique qu'une fois.

## 4. Éditeur

### 4.1 Fenêtre et disposition

- Fenêtre normale, redimensionnable, 1200×800 par défaut (bornée à 90 % de la zone de travail), thème Windows (sombre ou clair). Titre : « Capture du 02/11/2026 à 09:56 ». Elle est créée cachée au démarrage et réutilisée.
- **Barre du haut**, une seule ligne :
  - à gauche, les outils ;
  - au milieu, le style courant : 8 couleurs (orange Kirishot, rouge, jaune, vert, bleu, violet, noir, blanc), 4 tailles, contour ou remplissage léger, ombre ;
  - à droite, Annuler, Rétablir, Copier, Enregistrer, et le bouton principal **Copier et fermer**.
- **Bulle contextuelle** à côté de l'annotation sélectionnée : style de trait (plein, tirets, points), opacité, style de texte, Premier plan, Arrière-plan, Supprimer. Pas de panneau latéral fixe.
- **Barre d'état** en bas : dimensions de l'image, nombre d'annotations, zoom (−, valeur, +, Ajuster).
- Choisir un style s'applique à la sélection **et** devient le style des prochaines annotations.

### 4.2 Outils

| Outil | Touche | Comportement |
|---|---|---|
| Sélection | V | Clic, Maj+clic pour ajouter, cadre de sélection. Déplacer, redimensionner, Alt+glisser duplique, Suppr supprime, flèches déplacent de 1 px (Maj : 10 px). |
| Flèche | A | Corps effilé et pointe pleine, liseré blanc de 2 px, ombre douce. Une poignée au milieu la courbe (Bézier quadratique ; la pointe suit la tangente). Maj contraint à 15°. |
| Rectangle | R | Contour ou remplissage léger, coins de 6 px. Maj : carré. |
| Ellipse | E | Mêmes options. Maj : cercle. |
| Ligne | L | Plein, tirets ou points. Maj contraint à 15°. |
| Crayon | P | Tracé lissé avec perfect-freehand. |
| Surligneur | H | Trait large à extrémités plates, mode `multiply`, opacité 100 %. Maj : ligne droite. |
| Texte | T | Clic : le texte se crée et la saisie commence. Entrée ajoute une ligne, Échap ou un clic dehors valide. Double-clic : modifier. Styles : simple avec ombre, pastille colorée, contour. Police Geist, graisse 600. |
| Étapes | N | Pastille pleine, numéro blanc, anneau blanc. Le numéro dépend de l'ordre des pastilles et se recalcule après une suppression. |
| Masquer | B | Pixelisation à blocs de 16 px de l'image d'origine, plus un léger bruit, pour qu'aucun texte ne se reconstitue. |
| Recadrer | C | Cadre à poignées, Entrée valide, Échap annule. Non destructif, modifiable ensuite. |

- **1 à 4** : taille du trait (fin, moyen par défaut, épais, très épais), proportionnelle à la taille de l'image (`max(2, round(min(w, h) / 300))` px pour « moyen »).
- **Ctrl+Z**, **Ctrl+Y** / **Ctrl+Maj+Z**, **Ctrl+D** (dupliquer), **Ctrl+A** (tout sélectionner), **Ctrl+C** (copier l'image finale, sauf pendant la saisie d'un texte), **Ctrl+S** (enregistrer), **Ctrl+Maj+S** (enregistrer sous), **Ctrl+Entrée** (copier et fermer), **Échap** (désélectionner, puis fermer).
- Zoom : **Ctrl + molette** sous le curseur, **Ctrl+0** ajuster, **Ctrl+1** 100 %. Déplacement : **Espace + glisser** ou bouton du milieu.
- Info-bulles « Flèche · A » sur tous les boutons.

### 4.3 Modèle et rendu

- `src/editor/document.ts` : le document de la spec v1 (§ 7.2), sans `spotlight`, `magnifier` ni `beautify` pour ce jalon. Les champs ajoutés : `text.style: 'plain' | 'pill' | 'outline'`, `blur.kind: 'pixelate'`. TypeScript pur, testé sans interface.
- Historique d'annulation : copies immuables, 200 au plus.
- Konva (react-konva) :
  - calque 1, `listening(false)` pour l'image de fond : l'image et les annotations validées (le mode `multiply` du surligneur ne mélange qu'avec le même calque) ;
  - calque 2 : l'annotation en cours de tracé ;
  - calque 3 : le `Transformer` et les poignées.
- L'affichage et l'export passent par les mêmes nœuds Konva : l'export redessine la scène à l'échelle 1, sans calque d'interface. Ce qu'on voit est donc ce qu'on exporte, sans second moteur de rendu. XenSnip (MIT, attribution dans `THIRD_PARTY.md`) sert de modèle pour la pixelisation et la saisie de texte. La pixelisation est calculée sur un canvas hors écran mis en cache par annotation, recalculé à la fin d'un déplacement.
- Export : `stage.toCanvas` à l'échelle 1 sur la zone recadrée, `toBlob` en PNG, envoyé à Rust en binaire brut (`tauri::ipc::Request`). Rust encode au format choisi, enregistre et copie.

### 4.4 Sauvegarde

- À l'ouverture de l'éditeur, l'original est écrit dans `%APPDATA%\Kirishot\captures\<id>\original.png`. Le document est écrit dans `document.json` une seconde après la dernière modification (écriture atomique).
- Fermer l'éditeur ne demande rien et ne perd rien. La fenêtre Historique, au jalon suivant, s'appuiera sur ce dossier. Les captures jamais ouvertes dans l'éditeur n'y sont pas gardées.

## 5. Cohérence générale

- **Durées** : 120 à 180 ms pour un survol ou un petit changement d'état, 200 à 250 ms pour un panneau. Entrée `cubic-bezier(0.2, 0, 0, 1)`, sortie ease-in, aucun rebond. Tout est coupé avec `prefers-reduced-motion`.
- **États** : survol, surface éclaircie de 6 à 8 % ; appui, `scale(0.97)` ; outil actif, fond accent atténué et icône accent ; désactivé, opacité 40 % et `not-allowed`.
- **Contrastes** : 4,5:1 pour le texte, 3:1 pour les icônes et les contours, y compris sur les surfaces en verre (fond plus opaque derrière le texte).
- **Annonces** : « Copiée dans le presse-papiers » et « Enregistrée » passent par une région `aria-live` dans la vignette et l'éditeur.
- **Réglages › Capture** (nouvelle section de la page) : Loupe au démarrage, Son de capture, Flash, Durée de la vignette, Afficher la vignette, Toujours ouvrir l'éditeur.

## 6. Données

### 6.1 Réglages (ajouts à `settings.json`, toujours en version 1)

```json
{
  "afterCapture": {
    "autoAction": "saveAndCopy",
    "thumbnail": true,
    "thumbnailSeconds": 6,
    "alwaysOpenEditor": false
  },
  "capture": {
    "magnifier": true,
    "sound": true,
    "flash": true,
    "includeCursor": false,
    "trayTimerSeconds": 3,
    "commitOnRelease": false
  }
}
```

- `thumbnailSeconds` vaut 3, 6, 10 ou `null`. Une valeur absente prend sa valeur par défaut, comme les autres champs.

### 6.2 Cycle de vie d'une capture

1. Validation dans l'écran de sélection : son, flash, découpe. La capture entre dans `store` avec un état `pending`.
2. Copie immédiate si l'action la comprend. PNG temporaire écrit. Vignette poussée.
3. Fin du compte à rebours : `thumbnail_expire(id)`, enregistrement si l'action le comprend, état `delivered`, libération de l'image si l'éditeur n'est pas ouvert.
4. Ouverture de l'éditeur : état `editing`, l'action automatique ne s'appliquera plus. L'image reste en mémoire tant que l'éditeur est ouvert.

## 7. Erreurs et tests

### 7.1 Erreurs

| Cas | Comportement |
|---|---|
| La fenêtre des vignettes manque ou ne répond pas | Retour au comportement de J1 : action immédiate et notification Windows. La capture n'est jamais perdue. |
| Échec d'écriture du PNG temporaire | La vignette s'affiche à partir de l'image en mémoire, sans glisser possible. |
| Glisser bloqué | Abandon après 30 s ; l'application reste réactive. |
| Échec d'export dans l'éditeur | Message dans la barre d'état de l'éditeur ; le document reste ouvert. |
| Échec de lecture du son | Ignoré, écrit dans les journaux. |

### 7.2 Tests

- **Unitaires (Vitest)** : modèle du document (ajout, modification, suppression, annuler, rétablir, limite de 200), renumérotation des étapes, géométrie de la flèche courbe (tangente de la pointe), taille de trait proportionnelle, pixelisation (blocs uniformes), compte à rebours (pause, reprise, expiration unique), placement de la loupe près des bords.
- **Unitaires (Rust)** : placement et taille de la pile de vignettes dans la zone de travail, machine d'états `pending → delivered | editing`, action automatique appliquée une seule fois, nouveaux réglages et leurs valeurs par défaut.
- **Export** : test manuel de l'image exportée (pleine résolution, recadrage, surligneur sur l'image) ; l'affichage et l'export partagent les mêmes nœuds, il n'y a pas de second rendu à comparer.
- **Manuels** (ajouts à `docs/tests-manuels.md`) : le focus ne passe jamais à la vignette, glisser vers Discord et l'Explorateur, son et flash, navigation au clavier dans la barre de sélection et l'éditeur, contraste en thème clair.

## 8. Ce que ce jalon change dans la spec v1

- § 3.2 : loupe de 15×15 pixels, activable (M, réglage), C copie la couleur ; Espace, Alt et Ctrl+C ajoutés.
- § 3.3 : durées 3, 6 ou 10 s ou « jusqu'à fermeture » (6 s par défaut) ; la plus récente en bas ; copie immédiate, enregistrement à la fin du compte ; boutons Copier, Enregistrer, Modifier, × (Épingler au jalon des épingles).
- § 3.6 : pas de panneau de propriétés fixe, une bulle contextuelle ; la touche de l'ellipse est E ; Masquer (B) ne propose que la pixelisation dans ce jalon.
- § 3.9 et § 7.1 : son actif par défaut ; ajout de `capture.magnifier`, `capture.flash`, `afterCapture.thumbnail` ; `thumbnailSeconds` à 6.
- § 14 : J2 devient ce jalon ; les anciens J2 à J4 sont redécoupés (§ 9).

## 9. Jalons suivants (redécoupage)

| Jalon | Contenu |
|---|---|
| **J2** (ce document) | Finitions de la sélection, son, flash, vignette, éditeur avec les outils essentiels. |
| **J3** | Historique (fenêtre et index), outils Projecteur, Loupe, Pipette, flou gaussien, panneau Embellir. |
| **J4** | OCR, retardateur, épingles, Refaire la dernière zone, détection des éléments d'interface sous la souris. |
| **J5** | Premier lancement, réglages complets, traduction anglaise, mises à jour, première Release. |
