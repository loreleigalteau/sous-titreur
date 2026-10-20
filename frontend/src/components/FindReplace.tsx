import { useEffect, useMemo, useState } from "react";
import { findMatches, replaceAll, replaceMatch, type FindOptions, type Match } from "../findReplace";
import { useI18n } from "../i18n";

interface Props {
  texts: string[];
  disabled: boolean;
  /** Show a match to the user (scroll to it and select it). */
  onShowMatch: (match: Match) => void;
  /** Apply the texts after a replacement (same length and order as `texts`). */
  onReplace: (texts: string[]) => void;
}

export function FindReplace({ texts, disabled, onShowMatch, onReplace }: Props) {
  const { t, tn } = useI18n();
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [options, setOptions] = useState<FindOptions>({ matchCase: false, wholeWord: false });
  const [current, setCurrent] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const matches = useMemo(() => findMatches(texts, query, options), [texts, query, options]);

  // Keep the current position valid when the matches change.
  useEffect(() => {
    if (current >= matches.length) setCurrent(0);
  }, [matches.length, current]);

  const go = (step: number) => {
    if (matches.length === 0) return;
    const next = (current + step + matches.length) % matches.length;
    setCurrent(next);
    onShowMatch(matches[next]);
  };

  const replaceCurrent = () => {
    const match = matches[current];
    if (!match) return;
    const updated = [...texts];
    updated[match.segmentIndex] = replaceMatch(texts[match.segmentIndex], match, replacement);
    onReplace(updated);
    setMessage(null);
  };

  const replaceEverything = () => {
    if (matches.length === 0) return;
    if (!window.confirm(tn("confirm_replace_all", matches.length))) return;
    const result = replaceAll(texts, query, replacement, options);
    onReplace(result.texts);
    setMessage(tn("replaced_count", result.count));
  };

  const toggle = (name: keyof FindOptions) =>
    setOptions((previous) => ({ ...previous, [name]: !previous[name] }));

  return (
    <section className="panel find-replace">
      <div className="find-row">
        <input
          type="search"
          placeholder={t("find_placeholder")}
          aria-label={t("find_placeholder")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setCurrent(0);
            setMessage(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              go(event.shiftKey ? -1 : 1);
            }
          }}
        />
        <span className="find-count" aria-live="polite">
          {query && (matches.length ? t("find_count", { current: current + 1, total: matches.length }) : t("find_none"))}
        </span>
        <button type="button" onClick={() => go(-1)} disabled={!matches.length} title={t("find_previous")}>
          ↑<span className="visually-hidden">{t("find_previous")}</span>
        </button>
        <button type="button" onClick={() => go(1)} disabled={!matches.length} title={t("find_next")}>
          ↓<span className="visually-hidden">{t("find_next")}</span>
        </button>
      </div>
      <div className="find-row">
        <input
          placeholder={t("replace_placeholder")}
          aria-label={t("replace_placeholder")}
          value={replacement}
          onChange={(event) => setReplacement(event.target.value)}
        />
        <button type="button" onClick={replaceCurrent} disabled={disabled || !matches.length}>
          {t("replace_one")}
        </button>
        <button type="button" onClick={replaceEverything} disabled={disabled || !matches.length}>
          {t("replace_all")}
        </button>
      </div>
      <div className="find-options">
        <label>
          <input type="checkbox" checked={options.matchCase} onChange={() => toggle("matchCase")} />
          {t("match_case")}
        </label>
        <label>
          <input type="checkbox" checked={options.wholeWord} onChange={() => toggle("wholeWord")} />
          {t("whole_word")}
        </label>
        {message && <span className="success">{message}</span>}
      </div>
    </section>
  );
}
