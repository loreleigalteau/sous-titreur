import { LANGUAGE_NAMES, LANGUAGES, useI18n } from "../i18n";

/**
 * Interface language switch: one button per language (FR | EN), the active one
 * highlighted. Codes rather than flags, because a flag stands for a country,
 * not a language. Each button carries the language's own name for tooltips
 * and screen readers.
 */
export function LanguageSelect() {
  const { language, setLanguage, t } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label={t("language_label")}>
      {LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          title={LANGUAGE_NAMES[code]}
          aria-label={LANGUAGE_NAMES[code]}
          aria-pressed={code === language}
          onClick={() => setLanguage(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
