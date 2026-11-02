# Kirishot : corrections après les tests de J2 (J2.1)

Ce document est la spec d'un jalon court qui corrige J2 avant sa fusion dans `main`. Il complète la spec J2 (`2026-11-02-kirishot-usage-quotidien-design.md`) et la remplace sur les points listés au § 6. Le travail se fait sur la branche `feat/j2`.

## 1. Le besoin

### Ce qui a été dit (tests de J2, 02/11/2026)

- Les raccourcis manquent de clarté ; la ligne d'aide en bas de l'écran de capture est trop encombrante.
- « Zone » et « Fenêtre » donnent presque le même résultat.
- La barre d'outils de capture peut masquer ce qu'on veut capturer : la laisser telle quelle, mais permettre de choisir sa position dans les réglages.
- L'éditeur n'est pas responsive : défilements horizontaux, éléments compressés, libellés sur deux lignes.
- La bulle contextuelle est coupée près du bord droit.
- Certaines options de la bulle ne marchent pas (tirets sur les flèches, points sur les cadres, opacité incohérente). Une option inapplicable ne doit pas être proposée.
- Le surligneur n'a presque aucun réglage. L'outil texte ne marche pas du tout.
- Un flash ou décalage apparaît au clic sur Copier ou Enregistrer.
- Le retour de réussite doit se voir sur le bouton (icône remplacée par une coche) ; le message de la barre d'état doit s'effacer seul. Pas de notification toast.

### Diagnostic

| Symptôme | Cause |
|---|---|
| Texte qui n'apparaît pas | Le champ de saisie s'ouvre au `mousedown` ; l'action par défaut du navigateur rend ensuite le focus au canevas, le champ le perd et se ferme vide. |
| Flèche en tirets sans effet | La flèche est une forme pleine (`fill`), sans trait : le style ne peut rien changer. |
| Style « points » invisible | Motif `[0.01, 2w]` avec des extrémités `butt` : chaque point a une longueur quasi nulle. |
| Surligneur sans réglages | Il n'a pas de champ `stroke` ; la bulle n'affiche donc que l'ordre. |
| Flash à l'export | `renderPng` déplace et remet à l'échelle le calque visible ; un rafraîchissement le dessine entre-temps. |
| Bulle coupée | Elle est centrée sous l'élément, sans être bornée à la zone visible. |
| Zone ≈ Fenêtre | En mode Zone, le survol surligne déjà les fenêtres et un clic sans glisser capture la fenêtre. |
| Validation automatique introuvable | `capture.commitOnRelease` existe mais n'a pas de réglage visible. |

### Hors périmètre (jalon J3)

Page de raccourcis consultable et personnalisable ; processus de capture configurable au-delà du § 2.4 ; enregistrement intelligent dans l'éditeur (pas de doublon sans modification, remplacer ou créer une version) ; renommer le fichier depuis l'éditeur ; couleurs libres et pipette (dans l'image et ailleurs à l'écran).

### Critère de réussite

Chaque option affichée agit vraiment ; le texte s'ajoute et se modifie de façon fiable ; l'éditeur reste propre de 520 × 400 jusqu'au plein écran ; les deux modes de capture ont un comportement clairement différent.

## 2. Écran de capture

### 2.1 Modes

| Mode | Survol | Clic sans glisser | Glisser |
|---|---|---|---|
| Zone | rien n'est surligné | rien | trace la zone |
| Fenêtre | la fenêtre sous le curseur est surlignée, avec une étiquette portant son titre | capture la fenêtre | aucun tracé ; au relâchement, la fenêtre sous le pointeur est capturée |
| Plein écran | inchangé | inchangé | inchangé |

- Le mode choisi (R, W ou bouton) est mémorisé dans `capture.mode` et repris à la capture suivante. F reste une action immédiate, jamais mémorisée.
- L'étiquette de titre est placée au-dessus du surlignage, dans l'écran ; tronquée à 60 caractères.

### 2.2 Aide

- La ligne d'aide en bas (`KeyHints`) est supprimée.
- Un bouton « ? » rejoint la barre d'outils (info-bulle « Raccourcis »). Lui ou la touche `?` (Maj+, sur AZERTY : on teste `e.key === '?'`) affiche une liste complète des raccourcis par-dessus l'écran, groupée (Sélection, Modes, Loupe et couleur, Valider). `?` ou Échap la referment ; Échap ne quitte alors pas la capture.

### 2.3 Position de la barre d'outils

- Comportement inchangé. Nouveau réglage `capture.toolbarPosition` : `"top"` (défaut) ou `"bottom"`, dans Réglages › Capture, libellé « Position de la barre d'outils ».

### 2.4 Validation au relâchement

- `capture.commitOnRelease` devient visible dans Réglages › Capture : « Capturer dès que je relâche la souris ». Désactivé par défaut. Avec ce réglage, Ctrl+C reste disponible en le pressant pendant le tracé (comportement J2 inchangé).

## 3. Éditeur : outils et bulle

### 3.1 Règle

Une option n'apparaît que si elle agit sur l'élément. La barre du haut montre les réglages de l'outil actif, ou ceux de la sélection en mode Sélection. La bulle montre les réglages de la sélection ; avec plusieurs éléments, seulement ceux qu'ils ont tous. La table ci-dessous est la source unique (`src/windows/editor/tools/options.ts`), testée.

| Élément | Couleur | Épaisseur / taille | Style de trait | Remplissage | Ombre | Opacité | Autre |
|---|---|---|---|---|---|---|---|
| Flèche | oui | oui | oui | | oui | oui | |
| Ligne | oui | oui | oui | | oui | oui | |
| Rectangle, ellipse | oui | oui | oui | oui | oui | oui | |
| Crayon | oui | oui | | | | oui | |
| Surligneur | oui | oui | | | | oui | |
| Texte | oui | oui (taille) | | | | | style simple / pastille / contour |
| Étape | oui | oui (taille) | | | | | |
| Pixelisation | | | | | | | intensité fine / moyenne / forte |

Premier plan, arrière-plan et supprimer sont toujours proposés. Les options s'appliquent à la sélection en un seul pas d'historique.

### 3.2 Corrections

- **Texte** : le champ s'ouvre au relâchement (`pointerup`) et prend le focus après le rendu ; le `mousedown` qui le crée empêche l'action par défaut. Échap, Ctrl+Entrée ou un clic ailleurs valident ; Entrée seule va à la ligne. Un double-clic (outil Sélection) ou un clic sur un texte avec l'outil Texte le modifie. Un texte vide à la validation est supprimé.
- **Flèche** : rendue en deux parties, un trait (droit ou courbe, `lineCap` rond, motif de tirets possible) et une pointe pleine. La géométrie de la pointe reste celle de `arrowOutline` ; le contour blanc est conservé.
- **Points** : motif `[0, 2w]` avec `lineCap: 'round'` ; tirets `[3w, 2w]`. Pour les rectangles et ellipses, les mêmes valeurs.
- **Opacité** : un curseur de 10 à 100 %, appliqué à tout l'élément (trait et remplissage ensemble, propriété `opacity` du nœud), pour chaque élément qui le propose dans la table du § 3.1 ; le surligneur garde son mode `multiply` sous l'opacité.
- **Surligneur** : gagne un champ `opacity` (défaut 1) ; sa couleur et son épaisseur sont modifiables après coup.
- **Pixelisation** : champ `block` (8, 16 ou 28 px ; défaut 16, « moyenne »).
- **Bulle** : placée sous la sélection, au-dessus si elle n'a pas la place, bornée horizontalement à la zone de l'image avec 8 px de marge ; si elle est plus large que la zone, elle passe sur deux lignes. Le calcul est une fonction pure testée (`bubblePlacement`).
- **Export** : la page exportée est dessinée sur une copie du calque de contenu dans une scène hors écran ; le calque visible n'est jamais déplacé.

## 4. Éditeur : responsive et retours

### 4.1 Paliers de largeur

| Largeur de la fenêtre | Barre du haut |
|---|---|
| ≥ 1 100 px | disposition actuelle |
| 760 – 1 099 px | palette réduite à une pastille de la couleur active (menu de la palette au clic) ; épaisseur, style, remplissage et ombre derrière un bouton « Style » ; bouton principal « Copier et fermer » abrégé en « Terminer » |
| < 760 px | outils en icônes ; tous les réglages derrière « Style » ; Copier, Enregistrer et le bouton principal en icône seule avec info-bulle |

- Aucun libellé ne passe à la ligne (`white-space: nowrap`).
- La page ne défile jamais (`overflow: hidden` sur la racine) ; seule la zone de l'image se déplace et se zoome.
- La barre d'état masque le nombre d'annotations sous 760 px.
- Taille minimale de la fenêtre : 520 × 400 (côté Rust, `min_inner_size`).
- Le palier est une fonction pure testée (`toolbarLayout(width)`).

### 4.2 Retours visuels

- **Copier** : l'icône devient une coche pendant 1,5 s.
- **Enregistrer** : coche pendant 1,5 s ; la barre d'état affiche « Enregistrée : <nom> ».
- **Copier et fermer** : coche visible 400 ms avant la fermeture.
- Message de réussite de la barre d'état : effacé après 4 s. Une erreur reste jusqu'à l'action suivante.
- Export de plus de 300 ms : le bouton montre un indicateur de chargement ; il est désactivé pendant l'export.
- Sous `prefers-reduced-motion`, la coche apparaît sans transition.

## 5. Données

Ajouts à `settings.json`, toujours en version 1, avec valeurs par défaut pour les fichiers existants :

- `capture.mode` : `"region"` | `"window"`, défaut `"region"`.
- `capture.toolbarPosition` : `"top"` | `"bottom"`, défaut `"top"`.

Document de l'éditeur : `highlighter.opacity` (défaut 1) et `pixelate.block` (défaut 16), lus avec ces défauts dans les documents autosauvegardés existants.

## 6. Ce que ce jalon change dans la spec J2

- § 2.3 (raccourcis) : la ligne d'aide est remplacée par le bouton et la touche « ? ».
- Mode Zone : n'aimante plus les fenêtres.
- § 4.2 (outils) : la table des options du § 3.1 remplace la liste d'options de la bulle.
- § 4.3 (rendu) : l'export passe par une scène hors écran.

## 7. Tests

- Automatisés (vitest, cargo) : machine d'états de sélection par mode ; table des options et intersection pour plusieurs éléments ; `bubblePlacement` ; `toolbarLayout` ; motifs de tirets ; minuterie des retours ; nouveaux réglages (défauts, validation, anciens fichiers).
- Manuels : nouvelle série dans `docs/tests-manuels.md` (texte, tirets et points sur chaque élément, bulle aux quatre bords, redimensionnement de l'éditeur aux trois paliers, coche sur les boutons, absence de flash à l'export, deux modes de capture, aide « ? », position de la barre).
