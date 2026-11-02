# Kirishot : une application aboutie (J3)

Ce document est la spec du jalon qui suit J2.1. Il complète les specs J2 (`2026-11-02-kirishot-usage-quotidien-design.md`) et J2.1 (`2026-11-02-kirishot-j2-1-corrections-design.md`), et les remplace sur les points listés au § 8. Il reprend aussi ce que J2.1 avait repoussé : enregistrement intelligent, renommage, couleurs libres, pipette, page des raccourcis.

## 1. Le besoin

### Ce qui a été dit (tests de J2.1, 02/11/2026)

- À la fin de l'installation, « Lancer Kirishot » coché puis « Terminer » n'ouvre rien.
- Dans l'éditeur, la bulle de sélection répète les réglages de la barre du haut, et elle masque l'élément sélectionné (un surlignage, par exemple). Elle n'est pas déplaçable.
- La fenêtre principale ne contient que des réglages, sans navigation. Il faut une structure d'application moderne, claire et évolutive.
- Des préférences annoncées ne sont pas modifiables. Chaque réglage affiché doit fonctionner.
- Les cartes des réglages sont collées aux séparateurs de section.
- On peut enregistrer indéfiniment la même image sans modification : le bouton doit être désactivé tant que rien n'a changé, et après une modification on doit pouvoir remplacer ou créer une nouvelle version (demande de J2.1).
- Renommer le fichier depuis l'éditeur (demande de J2.1).
- Couleurs libres et pipette, dans l'image et ailleurs à l'écran (demande de J2.1).
- Page des raccourcis, consultable et personnalisable (demande de J2.1).
- Le mode de capture choisi (Fenêtre) revient à la capture suivante ; l'utilisateur veut démarrer en Zone et choisir ce comportement dans les réglages.
- Dans la barre de capture, Annuler a un libellé inutile : une icône suffit.

### Diagnostic

| Symptôme | Cause |
|---|---|
| Rien ne s'ouvre après l'installation | Au lancement, l'application ne crée que l'icône de la zone de notification ; aucune fenêtre n'est montrée. |
| « Lancer au démarrage » sans effet | `system.launchAtStartup` existe mais rien ne l'applique (pas de plugin autostart). |
| Réglages sans interface | `save.nameTemplate`, `system.theme`, `capture.includeCursor`, les raccourcis. `includeCursor` n'est pas implémenté. |
| Réglages sans fonction | `system.language` (pas de traduction), `system.checkUpdates`, `capture.trayTimerSeconds` (pas de retardateur), `history.retentionDays` (pas d'historique avant ce jalon). |

### Critère de réussite

Kirishot s'ouvre comme une vraie application, retrouve chaque capture dans son historique, n'affiche que des réglages qui agissent, et l'éditeur ne cache jamais l'image ni ne crée de doublons.

## 2. Démarrage et capture

### 2.1 Lancement

- Lancé par l'utilisateur (fin d'installation, menu Démarrer, raccourci, double-clic) : la fenêtre principale s'ouvre sur l'Historique.
- Lancé à l'ouverture de session : l'argument `--autostart` est présent ; l'application reste dans la zone de notification, sans fenêtre.
- Une seconde instance ouvre la fenêtre principale (inchangé).

### 2.2 Lancer au démarrage de Windows

- `tauri-plugin-autostart` (MIT/Apache), lancé avec l'argument `--autostart`.
- `system.launchAtStartup` (défaut `true`) est appliqué au démarrage de l'application et à chaque changement du réglage. Un échec est journalisé et affiché sous le réglage, sans bloquer.

### 2.3 Mode au début d'une capture

- Nouveau réglage `capture.startMode` : `"region"` (défaut), `"window"` ou `"last"`.
- Avec `"region"` ou `"window"`, la capture démarre toujours dans ce mode ; R et W ne changent que la capture en cours.
- Avec `"last"`, le comportement de J2.1 : `capture.mode` mémorise le dernier mode.

### 2.4 Barre de capture

- Annuler n'a plus de libellé : une croix, avec l'info-bulle « Annuler · Échap ».

### 2.5 Inclure le curseur

- `capture.includeCursor` (défaut `false`) : au gel de l'écran, la position et l'image du pointeur sont relevées (`GetCursorInfo`, `GetIconInfo`, `DrawIconEx`) et le pointeur est dessiné dans l'image du moniteur où il se trouve, à l'échelle du moniteur.

## 3. Éditeur

### 3.1 Plus de bulle flottante

- La bulle de sélection est supprimée. La barre du haut est le seul endroit des réglages : ceux de l'outil actif sans sélection, ceux communs à la sélection sinon (table de J2.1 § 3.1).
- Avec une sélection, la barre ajoute un groupe d'actions : Premier plan, Arrière-plan, Dupliquer, Supprimer (icônes avec info-bulles et raccourcis).
- Paliers (J2.1 § 4.1) : complète et compacte gardent les actions en icônes ; étroite les met en bas du menu « Style ».

### 3.2 Enregistrement intelligent

- État d'enregistrement d'une capture : `never` (jamais enregistrée), `clean` (enregistrée, rien changé depuis), `dirty` (modifiée depuis le dernier enregistrement). L'état se calcule en comparant le document courant à celui du dernier enregistrement (`savedDoc`) : revenir par Annuler au document enregistré redonne `clean`.
- Une capture enregistrée automatiquement (vignette) ouvre l'éditeur en `clean`, avec ce chemin.
- Bouton Enregistrer :
  - `never` : crée le fichier (nom du modèle, ou nom choisi au § 3.3) ;
  - `clean` : désactivé, info-bulle « Déjà enregistrée, aucune modification » ; Ctrl+S ne fait rien ;
  - `dirty` : remplace le même fichier (écriture atomique).
- Menu à côté du bouton (flèche) : « Enregistrer comme nouvelle version » (nouveau fichier `… (2).png`, qui devient le fichier courant) et « Enregistrer sous… » (dialogue Windows ; le fichier choisi devient le fichier courant). Ces deux entrées restent disponibles en `clean`.
- Si le fichier courant a été supprimé ou déplacé hors de Kirishot, « Enregistrer » le recrée au même chemin.

### 3.3 Renommer

- Le nom du fichier s'affiche à gauche de la barre d'état (le nom à venir, en atténué, avant le premier enregistrement). Un clic ou F2 le rend modifiable sur place ; Entrée valide, Échap annule ; l'extension n'est pas modifiable.
- Avant le premier enregistrement : le nom choisi sera celui du fichier.
- Après : le fichier est renommé sur le disque, dans le même dossier ; l'historique suit.
- Refus (message sous le champ, rien n'est renommé) : nom vide, caractères `\ / : * ? " < > |`, nom réservé Windows (`CON`, `NUL`…), fichier déjà existant.

### 3.4 Couleurs libres et pipette

- Un bouton « + » après la palette ouvre un sélecteur : zone teinte-saturation, curseur de teinte, champ hexadécimal (`react-colorful`, MIT), et les 8 dernières couleurs libres (`editor.recentColors` dans les réglages).
- Pipette : bouton dans le sélecteur, ou touche I. API `EyeDropper` de WebView2 : la couleur est prise n'importe où sur l'écran, image et autres applications comprises. Échap annule. La couleur prise devient la couleur courante et entre dans les récentes. Si l'API manque, le bouton n'est pas affiché.

### 3.5 Fermer avec des modifications non enregistrées

- Une capture a des modifications non enregistrées quand son état est `dirty`, ou `never` avec un document différent de celui de l'ouverture (annotation, recadrage).
- Toute fermeture de l'éditeur passe par la même vérification : la croix de la fenêtre, Alt+F4, Échap sans sélection, et l'ouverture d'une autre capture dans l'éditeur (vignette « Modifier », historique « Éditer »). « Copier et fermer » ne demande rien : l'utilisateur a choisi de partir avec la copie.
- Avec des modifications non enregistrées et `editor.confirmClose` à `true`, une boîte de dialogue s'ouvre dans l'éditeur : titre « Enregistrer les modifications ? », texte « Les annotations de cette capture n'ont pas été enregistrées dans un fichier. », boutons **Enregistrer** (action principale, Entrée), **Ne pas enregistrer**, **Annuler** (Échap), et une case « Ne plus demander ».
  - Enregistrer : enregistre (§ 3.2), puis ferme ; si l'enregistrement échoue, la fenêtre reste ouverte avec l'erreur.
  - Ne pas enregistrer : ferme sans écrire de fichier. Les annotations restent dans l'historique (autosauvegarde), où « Éditer » les retrouve.
  - Annuler : rien ne se passe, l'éditeur reste ouvert.
  - « Ne plus demander » cochée, puis Enregistrer ou Ne pas enregistrer : `editor.confirmClose` passe à `false`. Elle est ignorée avec Annuler.
- Avec `editor.confirmClose` à `false`, la fermeture se fait sans question, comme « Ne pas enregistrer ».
- Le réglage se rétablit dans Réglages › Après capture › Éditeur : « Demander avant de fermer une capture modifiée ».
- Le bouton Enregistrer reste toujours visible dans la barre du haut, avec son libellé en disposition complète (icône seule en dessous de 1 100 px), et Ctrl+S.

## 4. Application principale

### 4.1 Navigation

- Barre latérale : logo, bouton « Nouvelle capture » ; Historique (accueil), Raccourcis, Réglages ; en bas À propos et la version.
- La page ouverte est mémorisée le temps de la session ; la fenêtre rouvre sur l'Historique.

### 4.2 Historique

- Stockage (spec v1 § 6.2, chemin `%APPDATA%\Kirishot\history\`) : chaque capture écrit `<id>\original.png` et `<id>\thumb.jpg` (320 px de large) dès qu'elle est prise ; `document.json` et `final.png` quand elle est annotée et exportée. `index.json` est écrit de façon atomique. Le dossier `captures\` de J2 est repris dans `history\` au premier démarrage.
- Entrée d'index (spec v1 § 6.3) : `id`, `createdAt`, `size`, `source { kind, windowTitle }`, `savedPath` (dernier chemin, ou `null`), `copied`, `annotated`, `bytes`.
- Grille groupée par jour (Aujourd'hui, Hier, puis la date) ; carte : miniature, heure, dimensions, badges « Enregistrée », « Copiée », « Annotée ».
- Au survol ou au focus d'une carte : Copier, Éditer (rouvre `document.json`, annotations modifiables), Afficher dans l'Explorateur (si `savedPath` existe encore), Supprimer (retire de l'historique ; ne supprime jamais le fichier enregistré).
- Recherche sur le nom de fichier, le titre de fenêtre et la date ; filtres Tout, Enregistrées, Copiées, Annotées.
- Pied : « {n} captures · {taille} · conservées {durée} » et « Vider l'historique… » avec confirmation.
- Nettoyage selon `history.retentionDays` (7, 30, 90 ou `null` illimité ; défaut 30) au démarrage puis toutes les 24 h.
- La page se met à jour quand une capture est ajoutée, enregistrée, copiée ou annotée (événement Rust).

### 4.3 Raccourcis

- Raccourcis globaux (capture de zone, second raccourci de zone, plein écran) : une ligne par action ; un clic puis la combinaison l'enregistre ; Échap annule ; « Par défaut » la rétablit ; « Aucun » la retire. Une combinaison refusée par Windows ou déjà prise s'affiche en rouge : « Déjà utilisé par une autre application ». Le raccourci est enregistré à chaud.
- Les raccourcis de l'écran de sélection et de l'éditeur sont listés et expliqués, groupés, non modifiables dans ce jalon. Leur liste vient des mêmes données que l'aide « ? » et les info-bulles.
- Les actions sans fonction (OCR, refaire la dernière zone, ouvrir l'historique) ne sont pas listées.

### 4.4 Réglages

| Onglet | Réglages |
|---|---|
| Général | dossier, format, modèle de nom (aperçu en direct, jetons `{date}`, `{heure}`, `{fenêtre}`, `{n}` de la spec v1 § 7.3, avec leur liste cliquable sous le champ), lancer au démarrage, thème (Comme Windows, Sombre, Clair) |
| Capture | mode au début, loupe, son, flash, inclure le curseur, capturer au relâchement, position de la barre |
| Après capture | action automatique, vignette, durée de la vignette, toujours ouvrir l'éditeur ; section Éditeur : demander avant de fermer une capture modifiée |
| Historique | durée de conservation, ouvrir le dossier, vider l'historique |

- Thème : `system.theme` applique `data-theme` à toutes les fenêtres sauf l'écran de sélection (toujours sombre) ; « Comme Windows » suit le système.
- Restent cachés : langue, mises à jour, retardateur.
- Espacements : titre de section, 16 px, carte ; lignes de 16 px de marge verticale et 20 px horizontale ; libellés et contrôles alignés sur la même ligne de base.

### 4.5 À propos

- Version, licence, lien vers le dépôt, bouton « Ouvrir le dossier des journaux ».

## 5. Données

Ajouts à `settings.json`, toujours en version 1 :

- `capture.startMode` : `"region"` | `"window"` | `"last"`, défaut `"region"`.
- `editor.recentColors` : liste de 0 à 8 couleurs `#RRGGBB`, défaut vide.
- `editor.confirmClose` : booléen, défaut `true`.
- `history.retentionDays` existe déjà (7, 30, 90 ou `null`).

## 6. Erreurs

- Remplacement ou renommage impossible (fichier verrouillé, droits) : message dans la barre d'état, l'état ne change pas.
- Index d'historique illisible : il est reconstruit à partir des dossiers `<id>`, avec un avertissement journalisé.
- Raccourci refusé : l'ancien reste actif.

## 7. Tests

- Automatisés : argument `--autostart` ; `startMode` ; état d'enregistrement (`never`/`clean`/`dirty`, retour par Annuler) ; nom de fichier (validation, réservés, conflit) ; nouvelle version ; index d'historique (ajout, mise à jour, suppression, nettoyage, reconstruction) ; regroupement par jour et filtres ; combinaisons de raccourcis ; couleurs récentes ; dessin du curseur ; réglages (défauts, anciens fichiers).
- Manuels : nouvelle série dans `docs/tests-manuels.md`.

## 8. Ce que ce jalon change dans les specs précédentes

- J2.1 § 3.1 et § 3.2 : la bulle est supprimée ; ses réglages et actions vont dans la barre du haut.
- J2.1 § 2.1 : la mémoire du mode dépend de `capture.startMode`.
- Spec v1 § 3.8 et § 6.2 : l'historique arrive dans ce jalon (sans épingles, qui restent en J4).
- J2 § 9 : J3 devient ce document ; Projecteur, Loupe (outil), flou gaussien et panneau Embellir passent en J4 avec l'OCR, le retardateur, les épingles et la dernière zone.
