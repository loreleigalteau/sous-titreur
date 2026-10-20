"""Translation of user-facing texts.

Each language has its own module (fr.py, en.py) holding a MESSAGES dict with
the same keys. Code uses `t("key", name=value)` to get the text in the current
language. To add a language: copy en.py, translate it, and register it in
LANGUAGES below; the tests check that no key or placeholder is missing.

We use plain Python dicts rather than gettext: no compilation step and no
extra tooling, which suits the small number of texts we have.
"""

from __future__ import annotations

import locale
import os

from app.i18n import en, fr

LANGUAGES = {"en": en.MESSAGES, "fr": fr.MESSAGES}
DEFAULT_LANGUAGE = "en"
ENV_VAR = "SOUS_TITREUR_LANG"

_current = DEFAULT_LANGUAGE


def language_from_env() -> str | None:
    """The language set with the SOUS_TITREUR_LANG environment variable, if valid."""
    value = os.environ.get(ENV_VAR, "").lower()
    return value if value in LANGUAGES else None


def detect_language() -> str:
    """Pick the interface language when the user did not choose one explicitly.

    Order: the SOUS_TITREUR_LANG environment variable, then the system
    language, then English.
    """
    explicit = language_from_env()
    if explicit:
        return explicit

    # Standard POSIX precedence for the system language; on Windows these
    # variables are usually unset and locale.getlocale() gives e.g. "French_France".
    system = (
        os.environ.get("LC_ALL")
        or os.environ.get("LC_MESSAGES")
        or os.environ.get("LANG")
        or locale.getlocale()[0]
        or ""
    )
    code = system[:2].lower()
    return code if code in LANGUAGES else DEFAULT_LANGUAGE


def set_language(code: str) -> None:
    global _current
    if code not in LANGUAGES:
        raise ValueError(f"Unsupported language: {code}")
    _current = code


def get_language() -> str:
    return _current


def translate(language: str, key: str, **values: object) -> str:
    """Return the text for `key` in `language`, with placeholders filled."""
    messages = LANGUAGES.get(language, LANGUAGES[DEFAULT_LANGUAGE])
    return messages[key].format(**values)


def t(key: str, **values: object) -> str:
    """Return the text for `key` in the current language, with placeholders filled."""
    return translate(_current, key, **values)


class TranslatableError(Exception):
    """Error shown to the user.

    The message key and its values are kept so that the web interface can
    show the error in its own language, which may differ from the server's.
    """

    def __init__(self, key: str, **values: str) -> None:
        self.key = key
        self.values = values
        super().__init__(t(key, **values))
