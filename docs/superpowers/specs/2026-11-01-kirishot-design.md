# Kirishot : spécification de la v1

- **Date** : 1er novembre 2026
- **Statut** : à relire par l'auteur du projet
- **Maquettes** : [canevas Claude Design « Kirishot — maquettes »](https://claude.ai/artifact/RtjwB565rdkBTQMRosrGrb) (lien privé, dix écrans)

Kirishot est un outil de capture d'écran pour Windows, construit avec Tauri. Il remplace l'Outil Capture d'écran de Windows 11 par une expérience proche de macOS : écran figé pour sélectionner, vignette flottante après la capture, éditeur d'annotations complet, copie directe dans le presse-papiers.

---

## 1. Le besoin

### Ce qui a été demandé

- L'Outil Capture d'écran de Windows « ne fait pas le taf » : il est limité et a des bugs.
- On veut une application de capture **propre et moderne**, dans l'esprit de macOS.
- Dans les réglages, on choisit le **dossier où vont les captures**.
- Après une capture, on peut, si on le souhaite, **l'éditer avant de l'enregistrer** : annotations, flèches, dessin à main levée.
- On peut **copier l'image sans l'enregistrer** sur le disque.
- Le framework est **Tauri**.
- Le nom et les interfaces sont décidés ensemble, et les écrans sont maquettés avec Claude Design **avant toute implémentation**.

Réponses données pendant la conception :

| Question | Réponse |
|---|---|
| Pour qui ? | Open source, partagé : dépôt GitHub public et installeur téléchargeable. |
| Après une capture ? | Une vignette flottante, comme sur macOS. |
| Outils de l'éditeur ? | « Tout ce qui aide et est utile pour travailler et noter, tout ce qu'on retrouve dans les applications de capture modernes », en particulier : flou et pixelisation, surligneur, étapes numérotées, loupe. |
| Extras de capture en v1 ? | Retardateur, OCR (copier le texte), épingler à l'écran. La vidéo et le GIF attendent la v2. |
| Nom ? | **Kirishot**. |
| Approche technique ? | **A** : capture en Rust, écran figé affiché dans une webview. |
| Base visuelle ? | Une identité propre à Kirishot. |

### Hypothèses (pas dites explicitement, à corriger si besoin)

- **Plateforme** : Windows 11 x64. Windows 10 n'est pas bloqué, mais il n'est pas testé en v1. Ni macOS, ni Linux, ni ARM64.
- **Langues de l'interface** : français et anglais. Par défaut, Kirishot suit la langue d'affichage de Windows.
- **Langue du dépôt** : le code (identifiants) et le README principal sont en anglais, pour un public international. Le README a une version française, et la documentation de conception est en français.
- **Couleur d'accent** : le vermillon `#FF5B38` est la couleur de la marque. Les autres accents des maquettes (bleu, violet, sarcelle) étaient des pistes d'exploration : la v1 n'a **pas** de choix d'accent.
- **Police** : Geist et Geist Mono (licence OFL), embarquées dans l'application via `@fontsource`. Aucune police n'est chargée depuis Internet.
- **Wordmark** : « kirishot », en minuscules.
- **Vie privée** : aucune télémétrie. La seule connexion réseau est la vérification des mises à jour, qui se désactive.
- **Validation de la sélection** : après le glisser, la sélection reste ajustable (poignées, flèches du clavier) et se valide avec Entrée ou un double-clic, comme dans la maquette. Une option « Capturer dès le relâchement » donne le comportement de macOS. **Elle est désactivée par défaut. Ce point est à confirmer.**

### Critères de réussite

1. Après un appui sur Impr. écran, l'écran figé s'affiche en **moins de 150 ms** sur la machine de développement (mesure du spike, § 9).
2. Une capture copiée se colle correctement dans Discord, Word, Paint et un navigateur basé sur Chromium.
3. Aucune capture n'est perdue : même une capture seulement copiée reste dans l'historique pendant 30 jours (durée réglable).
4. Les quatorze outils de l'éditeur fonctionnent, avec annuler et rétablir. L'image exportée est à la résolution native de la capture.
5. Plusieurs écrans avec des échelles différentes (par exemple 100 % et 150 %) donnent des captures nettes, sans décalage.
6. L'application s'installe avec un installeur sans droits administrateur et se met à jour toute seule.
7. Au repos, Kirishot n'utilise quasiment pas le processeur et reste sous 150 Mo de mémoire (à mesurer pendant le spike).

---

## 2. Identité visuelle

Les détails sont sur le plan de travail « Identité Kirishot » du canevas.

- **Nom** : de *kiri* (切り, « couper », comme dans *kiritori*, « découper ») et de *shot*.
- **Logo** : les quatre coins d'un viseur, traversés par un trait de coupe en diagonale de couleur vermillon. Le dessin maître est un SVG 24×24, d'où sont tirées les icônes de l'application (`tauri icon`) et une version monochrome pour la zone de notification.
- **Jetons de couleur** (thème sombre, puis thème clair) :

| Jeton | Sombre | Clair |
|---|---|---|
| `--k-bg` | `#0E1014` | `#F4F5F7` |
| `--k-surface` | `#161920` | `#FFFFFF` |
| `--k-surface-2` | `#1E222B` | `#EEF0F3` |
| `--k-surface-3` | `#272C37` | `#E4E7EC` |
| `--k-border` | `#2C313C` | `#DADDE3` |
| `--k-text` | `#ECEEF2` | `#14161B` |
| `--k-text-2` | `#A3A9B6` | `#4A5060` |
| `--k-text-3` | `#8A91A0` | `#5F6676` |
| `--k-accent` | `#FF5B38` | `#FF5B38` |
| `--k-ink` (texte posé sur l'accent) | `#1A0B06` | `#1A0B06` |

- **Palette des annotations** : `#FF5B38`, `#FFC53D`, `#2BB673`, `#3D7BFF`, `#9B6BFF`, `#FFFFFF`, `#111318`, plus une couleur personnalisée.
- **Thème** : l'option « Comme Windows » est sélectionnée par défaut, avec le choix Sombre ou Clair. L'écran de sélection, les vignettes, le compte à rebours et les épingles restent toujours sombres, parce qu'ils s'affichent par-dessus n'importe quel contenu.
- **Icônes** : un trait de 1,8 à 2 px, dans le style Lucide, intégrées en SVG.

---

## 3. Parcours et écrans

Kirishot vit dans la **zone de notification**.
- Un clic gauche sur l'icône ouvre la fenêtre principale (Historique).
- Un clic droit ouvre un menu : Capturer une zone · Capturer l'écran entier · Capturer du texte · Capture avec retardateur (3 s) · Historique · Réglages · Quitter. La durée affichée est celle réglée dans Réglages › Capture.
- Une seule instance tourne à la fois. Relancer l'application ouvre la fenêtre principale.

### 3.1 Raccourcis globaux

Tous les raccourcis se modifient dans Réglages › Raccourcis.

| Action | Par défaut |
|---|---|
| Capturer une zone | `Impr. écran` |
| Capturer l'écran entier (celui sous la souris) | `Maj + Impr. écran` |
| Capturer du texte (OCR) | `Ctrl + Impr. écran` |
| Refaire la dernière zone | aucun |
| Ouvrir l'historique | aucun |

**Prendre la touche Impr. écran.** Sous Windows 11, la touche Impr. écran ouvre l'Outil Capture d'écran. Ce comportement dépend de la valeur `HKCU\Control Panel\Keyboard\PrintScreenKeyForSnippingEnabled`, au niveau de l'utilisateur, donc sans droits administrateur.
- Au premier lancement, Kirishot détecte ce réglage et propose de le désactiver.
- Il retient qu'il l'a changé (`printScreen.releasedByKirishot`).
- Le réglage peut être rétabli à tout moment depuis Réglages › Raccourcis.
- La désinstallation le rétablit si c'est Kirishot qui l'avait changé.

### 3.2 Sélection (plan de travail « Sélection de zone »)

Au raccourci, tous les écrans sont capturés en même temps. Une fenêtre de sélection plein écran s'affiche ensuite sur chaque écran, avec l'image figée assombrie.

- **Zone** (mode par défaut) :
  - glisser dessine un rectangle ;
  - survoler une fenêtre la met en surbrillance, et un simple clic la capture entière ;
  - Maj force un carré.
- **Après le glisser**, la sélection reste modifiable :
  - huit poignées permettent de la redimensionner ;
  - les flèches la déplacent de 1 px, Maj + flèches de 10 px ;
  - Entrée ou un double-clic à l'intérieur valide ;
  - Échap annule toute la capture.
- **Avec l'option « Capturer dès le relâchement »**, la capture part au relâchement de la souris, sans étape d'ajustement.
- Une sélection plus petite que 4×4 px compte comme un clic.
- **Pendant la sélection**, on voit :
  - un réticule ;
  - une pastille avec la taille de la sélection en pixels physiques (`604 × 280`) ;
  - une loupe ronde qui suit le curseur. Elle montre 11×11 pixels agrandis avec une grille, la position et la couleur hexadécimale du pixel visé (`928, 546 · CFD4DC`).
- **La barre d'outils en haut** apparaît uniquement sur l'écran où se trouve la souris. Elle contient :
  - Zone · Fenêtre (seulement les fenêtres, sans glisser) · Plein écran (l'écran où l'on clique) · Texte (passe en mode OCR) ;
  - Retardateur, avec un menu Désactivé / 3 s / 5 s / 10 s ;
  - Annuler.
- Une aide clavier s'affiche en bas.
- **Détection des fenêtres** : la liste des fenêtres visibles et leurs contours sont relevés au moment même de la capture. Le contour utilisé est celui affiché par DWM, sans l'ombre. Les fenêtres cachées par DWM, réduites, les fenêtres d'outils et celles de Kirishot sont ignorées. C'est la fenêtre la plus haute sous le curseur qui gagne.
- **Capture d'une fenêtre** : en v1, on découpe l'image figée selon le contour de la fenêtre. Si une autre fenêtre en recouvre une partie, elle apparaît sur la capture. C'est un choix assumé : il reste cohérent avec l'écran figé, et la capture d'une fenêtre isolée est hors v1.
- **Une sélection reste sur un seul écran.**

### 3.3 Vignette flottante (plan de travail « Vignettes flottantes »)

Après une capture de zone, de fenêtre ou d'écran, une vignette apparaît en bas à droite de l'écran où la capture a été faite.

- **Durée d'affichage** : 3, 5 ou 10 s (5 s par défaut). Une barre de progression la montre, et le compte à rebours se met en pause quand la souris survole la vignette.
- **Action automatique** à la fin du compte à rebours, si on n'a pas touché à la vignette : Enregistrer et copier (par défaut), Copier seulement, ou Enregistrer seulement. Le pied de la vignette l'annonce, par exemple « Enregistrée et copiée dans 3 s ».
- **Au survol** apparaissent les boutons Copier, Enregistrer (en accent), Éditer, Épingler et Fermer. Utiliser l'un de ces boutons annule l'action automatique : c'est l'action choisie qui s'applique. Fermer jette la capture, qui reste quand même dans l'historique.
- **Un clic** sur la vignette ouvre l'éditeur et annule l'action automatique.
- **Glisser la vignette** dépose un fichier PNG dans une autre application (Discord, un mail, l'Explorateur). Le fichier est écrit au préalable dans `%TEMP%\Kirishot\`.
- **Empilement** : jusqu'à trois vignettes visibles, la plus récente en haut. Chacune a son propre compte à rebours.
- La vignette **ne prend jamais le focus** et n'apparaît pas dans la barre des tâches.
- **Option « Toujours ouvrir l'éditeur »** : la vignette est sautée et l'éditeur s'ouvre directement.

### 3.4 Retardateur (plan de travail « Retardateur »)

On le lance depuis le menu de la barre de sélection ou depuis le menu de la zone de notification.

1. Kirishot ferme la sélection en cours, s'il y en a une.
2. Une pastille de compte à rebours s'affiche en haut de l'écran sous la souris, avec un anneau, le chiffre, « Capture de la zone dans 3 s » et la mention « Ouvrez votre menu, puis attendez · Échap annule ».
3. La pastille **ne prend pas le focus**, pour qu'un menu ouvert ne se ferme pas. Échap passe par un raccourci global, enregistré uniquement pendant le compte à rebours.
4. À zéro, la pastille est masquée, Kirishot attend une image affichée pour être sûr qu'elle a disparu, puis capture les écrans et affiche la sélection habituelle.

Le choix du retardateur n'est pas mémorisé : chaque nouvelle sélection démarre sur « Désactivé ». La durée proposée par le menu de la zone de notification se règle dans Réglages › Capture (3 s par défaut).

### 3.5 Capture de texte (plan de travail « Capture de texte (OCR) »)

Le raccourci OCR, ou le bouton Texte de la barre, ouvre la sélection en mode Texte.

- Pendant le glisser, Kirishot lance l'OCR sur la zone en cours, au plus une fois toutes les 150 ms. Seul le dernier résultat compte. Les lignes reconnues sont surlignées, et une pastille indique « 3 lignes détectées ».
- Au relâchement, un OCR définitif est lancé sur la zone, puis le texte est copié, avec les lignes séparées par des retours à la ligne.
- Une carte de confirmation apparaît dans la pile des vignettes pendant 3 s. Elle affiche « Texte copié », un aperçu, puis « 3 lignes · français · reconnu hors ligne ».
- L'OCR utilise `Windows.Media.Ocr` (hors ligne), avec les langues installées dans le profil Windows. Les petites zones sont agrandies ×2 avant la reconnaissance, pour améliorer la précision.
- Une capture de texte n'est pas enregistrée dans l'historique des images.

### 3.6 Éditeur (plan de travail « Éditeur »)

L'éditeur est une fenêtre normale, redimensionnable. Son titre est « Capture du 01/11/2026 à 14:32 ».

**Barre d'outils**, avec un raccourci d'une lettre par outil :

| Outil | Touche | Comportement |
|---|---|---|
| Sélection | V | Sélectionner, déplacer, redimensionner ou supprimer une annotation. |
| Recadrer | C | Recadrage non destructif, gardé dans le document. |
| Flèche | A | Droite, courbe (point de contrôle) ou double. Trait plein, en tirets ou en points. Ombre portée optionnelle. |
| Ligne | L | Mêmes styles de trait que la flèche. |
| Rectangle | R | Contour, ou remplissage semi-transparent ou plein. Coins arrondis réglables. |
| Ellipse | O | Mêmes options que le rectangle, sauf les coins. |
| Crayon | P | Tracé à main levée, lissé. |
| Surligneur | H | Trait large semi-transparent, en mode multiplier. Maj trace une ligne droite. |
| Texte | T | Clic pour placer, édition sur place. Choix de la police (Geist ou Geist Mono), de la taille, de la couleur, et fond optionnel. |
| Étapes | N | Pastilles numérotées 1, 2, 3… Les numéros se recalculent quand une pastille est supprimée. |
| Flouter | B | Pixelisation (par défaut, blocs de 12 px) ou flou gaussien, avec un réglage d'intensité. |
| Projecteur | S | Assombrit toute l'image sauf les zones dessinées, rectangulaires ou elliptiques. Plusieurs zones partagent un même niveau d'assombrissement. |
| Loupe | M | Cercle qui agrandit ce qui se trouve dessous (×1,5 à ×4, ×2 par défaut), avec une bordure. |
| Pipette | I | Prend une couleur de l'image et en fait la couleur courante. |

- **Panneau de propriétés** (à droite, 288 px) : il affiche les réglages de l'outil ou de l'annotation sélectionnée (couleur, épaisseur, opacité, style de trait, forme, ombre), plus Premier plan / Arrière-plan et Supprimer.
- **Panneau Embellir** : un interrupteur dans la barre l'active. On y règle le fond (huit choix, dont des dégradés), la marge (48 px par défaut), les coins arrondis (12 px), l'ombre (aucune, légère, moyenne ou forte) et le format (Auto, 16:9, 1:1 ou 4:5). Quand Embellir est actif, l'image exportée contient ce cadre.
- **Actions** : Annuler (`Ctrl+Z`), Rétablir (`Ctrl+Y` ou `Ctrl+Maj+Z`), Épingler, Enregistrer sous (`Ctrl+Maj+S`), Copier (`Ctrl+C`), Enregistrer (`Ctrl+S`, bouton principal).
  - `Ctrl+C` copie toujours l'image finale, sauf pendant l'édition d'un texte, où il copie le texte sélectionné.
  - `Ctrl+D` duplique l'annotation sélectionnée, et `Suppr` la supprime.
- **Barre d'état** : dimensions, format, nombre d'annotations, et zoom (−, valeur, +, Ajuster). La molette avec Ctrl zoome, et l'espace avec un glisser déplace la vue.
- **Pas de boîte « Enregistrer les modifications ? »** : le document est sauvegardé dans l'historique au fil de l'eau (une seconde après la dernière modification). Fermer l'éditeur ne fait donc rien perdre.

### 3.7 Épingle (plan de travail « Capture épinglée »)

On épingle depuis la vignette, l'éditeur ou l'historique.

- La fenêtre est sans bordure, toujours au premier plan, et n'apparaît pas dans la barre des tâches.
- À l'ouverture, elle affiche la capture à 100 % (en pixels logiques), dans la limite de la moitié de l'écran.
- On la déplace en la glissant et on la zoome à la molette, de 25 % à 400 %.
- Une barre apparaît au survol : zoom, curseur d'opacité (de 20 à 100 %), Copier, Éditer, Fermer.
- Un double-clic l'ouvre dans l'éditeur, Échap la ferme.
- Les épingles ne survivent pas à un redémarrage de Kirishot en v1.

### 3.8 Historique (plan de travail « Historique »)

Il est dans la fenêtre principale, avec une barre latérale Historique / Réglages, un bouton « Nouvelle capture » et la version de l'application.

- **Une grille groupée par jour** (Aujourd'hui, Hier, puis la date). Chaque carte affiche une miniature et un badge « Enregistrée » ou « Copiée ».
- **Au survol** : Copier, Éditer, Épingler, Afficher dans l'Explorateur (seulement si la capture a été enregistrée), Supprimer.
- **Recherche** sur le nom du fichier, le titre de la fenêtre source et la date. Le texte contenu dans les images n'est pas recherché en v1.
- **Filtres** : Tout · Enregistrées · Copiées seulement · Annotées.
- **Pied de page** : « 62 captures · 148 Mo · conservées 30 jours » et « Vider l'historique… », avec une confirmation.
- « Éditer » rouvre le document d'origine, avec des annotations encore modifiables.

### 3.9 Réglages (plan de travail « Réglages »)

Les onglets sont Général, Raccourcis, Capture, Historique et À propos.

- **Général**
  - Dossier de destination (par défaut `Images\Kirishot`), avec les boutons Ouvrir et Changer….
  - Format : PNG (par défaut), JPG (qualité 90) ou WebP (sans perte).
  - Modèle de nom, avec un aperçu en direct (voir § 7.3).
  - Action automatique après une capture.
  - Durée de la vignette.
  - Toujours ouvrir l'éditeur.
  - Lancer Kirishot au démarrage de Windows.
  - Langue (Comme Windows, Français, English) et thème (Comme Windows, Sombre, Clair).
- **Raccourcis**
  - Si Impr. écran ouvre encore l'outil de Windows, un bandeau d'alerte s'affiche avec le bouton « Libérer la touche ».
  - Une ligne par action. On clique sur la ligne puis on appuie sur la nouvelle combinaison, et Échap annule.
  - Une combinaison déjà prise s'affiche en rouge avec « Déjà utilisé par une autre application ».
- **Capture**
  - Inclure le curseur (désactivé par défaut).
  - Son de capture (désactivé par défaut).
  - Durée du retardateur proposée dans la zone de notification.
  - Capturer dès le relâchement (désactivé par défaut).
- **Historique** : durée de conservation (7, 30 ou 90 jours, ou illimitée ; 30 par défaut), emplacement, et Vider.
- **À propos** : version, vérification automatique des mises à jour (activée par défaut), bouton « Rechercher une mise à jour », liens vers le dépôt et les journaux.

### 3.10 Premier lancement (plan de travail « Premier lancement »)

Une boîte de dialogue en trois étapes :

1. **Raccourci** : « Impr. écran → Capture de zone », avec l'explication sur l'outil de Windows. Les choix sont « Utiliser Impr. écran » (libère la touche) ou « Choisir un autre raccourci ».
2. **Destination et action** : le dossier (`Images\Kirishot`, modifiable) et l'action automatique.
3. **Prêt** : « Lancer Kirishot au démarrage de Windows » (coché par défaut), puis l'invitation « Essayez : appuyez sur Impr. écran ».

---

## 4. Architecture

### 4.1 Stack

Tauri 2, React 19, TypeScript, Vite, Tailwind 4 et shadcn/ui, avec pnpm, comme dans le projet `my-tauri-app`.
- L'éditeur est dessiné avec **react-konva**.
- Les commandes Rust sont typées en TypeScript par **tauri-specta**.
- Le projet est sous licence **MIT**.

**Plugins Tauri** :
- `tray-icon` (dans le cœur de Tauri) ;
- `single-instance` ;
- `autostart` ;
- `global-shortcut` ;
- `updater` ;
- `notification` (erreurs et alertes) ;
- `dialog` (choix du dossier, Enregistrer sous) ;
- `log` ;
- `opener` (afficher dans l'Explorateur) ;
- `tauri-plugin-drag` de CrabNebula (glisser une vignette vers une autre application).

### 4.2 Côté Rust (`src-tauri/src/`)

Il y a un module par responsabilité. Chaque module expose une petite interface et se teste seul.

| Module | Rôle | Dépend de |
|---|---|---|
| `capture` | Capture de tous les écrans en parallèle (crate `xcap`), avec la position, la taille physique et l'échelle de chacun. Relevé des fenêtres visibles et de leurs contours (crate `windows` : `EnumWindows`, `DwmGetWindowAttribute`). Dessin du curseur en option. | `store` |
| `store` | Les captures en mémoire, chacune avec un identifiant, une image par écran, la liste des fenêtres et l'heure. Sert les pixels aux webviews via le protocole `kirishot`. Libère la mémoire selon les règles du § 6. | aucun |
| `output` | Découpe, encodage (PNG, JPG ou WebP), modèle de nom, écriture du fichier (avec repli), presse-papiers, fichier temporaire pour le glisser. | `settings` |
| `ocr` | Reconnaissance avec `Windows.Media.Ocr` sur une région, qui renvoie des lignes avec leurs contours et la langue utilisée. | aucun |
| `hotkeys` | Enregistrement des raccourcis globaux, détection des conflits, raccourci Échap temporaire. | `settings` |
| `printscreen` | Lecture et écriture de `PrintScreenKeyForSnippingEnabled`. | aucun |
| `history` | Rangement, index, miniatures, recherche, nettoyage selon la durée de conservation. | `output` |
| `settings` | Lecture, écriture atomique, réparation et migration des réglages (serde), et événement `settings-changed`. | `paths` |
| `windowing` | Création, placement et affichage des fenêtres (sélection, vignettes, compte à rebours, éditeur, épingles, principale). Recrée les fenêtres de sélection quand les écrans changent. | `capture` |
| `flow` | L'orchestration : raccourci → capture → sélection → vignette → action automatique. C'est le seul module qui enchaîne les autres. | tous |
| `commands` | Les commandes exposées au front, déclarées pour tauri-specta. | `flow` et les autres modules |
| `tray` | L'icône et le menu de la zone de notification. | `flow` |

### 4.3 Côté React (`src/`)

Il y a un point d'entrée par type de fenêtre, dans `src/windows/<type>/`. Le code commun est dans `src/ui/` (composants shadcn et jetons) et `src/lib/`.

| Fenêtre | Création | Rôle |
|---|---|---|
| `overlay` | Une par écran, **créée cachée au démarrage**, puis réaffichée à chaque capture. | La sélection (§ 3.2) et le mode Texte (§ 3.5). Elle ne renvoie qu'un rectangle ou une fenêtre, jamais d'image. |
| `thumbnail` | Une seule, créée cachée au démarrage, sans focus et absente de la barre des tâches. | La pile des vignettes et les cartes OCR. |
| `countdown` | À la demande, sans focus. | La pastille du retardateur. |
| `editor` | Une par capture éditée. | L'éditeur (§ 3.6). |
| `pin` | Une par épingle. | L'épingle (§ 3.7). |
| `main` | Une seule, à la demande. | L'historique, les réglages et le premier lancement. |

- **`src/lib/ipc.ts`** : les commandes et les événements générés par tauri-specta. Aucun appel `invoke` n'est écrit à la main.
- **`src/lib/geometry.ts`** : les conversions entre pixels CSS, pixels physiques de l'écran et pixels de l'image. Ce sont des fonctions pures, testées.
- **`src/editor/document.ts`** : le modèle du document (§ 7.2) et son historique pour annuler et rétablir. C'est du TypeScript pur, sans React ni Konva.
- **`src/editor/tools/<outil>.ts`** : **un fichier par outil**, tous avec la même interface :
  ```ts
  interface Tool<A extends Annotation> {
    id: A['tool'];
    shortcut: string;               // « A », « R »…
    defaults: () => ToolProps<A>;
    create(start: Point, props: ToolProps<A>): A;
    update(annotation: A, pointer: Point, mods: Modifiers): A;
    render(annotation: A, ctx: RenderContext): KonvaNodeConfig[];
  }
  ```
  Ajouter un outil revient à ajouter un fichier et à l'inscrire dans `tools/index.ts`.
- **`src/i18n/`** : les fichiers `fr.json` et `en.json`.

### 4.4 Principes

1. **Une capture sans éditeur reste entièrement en Rust.** La fenêtre de sélection renvoie un rectangle. Rust découpe, encode, enregistre ou copie. C'est le chemin le plus court.
2. **L'éditeur exporte l'image finale** en pleine résolution, sous forme de PNG produit par Konva. Il l'envoie à Rust en binaire brut (`tauri::ipc::Request`, sans JSON), et Rust fait le reste : encodage au format choisi, nom, presse-papiers.
3. **La fenêtre de sélection est remplaçable.** Elle ne communique avec Rust que par `overlay_session` et `overlay_commit` ou `overlay_cancel`. Si le spike échoue (§ 9), on la remplace par une fenêtre native Win32 sans toucher au reste.
4. **Les droits de chaque fenêtre sont limités** grâce aux capabilities de Tauri 2 : chaque type de fenêtre n'accède qu'aux commandes dont il a besoin. La CSP est stricte, sans ressource distante.

### 4.5 Interface entre Rust et le front

Ce sont les commandes principales. Leurs signatures exactes sont fixées dans le plan d'implémentation.

- **Sélection** :
  - `overlay_session(monitor_id) → { capture_id, monitor, windows[], mode }` ;
  - `overlay_commit({ capture_id, monitor_id, target: Rect | WindowId | FullMonitor })` ;
  - `overlay_cancel()` ;
  - `overlay_ocr_preview(capture_id, monitor_id, rect) → OcrLines`.
- **Capture** : `copy_capture(id)`, `save_capture(id, path?)`, `pin_capture(id)`, `open_editor(id)`, `start_drag(id)`.
- **Éditeur** : `editor_load(id) → { document?, image_url }`, `editor_save_document(id, document)`, `editor_export(id, png_bytes, action: Copy | Save | SaveAs(path) | Pin)`.
- **Historique** : `history_list(query, filter, cursor)`, `history_delete(id)`, `history_clear()`, `reveal_in_explorer(id)`.
- **Réglages** : `settings_get()`, `settings_update(patch)`, `hotkey_set(action, accelerator) → Ok | Conflict`, `printscreen_status()`, `printscreen_release()`, `printscreen_restore()`.
- **Événements** de Rust vers le front : `capture-ready` (vers les fenêtres de sélection), `thumbnail-push`, `thumbnail-update`, `settings-changed`, `history-changed`.

**Accès aux pixels** : les images figées passent par le protocole `kirishot`. Sous Windows, WebView2 l'expose à l'adresse `http://kirishot.localhost/capture/<id>/<écran>`.
- La réponse contient les **pixels RGBA bruts**, avec la largeur et la hauteur dans les en-têtes.
- Le front les dessine directement sur un canvas, sans encoder ni décoder de PNG.
- Les miniatures de l'historique et les images de l'éditeur passent par le même protocole (`/history/<id>/thumb`, `/history/<id>/original`).

---

## 5. Flux de données

### 5.1 Capture de zone, sans éditeur

1. Le raccourci déclenche `flow::start(Mode::Region)`. L'heure `t0` est notée.
2. `capture` capture tous les écrans en parallèle et relève la liste des fenêtres. `store` crée la capture.
3. Rust vérifie que les fenêtres de sélection correspondent toujours aux écrans, et les recrée sinon. Il émet ensuite `capture-ready` vers chaque fenêtre de sélection.
4. Chaque fenêtre de sélection récupère ses pixels, les dessine, puis répond « prête ». Rust l'affiche alors au premier plan, à la position et à la taille physiques de son écran. L'heure `t1` est notée, et `t1 − t0` est la latence mesurée.
5. L'utilisateur valide : `overlay_commit` envoie le rectangle, converti en pixels physiques de l'écran (§ 7.4). Toutes les fenêtres de sélection se cachent.
6. `output` découpe la capture. `history` enregistre l'original et une miniature.
7. `thumbnail-push` affiche la vignette. Si on n'y touche pas, l'action automatique s'applique à la fin du compte à rebours : `output` encode au format choisi, enregistre et/ou copie, puis `history` est mis à jour (badge « Enregistrée » ou « Copiée »).

### 5.2 Avec l'éditeur

1. Un clic sur la vignette appelle `open_editor(id)`, ce qui annule l'action automatique.
2. L'éditeur charge l'image (et le document existant s'il vient de l'historique), puis travaille dans les coordonnées de l'image.
3. Chaque modification met à jour le document. Une seconde après la dernière, `editor_save_document` l'écrit dans l'historique.
4. Copier, Enregistrer, Enregistrer sous et Épingler appellent tous `editor_export`. Konva produit un PNG à la résolution native (recadrage et cadre Embellir compris), et Rust l'encode, le nomme, l'enregistre ou le copie. L'image finale remplace `final.png` dans l'historique.

### 5.3 Capture plein écran et dernière zone

- **Écran entier** : Rust capture l'écran sous la souris et passe directement à l'étape 6 du § 5.1, sans fenêtre de sélection.
- **Refaire la dernière zone** : même chose, avec le dernier rectangle validé, sur le même écran. Si cet écran n'existe plus, Kirishot ouvre la sélection normale.

### 5.4 OCR

Les étapes 1 à 4 du § 5.1 se déroulent en mode Texte. Pendant le glisser, `overlay_ocr_preview` est limité à un appel toutes les 150 ms. Au relâchement, Rust lance l'OCR définitif, copie le texte dans le presse-papiers et pousse une carte OCR dans la pile des vignettes. La capture est ensuite libérée.

### 5.5 Presse-papiers

Une copie écrit toujours **deux formats**, quel que soit le format de fichier choisi :
- le format enregistré `PNG`, pour les navigateurs et Discord ;
- `CF_DIBV5`, pour Word, Paint et les applications plus anciennes.

Kirishot n'utilise pas l'historique du presse-papiers de Windows : il garde son propre historique. Le choix de la crate (`clipboard-win` ou `arboard`) se fait dans le plan, à condition qu'elle écrive ces deux formats.

---

## 6. Cycle de vie et stockage

### 6.1 Mémoire

- Une capture vit dans `store` tant qu'une vignette, un éditeur, une épingle ou une sélection la référence.
- Dès que tout cela est fermé et que l'historique l'a écrite sur le disque, elle est libérée.
- Les écrans non choisis sont libérés dès la validation de la sélection.

### 6.2 Historique sur le disque

```
%APPDATA%\Kirishot\
  settings.json
  logs\                     rotation, 5 fichiers de 2 Mo au plus
  history\
    index.json              écrit de façon atomique (fichier temporaire puis renommage)
    <id>\
      original.png          la capture découpée, avant annotation
      final.png             l'image exportée, seulement si elle diffère de l'original
      document.json         seulement si la capture a été annotée
      thumb.webp            320 px de large
```

- `<id>` est un ULID, donc triable par date.
- Le nettoyage selon la durée de conservation a lieu au démarrage, puis toutes les 24 heures.
- Une capture supprimée de l'historique ne supprime **jamais** le fichier enregistré dans le dossier de destination.

### 6.3 Entrée de l'index

```json
{
  "id": "01JBX4Q8Z3M6N2P7R9S5T1V0W8",
  "createdAt": "2026-11-01T14:32:05+01:00",
  "size": { "w": 604, "h": 280 },
  "source": { "kind": "region", "windowTitle": "Paramètres du compte", "monitor": "\\\\.\\DISPLAY1" },
  "savedPath": "C:\\Users\\…\\Pictures\\Kirishot\\Kirishot 2026-11-01 à 14.32.05.png",
  "copied": true,
  "annotated": false,
  "bytes": 182344
}
```

- `source.kind` vaut `region`, `window` ou `fullscreen`.
- `savedPath` vaut `null` si la capture n'a jamais été enregistrée. Il contient le dernier chemin d'enregistrement.
- Les badges et les filtres de l'historique se déduisent de `savedPath`, `copied` et `annotated`.

---

## 7. Modèles de données

### 7.1 Réglages (`settings.json`, version 1)

```json
{
  "version": 1,
  "save": {
    "folder": null,
    "format": "png",
    "nameTemplate": "Kirishot {date} à {heure}",
    "counter": 1
  },
  "afterCapture": {
    "autoAction": "saveAndCopy",
    "thumbnailSeconds": 5,
    "alwaysOpenEditor": false
  },
  "capture": {
    "includeCursor": false,
    "sound": false,
    "trayTimerSeconds": 3,
    "commitOnRelease": false
  },
  "shortcuts": {
    "region": "PrintScreen",
    "fullscreen": "Shift+PrintScreen",
    "ocr": "Ctrl+PrintScreen",
    "repeatRegion": null,
    "openHistory": null
  },
  "history": { "retentionDays": 30 },
  "system": {
    "launchAtStartup": true,
    "language": "auto",
    "theme": "system",
    "checkUpdates": true
  },
  "printScreen": { "releasedByKirishot": false },
  "onboardingDone": false
}
```

- `autoAction` vaut `saveAndCopy`, `copy` ou `save`.
- `retentionDays` vaut `null` pour une conservation illimitée.
- Le champ `version` sert aux migrations. Une valeur absente ou invalide est remplacée par sa valeur par défaut, et un avertissement est écrit dans les journaux.
- `folder` vaut `null` tant que l'utilisateur garde le dossier par défaut. Kirishot le résout alors à chaque usage : le dossier Images connu de Windows, suivi de `Kirishot`. Le chemin n'est jamais écrit en dur.
- `nameTemplate` reçoit sa valeur au premier lancement, selon la langue (§ 7.3).

### 7.2 Document de l'éditeur (`document.json`)

```ts
type Document = {
  version: 1;
  captureId: string;
  size: { w: number; h: number };         // pixels de l'image d'origine
  crop: Rect | null;
  annotations: Annotation[];              // dans l'ordre d'affichage
  spotlightDim: number;                   // de 0 à 1
  beautify: {
    enabled: boolean;
    background: string;
    padding: number;
    radius: number;
    shadow: 'none' | 'sm' | 'md' | 'lg';
    aspect: 'auto' | '16:9' | '1:1' | '4:5';
  };
};

type Stroke = { color: string; width: number; opacity: number; dash: 'solid' | 'dashed' | 'dotted' };
type Fill = { kind: 'none' | 'translucent' | 'solid'; color: string };
type Font = { family: 'Geist' | 'Geist Mono'; size: number; weight: 400 | 600 };

type Annotation =
  | { id: string; tool: 'arrow'; points: [Point, Point]; control?: Point; head: 'end' | 'both'; stroke: Stroke; shadow: boolean }
  | { id: string; tool: 'line'; points: [Point, Point]; stroke: Stroke }
  | { id: string; tool: 'rect' | 'ellipse'; box: Rect; stroke: Stroke; fill: Fill; radius?: number; shadow: boolean }
  | { id: string; tool: 'pen'; points: Point[]; stroke: Stroke }
  | { id: string; tool: 'highlighter'; points: Point[]; color: string; width: number }
  | { id: string; tool: 'text'; at: Point; text: string; font: Font; color: string; background?: string }
  | { id: string; tool: 'step'; at: Point; color: string; size: number }   // le numéro dépend de l'ordre
  | { id: string; tool: 'blur'; box: Rect; kind: 'pixelate' | 'gaussian'; strength: number }
  | { id: string; tool: 'spotlight'; box: Rect; shape: 'rect' | 'ellipse' }
  | { id: string; tool: 'magnifier'; center: Point; radius: number; zoom: number; border: string };
```

- Le niveau d'assombrissement du projecteur est commun à toutes ses zones : il est stocké dans `Document.spotlightDim` (0,5 par défaut).

- Toutes les coordonnées sont exprimées en pixels de l'image, quel que soit le zoom.
- L'historique d'annulation contient des copies immuables du document, 200 au plus.
- Le numéro d'une étape n'est pas stocké : il se calcule d'après sa position parmi les pastilles.

### 7.3 Modèle de nom de fichier

| Jeton (français / anglais) | Valeur |
|---|---|
| `{date}` | `AAAA-MM-JJ` |
| `{heure}` / `{time}` | `HH.MM.SS` (le deux-points est interdit dans les noms de fichiers Windows) |
| `{fenêtre}` / `{window}` | Titre de la fenêtre au centre de la sélection, réduit à 60 caractères. Vide s'il n'y en a pas. |
| `{n}` | Compteur des captures enregistrées (`save.counter`), jamais remis à zéro. |

Les deux langues de jetons sont acceptées, quelle que soit la langue de l'interface. Le modèle par défaut est `Kirishot {date} à {heure}` en français et `Kirishot {date} at {time}` en anglais.

Exemple : `Kirishot {date} à {heure}` donne `Kirishot 2026-11-01 à 14.32.05.png`.

Le nom est nettoyé avant l'écriture :
- les caractères `<>:"/\|?*` et les caractères de contrôle sont remplacés par `-` ;
- les espaces en double sont réduits, ainsi que les points et les espaces en fin de nom ;
- les noms réservés (`CON`, `PRN`, `NUL`, `COM1`…) sont préfixés par `_` ;
- le nom est tronqué à 150 caractères.

Si le fichier existe déjà, Kirishot ajoute ` (2)`, ` (3)`, etc.

### 7.4 Coordonnées et DPI

- L'application est en mode DPI par écran (v2), le mode par défaut de Tauri.
- Chaque fenêtre de sélection couvre exactement son écran, en pixels physiques.
- Le canvas de l'image figée fait la taille physique de l'écran. Sa taille CSS est la taille physique divisée par l'échelle.
- Conversion d'un rectangle de sélection : `physique = arrondi(css × échelle)`, relatif à l'origine de l'écran. La découpe se fait dans l'image de cet écran.
- Les contours des fenêtres (en pixels physiques sur le bureau virtuel) sont convertis dans le repère de chaque écran avant d'être envoyés au front.

---

## 8. Erreurs et cas limites

| Situation | Comportement |
|---|---|
| Écrans avec des échelles différentes | Une fenêtre de sélection par écran, et des conversions centralisées dans `geometry.ts`. |
| Écran branché, débranché, ou échelle modifiée | Vérification à chaque capture : les fenêtres de sélection qui ne correspondent plus sont recréées. Cela ajoute de la latence uniquement après un changement. |
| Raccourci déjà pris par une autre application | Une notification Windows s'affiche, et le champ passe en rouge dans Réglages › Raccourcis. Les autres raccourcis continuent de fonctionner. |
| Impr. écran encore réservée par Windows | Un bandeau dans Réglages › Raccourcis, avec le bouton « Libérer la touche ». |
| Dossier de destination inaccessible (supprimé, disque débranché, droits) | Kirishot enregistre dans `Images\Kirishot` et prévient par une notification. La capture est de toute façon dans l'historique. |
| Disque plein | Une notification d'erreur. La capture reste en mémoire tant que la vignette ou l'éditeur est ouvert, ce qui permet de la copier. |
| Langue OCR manquante | Un message qui explique comment ajouter une langue dans Windows, avec un lien vers les paramètres de langue. |
| Aucun texte reconnu | La carte indique « Aucun texte trouvé » et rien n'est copié. |
| Contenus protégés (vidéos avec DRM) | Ils apparaissent en noir. C'est une limite de Windows, documentée dans le README. |
| Presse-papiers occupé par une autre application | Trois nouvelles tentatives à 50 ms d'intervalle, puis une notification d'erreur. |
| Plantage de la webview de sélection | Rust la recrée à la capture suivante. L'erreur est écrite dans les journaux. |
| Réglages corrompus | Le fichier est renommé `settings.bak.json` et les valeurs par défaut sont chargées, avec une notification. |

Toutes les erreurs remontent au front sous la forme d'un type `KirishotError` sérialisé (un code et un message traduisible), jamais d'une chaîne brute.

---

## 9. Spike de latence (première tâche du plan)

**Question** : l'approche A affiche-t-elle l'écran figé en moins de 150 ms après le raccourci ?

**Mesure** : de l'appui (`t0`, dans le gestionnaire du raccourci) à l'affichage de la fenêtre de sélection avec son image dessinée (`t1`). On fait 20 essais sur l'écran principal, et sur deux écrans si possible. On retient la médiane et le 90e centile.

**Points à vérifier dans le spike** :
- Le temps de capture de `xcap` par écran (1080p et 1440p ou 4K si disponible).
- Le temps de transfert des pixels RGBA bruts par le protocole `kirishot`.
- **Une webview cachée peut suspendre son rendu** (`requestAnimationFrame` arrêté). Il faut vérifier si le canvas se dessine bien avant l'affichage, ou s'il faut garder la fenêtre affichée hors de l'écran, ou totalement transparente, pendant le chargement.
- L'absence de flash blanc à l'affichage (couleur de fond de la fenêtre réglée sur `#0E1014`).
- L'enregistrement de `Impr. écran` seule par `RegisterHotKey`, avec et sans le réglage de Windows désactivé. Si cela échoue, on se replie sur un hook clavier bas niveau (`WH_KEYBOARD_LL`) pour cette seule touche.
- Si le changement de `PrintScreenKeyForSnippingEnabled` prend effet tout de suite ou demande de rouvrir la session. Selon le résultat, le texte du premier lancement l'annonce.
- La mémoire au repos, avec les fenêtres de sélection et de vignettes créées cachées.

**Décision** :
- Si la médiane est sous 150 ms, on garde l'approche A.
- Si elle dépasse, on tente d'abord les optimisations repérées pendant le spike.
- Si le seuil reste dépassé après ces optimisations, la fenêtre de sélection passe en natif (Win32 et Direct2D), selon le principe 3 du § 4.4. Le reste de l'application ne change pas.

Le code du spike est jetable. Seules les mesures et la décision sont gardées, dans `docs/spike-latence.md`.

---

## 10. Tests

- **Rust** (`cargo test`) :
  - modèle de nom (jetons, nettoyage, noms réservés, collisions) ;
  - calculs de découpe et de DPI ;
  - nettoyage de l'historique selon la durée de conservation ;
  - écriture atomique de l'index ;
  - migration et réparation des réglages ;
  - choix de la fenêtre sous le curseur à partir d'une liste donnée.
- **Vitest** :
  - le modèle de document (ajout, modification, suppression, ordre, annuler et rétablir, limite de 200) ;
  - chaque outil (`create` et `update`, avec les modificateurs) ;
  - la numérotation des étapes ;
  - les conversions de `geometry.ts` ;
  - le calcul du cadre Embellir selon le format.
- **Tests manuels**, liste dans `docs/tests-manuels.md`, à faire avant chaque version :
  - un et deux écrans, avec des échelles de 100 % et 150 % mélangées ;
  - coller dans Discord, Word, Paint et Chrome ;
  - capture d'un menu ouvert avec le retardateur ;
  - OCR en français et en anglais ;
  - glisser une vignette vers l'Explorateur et vers Discord ;
  - dossier de destination supprimé ;
  - Impr. écran libérée, puis rétablie ;
  - mise à jour automatique depuis la version précédente.
- **CI GitHub Actions** (`windows-latest`), à chaque push et sur chaque pull request :
  - `pnpm lint` ;
  - vérification des types ;
  - `pnpm test` ;
  - `cargo fmt --check` ;
  - `cargo clippy -D warnings` ;
  - `cargo test` ;
  - construction de l'installeur.

---

## 11. Distribution et dépôt

- **Installeur** : NSIS (`.exe`), installé pour l'utilisateur courant, donc sans droits administrateur. La désinstallation rétablit Impr. écran si Kirishot l'avait libérée (hook NSIS).
- **Mises à jour** : `tauri-plugin-updater`, avec un `latest.json` publié dans les GitHub Releases.
  - Les mises à jour sont signées par la clé Tauri, qui est gardée dans les secrets GitHub.
  - Kirishot vérifie au démarrage, puis toutes les 24 heures.
  - Il propose la mise à jour et ne l'installe jamais sans accord.
- **Publication** : un tag `vX.Y.Z` déclenche un workflow avec `tauri-action`, qui construit l'application, la signe pour l'updater et crée une Release en brouillon. Les versions suivent SemVer et restent en `0.x` jusqu'à la stabilité. Un `CHANGELOG.md` les accompagne.
- **Signature du code** :
  - au début, aucune, donc Windows affiche un avertissement SmartScreen, expliqué dans le README ;
  - ensuite, SignPath (gratuit pour l'open source, sur dossier) ou Azure Trusted Signing (payant) ;
  - un manifeste winget sera publié quand l'application sera stable.
- **Fichiers du dépôt** :
  - `README.md` (en anglais) et `README.fr.md` ;
  - `LICENSE` (MIT) ;
  - `CONTRIBUTING.md` ;
  - un modèle d'issue pour les bugs, qui demande les journaux.
- **Dépôt GitHub** : il est créé plus tard, avec l'accord de l'auteur. En attendant, le dépôt reste local.

---

## 12. Hors v1

- Enregistrement vidéo et GIF.
- Capture défilante.
- Envoi vers le cloud et liens de partage.
- macOS, Linux et ARM64.
- Sélection à cheval sur deux écrans.
- Capture d'une fenêtre isolée (sans ce qui la recouvre, avec son ombre).
- Recherche dans le texte des images de l'historique.
- Épingles conservées après un redémarrage.
- Choix de la couleur d'accent.
- Microsoft Store.

---

## 13. Risques et points ouverts

| Risque | Parade |
|---|---|
| Latence de l'écran figé au-dessus de 150 ms | Spike en premier (§ 9), avec une solution de repli native prévue par l'architecture. |
| Impr. écran impossible à enregistrer | Hook clavier bas niveau pour cette touche, vérifié dans le spike. |
| Rendu suspendu dans les webviews cachées | Vérifié dans le spike, avec un affichage hors écran en repli. |
| Mémoire au repos trop élevée à cause des webviews créées d'avance | Mesurée dans le spike. Si besoin, seule la fenêtre de l'écran principal est gardée d'avance. |
| SmartScreen fait fuir les premiers utilisateurs | Explication dans le README, puis une demande à SignPath. |
| Le nom « Kirishot » est déposé comme marque | Pas encore vérifié. À contrôler (EUIPO, USPTO, INPI) avant la publication du dépôt. |

---

## 14. Découpage en jalons

La v1 est trop grosse pour un seul plan d'implémentation. Elle est construite en jalons, et chacun laisse une application utilisable. Chaque jalon reçoit son propre plan, écrit au moment de le commencer.

| Jalon | Contenu | Résultat |
|---|---|---|
| **J0** | Spike de latence (§ 9). | La décision A ou B, avec les mesures. |
| **J1** | Squelette Tauri, zone de notification, raccourcis, capture de tous les écrans, fenêtre de sélection (zone, fenêtre, plein écran), découpe, enregistrement, presse-papiers, réglages minimaux (dossier, format, action), modèle de nom complet, CI. | Impr. écran → zone → enregistrée et copiée. |
| **J2** | Vignette flottante (empilement, action automatique, glisser), historique sur le disque et fenêtre Historique. | Le parcours façon macOS, sans éditeur. |
| **J3** | Éditeur : modèle de document, annuler et rétablir, export, puis les outils Sélection, Recadrer, Flèche, Ligne, Rectangle, Ellipse, Crayon, Texte, Étapes. | Annoter puis copier ou enregistrer. |
| **J4** | Outils Surligneur, Flouter, Projecteur, Loupe, Pipette, puis le panneau Embellir. | L'éditeur complet. |
| **J5** | OCR, retardateur, épingles, Refaire la dernière zone. | Les extras de la v1. |
| **J6** | Premier lancement, libération d'Impr. écran, réglages complets, traduction anglaise, installeur, mises à jour, README, première Release. | La version 0.1.0 publiable. |
