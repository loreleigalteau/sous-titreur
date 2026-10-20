# Projet : éditeur de sous-titres libre et local

## Contexte
Je développe un logiciel libre qui génère automatiquement des sous-titres pour une
vidéo et permet de les éditer, dans l'esprit de l'outil de sous-titres de Canva.

Principes non négociables :
- **Local d'abord** : tout tourne sur l'ordinateur de l'utilisateur. Un serveur
  Python local sert l'API et l'interface, qui s'ouvre dans le navigateur
  (http://localhost:8000). Aucun service cloud, aucune vidéo envoyée sur internet.
- **Logiciel libre** : licence GPL v3. Uniquement des dépendances compatibles.
- **Simple à utiliser** : un utilisateur non technique doit s'en sortir.

## Stack technique
- Backend : Python 3.10+, FastAPI, Uvicorn.
- Transcription : faster-whisper (choix de la taille du modèle par l'utilisateur :
  tiny, base, small, medium). Horodatage au niveau du mot activé.
- Vidéo/audio : FFmpeg (appelé via subprocess) pour extraire l'audio et
  produire la vidéo finale.
- Incrustation des sous-titres : c'est le navigateur qui dessine chaque
  sous-titre (canvas, même code que l'aperçu) en image PNG transparente ;
  FFmpeg superpose ces images à la vidéo (filtre overlay). Ainsi l'export est
  identique à l'aperçu et fonctionne avec n'importe quel FFmpeg (celui de
  Homebrew n'a pas libass). Décision du 2026-10-20.
- Frontend : React + TypeScript avec Vite. Le build statique est servi par FastAPI.
- Timeline et forme d'onde : wavesurfer.js (phase 3).
- Formats : SRT, VTT, ASS (le ASS transporte le style pour d'autres logiciels ;
  il ne sert pas à l'incrustation), MP4 avec sous-titres incrustés.

## Modèle de données
Un projet contient la vidéo source, la langue, et une liste de segments :
- segment : id, start (secondes), end, text, words[]
- word : text, start, end
- style global : police, taille, couleur du texte, couleur du contour, couleur de
  surlignage, position verticale.
Les projets sont sauvegardés en JSON dans un dossier local.

## Contraintes techniques
- La transcription est longue : la lancer en tâche de fond et exposer sa
  progression (polling ou Server-Sent Events). L'interface ne doit jamais bloquer.
- Les fichiers vidéo peuvent être gros : pas de chargement complet en mémoire.
- Le modèle Whisper est téléchargé au premier usage ; afficher clairement cette étape.
- Fonctionnement sur CPU obligatoire, GPU utilisé s'il est disponible.
- Au lancement, ouvrir automatiquement le navigateur sur la bonne adresse.

## Plan par phases
Travaille une phase à la fois. À la fin de chaque phase : résume ce qui a été
fait, comment le tester, puis attends ma validation avant de passer à la suivante.

### Phase 1 — Transcription en ligne de commande
- Structure du projet (backend/, frontend/, README, LICENSE GPL v3, .gitignore).
- Script CLI : `python -m app.cli video.mp4 --model small --lang fr` → fichier .srt.
- Extraction audio FFmpeg, transcription faster-whisper, export SRT.
- Tests unitaires pour la génération SRT.
Critère : je lance la commande sur une vidéo et j'obtiens un SRT correct.

### Phase 2 — Serveur local et éditeur minimal
- API FastAPI : import de vidéo, lancement de transcription, suivi de progression,
  lecture et sauvegarde des segments, export SRT/VTT.
- Interface : import de la vidéo, lecteur vidéo avec aperçu des sous-titres en
  direct, liste des segments éditables (texte, début, fin), clic sur un segment
  = saut dans la vidéo, sauvegarde, export.
- Aide à la correction : correcteur orthographique du navigateur dans les
  champs de texte (langue de la vidéo), rechercher / remplacer dans tous les
  segments.
- Commande unique pour lancer l'application et ouvrir le navigateur.
Critère : je transcris, corrige et exporte une vidéo depuis le navigateur.

### Phase 2 bis — Retours après test (avancée de certaines tâches des phases 3 et 4)
- Respect du format de la vidéo (vertical type TikTok compris).
- Sous-titres courts : longueur maximale choisie à la transcription (découpage
  avec l'horodatage des mots), et redécoupage des sous-titres existants.
- Scinder, ajouter, fusionner, supprimer des segments ; annuler / rétablir.
- Style global : police (polices libres embarquées), taille, couleurs,
  contour ou fond ; position libre (une seule pour tous), par glisser-déposer
  sur la vidéo.
- Export MP4 avec sous-titres incrustés (barre de progression) ; export ASS ;
  les exports SRT / VTT restent disponibles.

### Phase 3 — Édition avancée
- Timeline avec forme d'onde (wavesurfer.js), segments déplaçables et
  redimensionnables à la souris.
- Décaler tous les timings. (Scinder / fusionner / ajouter / supprimer et
  annuler / rétablir : faits en phase 2 bis.)
- Raccourcis clavier (lecture/pause, segment suivant, etc.).

### Phase 4 — Styles et export vidéo
- Quelques préréglages de style (classique, réseaux sociaux, gros texte centré).
  (Panneau de style, export ASS et MP4 incrusté : faits en phase 2 bis.)

### Phase 5 — Animation mot par mot
- Surlignage du mot prononcé (effet karaoké) dans l'aperçu, l'export MP4 et
  l'export ASS.
- Option d'affichage d'un nombre limité de mots à la fois (format vidéo courte).

### Phase 6 — Distribution
- Paquet installable via pip.
- Image Docker incluant FFmpeg.
- Étude d'un exécutable autonome (PyInstaller) pour Windows, macOS, Linux.

## Conventions
- Code et commentaires lisibles, rédigés en anglais. Les outils de
  développement (ex. bootstrap.py) affichent leurs messages en anglais.
- Interface bilingue français / anglais, au choix de l'utilisateur (option
  `--ui-lang`, variable `SOUS_TITREUR_LANG`, sinon langue du système, sinon
  anglais). Textes centralisés dans `backend/app/i18n/` (un fichier par langue,
  appelés via `t("clé")`) ; tout nouveau texte doit exister dans les deux
  langues. L'interface web (phase 2) offrira le même choix.
- Commits petits et explicites. README tenu à jour avec les instructions
  d'installation et de lancement.
- Explique-moi tes choix techniques importants : je veux comprendre le code
  et pouvoir le maintenir.
- En cas de doute sur un choix de conception, pose-moi la question plutôt que
  de deviner.