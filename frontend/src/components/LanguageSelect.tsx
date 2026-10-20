import { LANGUAGE_NAMES, LANGUAGES, useI18n, type Language } from "../i18n";

export function LanguageSelect() {
  const { language, setLanguage, t } = useI18n();
  return (
    <select
      className="language-select"
      aria-label={t("language_label")}
      title={t("language_label")}
      value={language}
      onChange={(event) => setLanguage(event.target.value as Language)}
    >
      {LANGUAGES.map((code) => (
        <option key={code} value={code}>
          {LANGUAGE_NAMES[code]}
        </option>
      ))}
    </select>
  );
}
