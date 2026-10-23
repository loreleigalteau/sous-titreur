import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useI18n } from "../i18n";
import type { MessageKey } from "../i18n/en";
import { matchingPreset, sameStyle } from "../presets";
import type { Preset, PresetListing, Style } from "../types";

interface Props {
  style: Style;
  /** Apply a preset's style to the project (one undo step). */
  onApply: (style: Style) => void;
}

const isBuiltin = (preset: Preset) => preset.id.startsWith("builtin:");

/**
 * Choosing, saving and managing style presets, at the top of the style panel.
 * The preset marked ★ is the one new projects start with.
 */
export function PresetPicker({ style, onApply }: Props) {
  const { t } = useI18n();
  const [listing, setListing] = useState<PresetListing | null>(null);
  // The preset last chosen or saved: the target of "Update", "Rename"…
  const [chosenId, setChosenId] = useState<string | null>(null);
  // Inline name field, to save a new preset or rename one.
  const [editing, setEditing] = useState<{ mode: "create" | "rename"; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api.presets().then(setListing).catch(() => setError(t("server_unreachable")));
  }, [t]);
  useEffect(refresh, [refresh]);

  if (!listing) return null;

  const all = [...listing.builtin, ...listing.custom];
  const matched = matchingPreset(style, all, chosenId);
  const chosen = all.find((p) => p.id === (matched?.id ?? chosenId)) ?? null;
  const name = (preset: Preset) =>
    isBuiltin(preset) ? t(`preset_${preset.name}` as MessageKey) : preset.name;
  const label = (preset: Preset) => name(preset) + (preset.id === listing.default ? " ★" : "");

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(t("error_generic", { details: (err as Error).message }));
    }
    refresh();
  };

  const saveName = () =>
    run(async () => {
      if (!editing) return;
      if (editing.mode === "create") {
        const created = await api.createPreset(editing.name, style);
        setChosenId(created.id);
      } else if (chosen) {
        await api.updatePreset(chosen.id, { name: editing.name });
      }
      setEditing(null);
    });

  const remove = (preset: Preset) => {
    if (!window.confirm(t("preset_confirm_delete", { name: preset.name }))) return;
    void run(async () => {
      await api.deletePreset(preset.id);
      setChosenId(null);
    });
  };

  return (
    <div className="presets">
      <label className="field">
        <span>{t("presets_label")}</span>
        <select
          value={matched?.id ?? ""}
          onChange={(event) => {
            const preset = all.find((p) => p.id === event.target.value);
            if (!preset) return;
            setChosenId(preset.id);
            onApply({ ...preset.style });
          }}
        >
          {!matched && (
            <option value="" disabled>
              {/* Says which preset "Update" would change, if any. */}
              {chosen ? t("preset_modified", { name: name(chosen) }) : t("preset_custom_settings")}
            </option>
          )}
          <optgroup label={t("presets_builtin")}>
            {listing.builtin.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {label(preset)}
              </option>
            ))}
          </optgroup>
          {listing.custom.length > 0 && (
            <optgroup label={t("presets_mine")}>
              {listing.custom.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {label(preset)}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>

      {editing ? (
        <form
          className="preset-name"
          onSubmit={(event) => {
            event.preventDefault();
            void saveName();
          }}
        >
          <input
            autoFocus
            maxLength={60}
            placeholder={t("preset_name_placeholder")}
            aria-label={t("preset_name_placeholder")}
            value={editing.name}
            onChange={(event) => setEditing({ ...editing, name: event.target.value })}
            onKeyDown={(event) => event.key === "Escape" && setEditing(null)}
          />
          <button type="submit" className="primary" disabled={!editing.name.trim()}>
            {t("preset_save")}
          </button>
          <button type="button" onClick={() => setEditing(null)}>
            {t("cancel")}
          </button>
        </form>
      ) : (
        <div className="preset-actions">
          <button type="button" onClick={() => setEditing({ mode: "create", name: "" })}>
            {t("preset_save_as")}
          </button>
          {chosen && !isBuiltin(chosen) && (
            <>
              <button
                type="button"
                disabled={sameStyle(chosen.style, style)}
                title={t("preset_update_hint", { name: chosen.name })}
                onClick={() => void run(() => api.updatePreset(chosen.id, { style }))}
              >
                {t("preset_update")}
              </button>
              <button type="button" onClick={() => setEditing({ mode: "rename", name: chosen.name })}>
                {t("preset_rename")}
              </button>
              <button type="button" className="danger" onClick={() => remove(chosen)}>
                {t("preset_delete")}
              </button>
            </>
          )}
        </div>
      )}

      {matched &&
        (matched.id === listing.default ? (
          <p className="hint">★ {t("preset_is_default")}</p>
        ) : (
          <button
            type="button"
            className="link-button"
            onClick={() => void run(() => api.setDefaultPreset(matched.id))}
          >
            ★ {t("preset_make_default")}
          </button>
        ))}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
