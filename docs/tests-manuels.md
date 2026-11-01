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
18. Dossier de destination supprimé ou clé USB débranchée : la capture arrive dans `Images\Kirishot`, avec la notification « Dossier de destination inaccessible ».

### Limite connue de J1

- Quand la fenêtre des réglages de Kirishot est active, Win + Maj + S et Impr. écran ouvrent l'outil de Windows : le hook clavier ne reçoit pas ces touches tant qu'une fenêtre WebView2 de Kirishot a le focus. Contournement : le menu de la zone de notification.
- Pour la même raison, appuyer une seconde fois sur le raccourci pendant une sélection peut ouvrir l'outil de Windows par-dessus l'écran figé.
