from string import Formatter

import pytest

from app import i18n
from app.i18n import LANGUAGES, detect_language, set_language, t


def placeholders(text: str) -> set[str]:
    return {name for _, name, _, _ in Formatter().parse(text) if name}


@pytest.fixture(autouse=True)
def restore_language():
    previous = i18n.get_language()
    yield
    set_language(previous)


@pytest.fixture
def clean_env(monkeypatch):
    for var in (i18n.ENV_VAR, "LC_ALL", "LC_MESSAGES", "LANG"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setattr(i18n.locale, "getlocale", lambda: (None, None))
    return monkeypatch


@pytest.mark.parametrize("code", sorted(LANGUAGES))
def test_every_language_has_the_same_keys_and_placeholders(code):
    reference = LANGUAGES[i18n.DEFAULT_LANGUAGE]
    messages = LANGUAGES[code]
    assert messages.keys() == reference.keys()
    for key, text in reference.items():
        assert placeholders(messages[key]) == placeholders(text), key


def test_t_uses_current_language_and_fills_placeholders():
    set_language("fr")
    assert t("video_not_found", path="a.mp4") == "Fichier introuvable : a.mp4"
    set_language("en")
    assert t("video_not_found", path="a.mp4") == "File not found: a.mp4"


def test_set_language_rejects_unknown_code():
    with pytest.raises(ValueError):
        set_language("xx")


def test_detect_language_env_var_wins(clean_env):
    clean_env.setenv("LANG", "fr_FR.UTF-8")
    clean_env.setenv(i18n.ENV_VAR, "EN")
    assert detect_language() == "en"


@pytest.mark.parametrize(
    ("lang", "expected"),
    [("fr_FR.UTF-8", "fr"), ("fr_CA", "fr"), ("en_US.UTF-8", "en"), ("de_DE", "en"), ("C", "en")],
)
def test_detect_language_from_system(clean_env, lang, expected):
    clean_env.setenv("LANG", lang)
    assert detect_language() == expected


def test_detect_language_posix_precedence(clean_env):
    clean_env.setenv("LANG", "en_US")
    clean_env.setenv("LC_ALL", "fr_FR")
    assert detect_language() == "fr"


def test_detect_language_windows_style_locale(clean_env):
    clean_env.setattr(i18n.locale, "getlocale", lambda: ("French_France", "1252"))
    assert detect_language() == "fr"


def test_detect_language_defaults_to_english(clean_env):
    assert detect_language() == "en"
