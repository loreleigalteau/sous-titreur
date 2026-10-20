/**
 * Interface translations.
 *
 * Components call `const { t } = useI18n()` then `t("key", { name: value })`.
 * To add a language: copy en.ts, translate it, and add it to MESSAGES and
 * LANGUAGE_NAMES below.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { en, type MessageKey } from "./en";
import { fr } from "./fr";

export const MESSAGES = { en, fr } satisfies Record<string, Record<MessageKey, string>>;
export type Language = keyof typeof MESSAGES;
export const LANGUAGES = Object.keys(MESSAGES) as Language[];

// Each language is shown in its own name, so anyone can find theirs.
export const LANGUAGE_NAMES: Record<Language, string> = { en: "English", fr: "Français" };

type Values = Record<string, string | number>;
// Keys that have _one / _other plural forms, without the suffix.
type PluralKey = MessageKey extends infer K ? (K extends `${infer Base}_one` ? Base : never) : never;

const STORAGE_KEY = "sous-titreur.ui-language";

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && value in MESSAGES;
}

/** Replace {name} placeholders with their values. */
export function format(template: string, values: Values = {}): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in values ? String(values[name]) : placeholder,
  );
}

/**
 * Language at startup: the user's last choice in this browser, then the
 * language chosen when launching the app (--ui-lang or SOUS_TITREUR_LANG),
 * then the browser's language, then English.
 */
export function initialLanguage(serverLanguage?: string | null): Language {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private browsing…): just ignore it.
  }
  for (const candidate of [saved, serverLanguage, navigator.language.slice(0, 2)]) {
    if (isLanguage(candidate)) return candidate;
  }
  return "en";
}

interface I18n {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: MessageKey, values?: Values) => string;
  /** Plural-aware translation: picks key_one or key_other according to `count`. */
  tn: (key: PluralKey, count: number, values?: Values) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ initial, children }: { initial: Language; children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initial);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not saved: the choice will just not be remembered.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18n>(() => {
    const messages = MESSAGES[language];
    const t = (key: MessageKey, values?: Values) => format(messages[key], values);
    // Intl.PluralRules knows each language's rules (e.g. 0 is singular in French).
    const rules = new Intl.PluralRules(language);
    const tn = (key: PluralKey, count: number, values?: Values) => {
      const form = rules.select(count) === "one" ? "one" : "other";
      return t(`${key}_${form}` as MessageKey, { count, ...values });
    };
    return { language, setLanguage, t, tn };
  }, [language, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside <I18nProvider>");
  return context;
}
