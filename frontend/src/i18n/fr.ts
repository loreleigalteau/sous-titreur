import type { MessageKey } from "./en";

export const fr: Record<MessageKey, string> = {
  app_title: "Sous-titreur",
  language_label: "Langue de l'interface",
  loading: "Chargement…",
  cancel: "Annuler",
  error_generic: "Une erreur s'est produite : {details}",
  server_unreachable: "Impossible de joindre l'application. Est-elle toujours lancée ?",

  // Home
  import_title: "Importer une vidéo",
  import_hint:
    "Glissez-déposez une vidéo ici, ou choisissez un fichier. Elle reste sur votre ordinateur.",
  import_button: "Choisir une vidéo",
  uploading: "Import de la vidéo… {percent} %",
  projects_title: "Vos projets",
  projects_empty: "Aucun projet pour l'instant. Importez une vidéo pour commencer.",
  project_segments_one: "{count} sous-titre",
  project_segments_other: "{count} sous-titres",
  project_not_transcribed: "Pas encore transcrit",
  delete: "Supprimer",
  confirm_delete:
    "Supprimer le projet « {name} » et sa copie de la vidéo ? Cette action est irréversible.",

  // Project
  back_to_projects: "← Projets",
  project_not_found: "Ce projet n'existe plus.",
  save_saved: "Modifications enregistrées",
  save_saving: "Enregistrement…",
  save_unsaved: "Modifications non enregistrées",
  save_error: "Échec de l'enregistrement. Réessayer",
  video_unsupported:
    "Votre navigateur ne peut pas lire ce format vidéo. La transcription et l'export fonctionnent quand même ; pour l'aperçu, convertissez la vidéo en MP4.",

  // Transcription
  transcribe_title: "Transcription",
  transcribe_again: "Transcrire à nouveau",
  transcribe_again_warning: "Cela remplace les sous-titres actuels, y compris vos corrections.",
  confirm_transcribe_again: "Remplacer les sous-titres actuels par une nouvelle transcription ?",
  model_label: "Précision",
  model_tiny: "Tiny : le plus rapide, le moins précis",
  model_base: "Base : rapide",
  model_small: "Small : bon compromis (recommandé)",
  model_medium: "Medium : le plus précis, lent",
  model_hint: "Le modèle est téléchargé à la première utilisation (de 75 Mo à 1,5 Go).",
  spoken_language_label: "Langue parlée dans la vidéo",
  spoken_language_auto: "Détection automatique",
  start_transcription: "Lancer la transcription",
  status_extracting: "Extraction de l'audio…",
  status_downloading_model:
    "Téléchargement du modèle (première utilisation uniquement, cela peut prendre plusieurs minutes)…",
  status_loading_model: "Chargement du modèle…",
  status_transcribing: "Transcription… {percent} %",
  status_done: "Transcription terminée.",
  transcription_running_notice: "L'édition est suspendue pendant la transcription.",

  // Undo / redo, export
  undo: "Annuler (Ctrl/⌘+Z)",
  redo: "Rétablir (Ctrl/⌘+Maj+Z)",
  export_menu: "Exporter",
  export_mp4: "Vidéo avec sous-titres (MP4)",
  export_srt: "Sous-titres seuls (SRT)",
  export_vtt: "Sous-titres seuls (VTT)",
  export_ass: "Sous-titres avec style (ASS)",
  export_ass_hint:
    "Pour VLC, Aegisub ou les logiciels de montage. Les polices doivent être installées sur l'ordinateur qui le lit.",
  render_title: "Export de la vidéo",
  render_preparing: "Préparation des sous-titres… {current} / {total}",
  render_encoding: "Création de la vidéo… {percent} %",
  render_done: "Votre vidéo est prête.",
  render_download: "Télécharger la vidéo",
  render_keep_open: "Gardez cette page ouverte jusqu'à la fin de l'export.",
  close: "Fermer",
  job_busy:
    "Une autre tâche (transcription ou export) est déjà en cours. Attendez qu'elle se termine.",

  // Player
  play: "Lecture",
  pause: "Pause",
  seek: "Position dans la vidéo",
  drag_hint: "Faites glisser le sous-titre sur la vidéo pour le déplacer.",
  style_sample: "Votre sous-titre ici",

  // Style
  style_title: "Style",
  style_font: "Police",
  style_bold: "Gras",
  style_size: "Taille",
  style_text_color: "Couleur du texte",
  style_outline: "Contour",
  style_outline_color: "Couleur du contour",
  style_outline_width: "Épaisseur du contour",
  style_background: "Fond derrière le texte",
  style_background_color: "Couleur du fond",
  style_background_opacity: "Opacité du fond",
  style_max_width: "Largeur des lignes",
  style_position: "Position",
  position_top: "En haut",
  position_middle: "Au milieu",
  position_bottom: "En bas",
  style_reset: "Réinitialiser le style",

  // Subtitle length
  length_label: "Longueur des sous-titres",
  length_short: "Courts : quelques mots (TikTok, Reels)",
  length_medium: "Moyens : une ligne",
  length_long: "Standard : jusqu'à deux lignes (YouTube)",
  length_none: "Phrases entières",
  recut: "Redécouper",
  recut_hint: "Redécoupe tous les sous-titres à cette longueur. Peut être annulé.",

  // Subtitle actions
  segment_split: "Scinder au curseur (Ctrl/⌘+Entrée)",
  split_hint: "Cliquez dans le texte à l'endroit où couper, puis scindez.",
  segment_add_after: "Ajouter un sous-titre après celui-ci",
  segment_merge: "Fusionner avec le suivant",
  segment_delete: "Supprimer ce sous-titre",
  add_subtitle_here: "Ajouter un sous-titre à l'instant courant",

  // Timeline
  timeline_label: "Frise",
  timeline_zoom: "Zoom",
  waveform_loading: "Chargement de l'onde sonore…",

  // Shift timings
  shift_title: "Décaler les timings",
  shift_amount: "Secondes (négatif : plus tôt, positif : plus tard)",
  shift_from_current: "Seulement à partir du sous-titre courant",
  shift_apply: "Décaler",

  // Keyboard shortcuts
  shortcuts_button: "Raccourcis clavier (?)",
  shortcuts_title: "Raccourcis clavier",
  shortcuts_note: "En dehors des champs de texte, sauf pour les raccourcis avec Ctrl/⌘.",
  key_space: "Espace",
  key_enter: "Entrée",
  key_escape: "Échap",
  key_shift: "Maj",
  shortcut_play: "Lecture / pause",
  shortcut_seek: "Reculer / avancer d'une seconde (avec Maj : 5 secondes)",
  shortcut_navigate: "Sous-titre précédent / suivant",
  shortcut_edit: "Modifier le texte du sous-titre courant",
  shortcut_leave: "Quitter le champ de texte",
  shortcut_split: "Scinder le sous-titre au curseur",
  shortcut_mark: "Placer le début / la fin du sous-titre courant à la tête de lecture",
  shortcut_undo: "Annuler / rétablir",
  shortcut_save: "Enregistrer maintenant",
  shortcut_help: "Afficher cette liste",

  // Subtitles
  segments_title: "Sous-titres",
  segments_empty: "Pas encore de sous-titres. Lancez une transcription pour les générer.",
  segment_start: "Début",
  segment_end: "Fin",
  segment_text: "Texte du sous-titre",
  invalid_time: "Temps invalide. Utilisez un format comme 1:02.500.",
  end_before_start: "La fin est avant le début.",

  // Find and replace
  find_placeholder: "Rechercher",
  replace_placeholder: "Remplacer par",
  match_case: "Respecter la casse",
  whole_word: "Mot entier",
  find_previous: "Précédent",
  find_next: "Suivant",
  replace_one: "Remplacer",
  replace_all: "Tout remplacer",
  find_count: "{current} sur {total}",
  find_none: "Aucun résultat",
  confirm_replace_all_one:
    "Remplacer {count} occurrence ? L'annulation n'est pas encore disponible.",
  confirm_replace_all_other:
    "Remplacer {count} occurrences ? L'annulation n'est pas encore disponible.",
  replaced_count_one: "{count} occurrence remplacée.",
  replaced_count_other: "{count} occurrences remplacées.",
};
