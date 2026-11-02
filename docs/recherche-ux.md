# Recherche : références UX et code open source

Synthèse des recherches du 02/11/2026 qui fondent le jalon J2 (`docs/superpowers/specs/2026-11-02-kirishot-usage-quotidien-design.md`). Les valeurs marquées « usage courant » viennent de la pratique de ces applications, pas d'une page citée : ce sont des points de départ à régler.

## Applications de référence

| Application | Ce qu'on retient | Source |
|---|---|---|
| CleanShot X | Vignette après capture (position et taille réglables, fermeture automatique, empilement, glisser, raccourcis), loupe et réticule désactivables, flèches courbes, objets avec ombre, compteur, pixelisation sécurisée, fond « embellir », son choisi ou coupé. | https://cleanshot.com/features, https://cleanshot.com/changelog |
| Shottr | Rapidité (image affichée en ~165 ms), flèches courbables, effacement de texte seul, raccourcis de sélection (`[` `]`, `A`), couleur copiée avec Tab. | https://shottr.cc/ |
| macOS | Vignette en bas à droite : clic pour annoter, glisser vers une application, balayage pour ranger. Espace bascule en capture de fenêtre. | https://support.apple.com/guide/mac-help/take-a-screenshot-mh26782/mac |
| Snagit | Styles rapides enregistrés et favoris. | https://www.techsmith.com/learn/tutorials/snagit/quick-styles-and-favorites/ |
| tldraw | Un choix de style s'applique à la sélection et aux prochaines formes ; tailles s/m/l/xl. | https://tldraw.dev/sdk-features/styles |
| ShareX | Raccourcis à une lettre par outil, loupe de 15×15 pixels, détection des contrôles d'interface. | https://getsharex.com/docs/region-capture |
| Flameshot | Raccourcis de dessin, épaisseur à la molette. | https://flameshot.org/docs/guide/key-bindings/ |
| Snipaste | Détection automatique des éléments d'interface, C copie la couleur, mosaïque et flou. | https://www.snipaste.com/ |
| Xnapper | Masquage automatique des données sensibles, fond déduit de l'image. | https://xnapper.com/ |

### À éviter (aspect daté)

Barre d'outils grise collée à la sélection, flèches d'1 px à petite pointe, texte Arial sans contour, grille de 16 couleurs, boîte « Enregistrer sous » juste après la capture, notifications de la zone de notification à la place d'une vignette, verre dépoli derrière le texte, flou faible réversible, son d'appareil photo et flash plein écran, annotations fondues dans les pixels.

## Code open source

| Projet | Licence | Ce qu'on en tire |
|---|---|---|
| XenSnip — https://github.com/BiViPi/xensnip | MIT | Même pile (Tauri 2, React 19, react-konva). Chaque outil a un nœud Konva et un rendu canvas pur pour l'export (`src/annotate/objects`, `src/annotate/renderers`), pixelisation et flou sur canvas hors écran, éditeur de texte en `<textarea>` superposé, tests de fidélité de l'export. **Adaptable, avec attribution.** |
| Excalidraw — https://github.com/excalidraw/excalidraw | MIT | Saisie de texte sur place (`wysiwyg/textWysiwyg.tsx`), poignée centrale pour courber une ligne. |
| perfect-freehand — https://github.com/steveruizok/perfect-freehand | MIT | Lissage du crayon (~2 Ko). |
| Konva / react-konva — https://konvajs.org | MIT | Moteur de dessin. Conseils : 5 calques au plus, `listening(false)` sur le fond, un seul `Transformer`, `hitStrokeWidth` pour les traits fins. Les modes de fusion ne mélangent qu'à l'intérieur d'un calque. |
| tauri-plugin-drag — https://github.com/crabnebula-dev/drag-rs | Apache-2.0 / MIT | Glisser d'un fichier vers une autre application. Problème ouvert #94 (`DoDragDrop` qui ne rend pas la main), correctif proposé en #95. |
| shot — https://github.com/webadderall/shot | MIT | Idées pour le cadre « embellir ». |
| ShareX, Flameshot, Greenshot, Snow Shot (branche actuelle) | GPL-3.0 | **Idées seulement, aucun code.** Surligneur en mode « assombrir », loupe en grille, pastilles numérotées, flou ré-éditable. |
| kImageAnnotator | LGPL-3.0 | Idées seulement. |
| tldraw | Licence propre (clé en production) | Idées seulement. |
| SnapInk | Sans licence | Rien à reprendre. |

## Points techniques Tauri

- Fenêtre jamais active : `focusable(false)` (Tauri 2, `WS_EX_NOACTIVATE`), affichage avec `SW_SHOWNOACTIVATE`, et `MA_NOACTIVATE` en réponse à `WM_MOUSEACTIVATE`, parce qu'un clic dans WebView2 peut activer la fenêtre parente. tao 0.37.1 a changé `set_visible(true)` pour donner le focus : à vérifier.
- Son : `PlaySoundW` depuis la mémoire, asynchrone, sans dépendance. Un `<audio>` dans la fenêtre de sélection serait coupé à sa fermeture, et `rodio` coûte une initialisation WASAPI.
- Chaque WebView2 coûte 30 à 60 Mo et 100 à 300 ms au démarrage : créer les fenêtres cachées et les réutiliser.
- Limites du canvas Chromium : 16 384 px de côté, environ 268 mégapixels.
