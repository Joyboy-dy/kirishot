# Tests manuels

À refaire avant chaque version, avec l'installeur. Noter le résultat et la date.

## J1 : capture de zone, enregistrement et copie

### Sélection (tâche 11)

1. **Win + Maj + S** fige l'écran sans flash. Le journal (`%APPDATA%\Kirishot\logs`) affiche `overlay revealed in N ms`. **Impr. écran** fait de même.
2. Ni l'outil de capture de Windows ni le menu Démarrer ne s'ouvrent.
3. Survoler une fenêtre met son contour en surbrillance, avec son titre et sa taille. Un clic la capture : une notification « Capture enregistrée et copiée » s'affiche, et le fichier est dans `Images\Kirishot`.
4. Glisser une zone de droite à gauche donne une sélection avec des poignées et sa taille. Les flèches la déplacent de 1 px (Maj : 10 px), et Entrée la capture. La taille de l'image est celle affichée.
5. Coller (Ctrl+V) dans Paint, Word, puis Discord ou Chrome donne une image identique à la zone choisie.
6. Échap annule : rien n'est enregistré, et la capture suivante fonctionne.
7. Maj + Impr. écran capture l'écran entier sous la souris, sans sélection.
8. Deux appuis rapides n'ouvrent qu'une seule sélection.
9. Avec deux écrans : la barre suit la souris, et commencer une sélection sur un écran efface celle de l'autre.
10. Écran à 150 % et écran à 100 % : les captures sont nettes et sans décalage. Refaire après avoir changé l'échelle d'un écran, sans redémarrer Kirishot.

### Zone de notification et fenêtre principale (tâche 12)

11. Au lancement, aucune fenêtre ne s'ouvre. L'icône Kirishot est dans la zone de notification, en clair ou en foncé selon la barre des tâches.
12. Un clic gauche sur l'icône ouvre les réglages. Le menu propose Capturer une zone, Capturer l'écran entier, Réglages et Quitter, et chaque entrée fonctionne.
13. Relancer `kirishot.exe` remet la fenêtre principale au premier plan.

### Réglages › Général (tâche 13)

14. La page affiche « Images › Kirishot », PNG et « Enregistrer et copier ».
15. « Changer… » vers un autre dossier : la capture suivante y arrive, et « Revenir au dossier par défaut » apparaît.
16. JPG donne un fichier `.jpg`.
17. « Copier seulement » ne crée aucun fichier, et Ctrl+V dans Paint colle l'image.
18. Dossier de destination supprimé : Kirishot le recrée et y enregistre la capture. Clé USB débranchée : la capture arrive dans `Images\Kirishot`, avec la notification « Dossier de destination inaccessible ».

### Raccourcis avec une fenêtre de Kirishot au premier plan (J2)

19. Réglages ouverts et actifs : Win + Maj + S puis Impr. écran ouvrent l'écran figé de Kirishot, jamais l'outil de Windows ni le menu Démarrer.
20. Pendant une sélection, un second Win + Maj + S ne fait rien : ni nouvel écran figé, ni outil de Windows.
21. Avec le navigateur ou un autre logiciel au premier plan, Win + Maj + S ouvre bien l'écran figé (un essai automatique du 02/11 n'a rien ouvert, à confirmer).

## J2 : usage quotidien

### Écran de sélection

22. Le curseur est une croix sur l'écran figé, une main sur la barre d'outils, une flèche de déplacement dans une sélection, une double flèche sur chaque poignée.
23. **M** ou le bouton Loupe masque et affiche la loupe ; à la capture suivante, elle garde le dernier état. Près d'un bord, la loupe passe de l'autre côté du curseur.
24. **C** copie la couleur visée : la pastille « #RRGGBB copié » s'affiche, et Ctrl+V la colle dans le Bloc-notes.
25. **R**, **W**, **F** changent de mode. **Espace** maintenu pendant le tracé déplace la zone, **Alt** la trace depuis le centre.
26. **Ctrl+C** sur une zone ajustée la copie sans fichier ni vignette.
27. Chaque bouton de la barre montre une info-bulle avec son raccourci, et Tab les parcourt avec un contour orange.

### Son et flash

28. Le clic de capture est court et doux. Le flash ne couvre que la zone capturée.
29. Son et flash coupés dans les réglages : plus rien. Windows réglé sur « réduire les animations » : pas de flash.

### Vignettes

30. Tape du texte dans le Bloc-notes, fais une capture, survole puis clique les boutons de la vignette : la frappe suivante va toujours dans le Bloc-notes (la vignette ne prend jamais le focus).
31. La vignette apparaît en bas à droite de l'écran de la capture, au-dessus de la barre des tâches, avec « Copiée · enregistrement dans N s ». Ctrl+V colle l'image tout de suite.
32. Le survol met le compte à rebours en pause. À la fin, la capture est enregistrée une seule fois, puis la vignette part.
33. Copier, Enregistrer, Modifier et × fonctionnent ; × ferme sans enregistrer (la capture reste dans le presse-papiers si l'action copie). Enregistrer juste après l'enregistrement automatique ne crée pas de second fichier.
34. Clic droit : Ouvrir le dossier et Copier le chemin après l'enregistrement, Supprimer jette la capture et son fichier.
35. Quatre captures rapides : trois vignettes et « +1 » ; la quatrième entre quand une part. Une capture sur l'autre écran déplace la pile, à la bonne taille même si les deux écrans n'ont pas la même échelle (100 % et 150 %).
36. Glisser une vignette dans Discord, un mail et l'Explorateur dépose le fichier PNG. Pendant le glisser, la zone de notification et les raccourcis répondent.
37. « Afficher la vignette » désactivé : retour au comportement de J1 (action immédiate et notification).

### Éditeur

38. Un clic sur une vignette ouvre l'éditeur, sans enregistrer de fichier, en moins d'une demi-seconde, l'image ajustée à la fenêtre ; « Toujours ouvrir l'éditeur » saute la vignette.
39. Chaque outil (Flèche, Rectangle, Ellipse, Ligne, Crayon, Surligneur, Texte, Étapes, Masquer, Recadrer) dessine, se sélectionne, se déplace, se restyle depuis la barre et s'annule avec Ctrl+Z.
40. La flèche se courbe avec la poignée orange du milieu ; Maj aligne flèches et lignes par pas de 15°.
41. Le surligneur assombrit le texte sans le cacher. Masquer rend un texte illisible.
42. Taper un texte ne déclenche aucun outil ; Échap ou un clic dehors valide ; un double-clic le modifie.
43. Supprimer une étape renumérote les suivantes.
44. Ctrl + molette zoome sous le curseur, Espace + glisser déplace la vue, Ctrl+0 ajuste.
45. Copier, Enregistrer, Enregistrer sous et Copier et fermer produisent l'image en pleine résolution, recadrage compris (essayer une capture 4K avec un surligneur).
46. Fermer l'éditeur puis regarder `%APPDATA%\Kirishot\captures\<id>\` : `original.png` et `document.json` avec les annotations.
47. Navigation au clavier dans la barre de l'éditeur et dans les réglages ; contrastes lisibles en thème clair.

### Réglages › Capture

48. Chaque interrupteur (loupe, son, flash, vignette, toujours ouvrir l'éditeur) et la durée de la vignette sont gardés après un redémarrage. Activer le son joue le clic.
49. Après Win+L ou Ctrl+Alt+Suppr, retour sur la session, éditeur ouvert : Win + Maj + S lance toujours une capture, et Maj+S tapé dans un texte n'en lance pas.

## J2.1 : corrections après tests

### Écran de capture

50. Mode Zone (R) : survoler une fenêtre ne la surligne pas ; un simple clic ne capture rien ; un glisser trace la zone.
51. Mode Fenêtre (W) : la fenêtre survolée est surlignée avec son titre (tronqué s'il est long) ; un clic la capture ; glisser ne trace rien.
52. Le mode choisi est repris à la capture suivante, même après un redémarrage. F ne change pas le mode mémorisé.
53. Le bouton « ? » de la barre et la touche ? affichent la liste des raccourcis ; ? la referme ; Échap la referme sans quitter la capture. Plus aucune ligne d'aide en bas.
54. Réglages › Capture › Position de la barre d'outils : Bas place la barre en bas de l'écran de capture, Haut la remet en haut.
55. Réglages › Capture › « Capturer dès que je relâche la souris » : activé, relâcher la souris capture la zone sans Entrée ; désactivé, Entrée reste nécessaire.

### Éditeur : outils

56. Texte : un clic puis la frappe immédiate écrit dans le champ ; Entrée va à la ligne ; Ctrl+Entrée, Échap ou un clic ailleurs valident ; un clic ailleurs n'ouvre pas un second champ.
57. Texte : un clic sur un texte existant (outil Texte) ou un double-clic (outil Sélection) le modifie ; vider le texte le supprime.
58. Tirets et points sur la flèche (droite et courbée), la ligne, le rectangle et l'ellipse : chaque style se voit nettement, les points sont ronds.
59. Opacité sur chaque élément qui la propose (flèche, ligne, rectangle, ellipse, crayon, surligneur) : le curseur va de 10 à 100 % et l'effet suit.
60. Surligneur : couleur, épaisseur et opacité modifiables, à la création comme après coup.
61. Pixelisation : intensité fine, moyenne et forte visibles à la création et après coup.
62. Une option affichée agit toujours ; une option sans effet sur l'élément n'est jamais affichée (texte : pas de tirets ; étape : pas d'opacité ; pixelisation : seulement l'intensité).
63. Sélection mixte (flèche + surligneur) : seules couleur, épaisseur et opacité sont proposées ; un changement s'annule en un seul Ctrl+Z.
64. Bulle : un élément collé à chacun des quatre bords, puis une sélection qui couvre toute l'image : la bulle reste entière à l'écran ; dans une fenêtre étroite, elle passe sur deux lignes.

### Éditeur : fenêtre et retours

65. Largeur 1 300 px : barre complète. Vers 900 px : pastille de couleur et bouton « Style », bouton principal « Terminer ». Vers 600 px : icônes seules. À 520 px : la barre passe au plus sur deux lignes. Jamais de barre de défilement ni de libellé coupé sur deux lignes.
66. La fenêtre ne descend pas sous 520 × 400. La barre d'état masque le nombre d'annotations quand la fenêtre est étroite.
67. Copier : l'icône devient une coche environ 1,5 s ; la barre d'état affiche « Copiée… » puis s'efface après 4 s.
68. Enregistrer : coche sur le bouton, « Enregistrée : <nom> » dans la barre d'état, effacé après 4 s. Une erreur reste affichée jusqu'à l'action suivante.
69. Copier et fermer : la coche se voit brièvement, puis la fenêtre se ferme.
70. Aucun flash ni saut de l'image au clic sur Copier ou Enregistrer, y compris zoomé et après un recadrage ; l'image exportée garde la pleine résolution du recadrage.
71. Fenêtre de l'éditeur sous 1 100 px : ouvrir « Style » ou la pastille de couleur, puis Échap : seul le menu se ferme, l'éditeur et la capture restent.
72. Liste des raccourcis ouverte en mode Fenêtre : un clic à côté la ferme sans capturer de fenêtre.
73. Éditeur à 1 200 px avec l'outil Rectangle : la barre complète ne déborde pas sur les outils ni sur les boutons (sinon elle passe en version compacte).
74. Curseur d'opacité glissé de 100 à 30 % sur une sélection : un seul Ctrl+Z revient à 100 %. Une flèche ou un rectangle rempli à 50 % s'éclaircit d'un bloc, sans contour plus foncé ni recouvrement visible.
