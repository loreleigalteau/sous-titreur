import { useEffect } from "react";
import { format, useI18n } from "../i18n";
import type { MessageKey } from "../i18n/en";

// Keys of each shortcut (the actions are in ProjectView and SegmentList).
// {name} parts are key names, translated (e.g. "Espace" in French).
const SHORTCUTS: [string, MessageKey][] = [
  ["{space}", "shortcut_play"],
  ["← / →", "shortcut_seek"],
  ["↑ / ↓", "shortcut_navigate"],
  ["{enter}", "shortcut_edit"],
  ["{escape}", "shortcut_leave"],
  ["Ctrl/⌘ + {enter}", "shortcut_split"],
  ["[ / ]", "shortcut_mark"],
  ["Ctrl/⌘ + Z / {shift} + Z", "shortcut_undo"],
  ["Ctrl/⌘ + S", "shortcut_save"],
  ["?", "shortcut_help"],
];

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const keyNames = { space: t("key_space"), enter: t("key_enter"), escape: t("key_escape"), shift: t("key_shift") };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog shortcuts"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="shortcuts-title">{t("shortcuts_title")}</h2>
        <table>
          <tbody>
            {SHORTCUTS.map(([keys, label]) => (
              <tr key={label}>
                <td>
                  <kbd>{format(keys, keyNames)}</kbd>
                </td>
                <td>{t(label)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">{t("shortcuts_note")}</p>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
