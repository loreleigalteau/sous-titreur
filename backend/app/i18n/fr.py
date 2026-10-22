MESSAGES = {
    # Errors
    "ffmpeg_not_found": (
        "FFmpeg est introuvable. Installez-le puis relancez la commande "
        "(macOS : `brew install ffmpeg`, Ubuntu/Debian : `sudo apt install ffmpeg`, "
        "Windows : https://ffmpeg.org/download.html)."
    ),
    "ffmpeg_failed": "FFmpeg n'a pas pu extraire l'audio de la vidéo :\n{details}",
    "video_not_found": "Fichier introuvable : {path}",
    "unexpected_wav_format": "Format audio inattendu (attendu : WAV 16 kHz mono 16 bits).",
    "transcription_failed": "La transcription a échoué : {details}",
    "render_failed": "L'export de la vidéo a échoué : {details}",

    # Transcription steps
    "extracting_audio": "Extraction de l'audio…",
    "model_downloading": (
        "Téléchargement du modèle « {model} » (première utilisation uniquement, "
        "cela peut prendre quelques minutes)…"
    ),
    "model_loading": "Chargement du modèle « {model} »…",
    "transcribing": "Transcription en cours…",
    "language_detected": "Langue détectée : {language} (confiance {probability:.0%})",
    "progress": "Progression : {percent:3d} %",
    "done": "Sous-titres enregistrés dans : {path} ({count} segments)",
    "interrupted": "Interrompu.",

    # Command-line help
    "cli_description": "Génère un fichier de sous-titres SRT à partir d'une vidéo.",
    "cli_help_video": "chemin de la vidéo (ou du fichier audio) à transcrire",
    "cli_help_model": "taille du modèle Whisper : plus gros = plus précis mais plus lent",
    "cli_help_lang": (
        "langue parlée dans la vidéo (ex. fr, en). Par défaut : détection automatique"
    ),
    "cli_help_ui_lang": "langue des messages de l'application",
    "cli_help_max_chars": (
        "découpe les sous-titres à ce nombre de caractères au plus "
        "(ex. 20 pour TikTok, 42 pour YouTube)"
    ),
    "cli_help_output": "fichier SRT de sortie. Par défaut : même nom que la vidéo, en .srt",

    # Application server
    "server_description": "Lance l'éditeur de sous-titres dans une fenêtre d'application.",
    "server_help_browser": "ouvrir l'éditeur dans le navigateur plutôt que dans une fenêtre d'application",
    "server_help_port": "port souhaité (le suivant libre est utilisé s'il est occupé)",
    "server_help_no_browser": "lancer seulement le serveur, sans fenêtre ni navigateur",
    "server_ready": "L'éditeur de sous-titres est accessible à l'adresse {url}",
    "server_stop_hint": (
        "Gardez cette fenêtre ouverte pendant l'utilisation. Ctrl+C pour arrêter."
    ),
    "server_stopped": "Éditeur de sous-titres arrêté.",
    "window_hint": "L'éditeur de sous-titres est ouvert. Fermez sa fenêtre pour quitter.",
    "window_unavailable": "La fenêtre de l'application n'a pas pu s'ouvrir ({details}) ; ouverture du navigateur à la place.",
}
