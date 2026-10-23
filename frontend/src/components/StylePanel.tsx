import type { ReactNode } from "react";
import { useI18n } from "../i18n";
import type { FontInfo, Style } from "../types";
import { PresetPicker } from "./PresetPicker";
import { Slider } from "./Slider";

interface Props {
  style: Style;
  fonts: FontInfo[];
  defaultStyle: Style;
  /** `key` groups quick successive changes of one control into one undo step. */
  onChange: (change: Partial<Style>, key: string) => void;
}

// Text colours offered in one click (any other one can be picked).
const TEXT_COLORS = [
  ["color_white", "#ffffff"],
  ["color_yellow", "#ffff00"],
  ["color_orange", "#ff9500"],
  ["color_red", "#ff3b30"],
  ["color_pink", "#ff2d95"],
  ["color_purple", "#a855f7"],
  ["color_cyan", "#00d4ff"],
  ["color_green", "#34c759"],
  ["color_black", "#000000"],
] as const;

// Size of the spoken word when "bigger" is ticked (1 = same size).
const BIGGER_WORD = 1.2;

// Vertical positions offered as buttons (the subtitle can also be dragged).
const POSITIONS = { position_top: 0.15, position_middle: 0.5, position_bottom: 0.83 } as const;

export function StylePanel({ style, fonts, defaultStyle, onChange }: Props) {
  const { t } = useI18n();

  const slider = (field: keyof Style, label: string, min: number, max: number, step: number) => (
    <Field label={label}>
      <Slider
        min={min}
        max={max}
        step={step}
        value={style[field] as number}
        onChange={(value) => onChange({ [field]: value }, field)}
      />
    </Field>
  );

  const color = (field: keyof Style, label: string) => (
    <Field label={label}>
      <input
        type="color"
        value={style[field] as string}
        onChange={(event) => onChange({ [field]: event.target.value }, field)}
      />
    </Field>
  );

  return (
    <section className="panel style-panel">
      <h2>{t("style_title")}</h2>
      <PresetPicker style={style} onApply={(preset) => onChange(preset, "preset")} />
      <div className="style-grid">
        <Field label={t("style_font")}>
          <select
            value={style.font}
            style={{ fontFamily: `"${style.font}"` }}
            onChange={(event) => onChange({ font: event.target.value }, "font")}
          >
            {fonts.map((font) => (
              <option key={font.name} value={font.name} style={{ fontFamily: `"${font.name}"` }}>
                {font.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={style.bold}
            onChange={(event) => onChange({ bold: event.target.checked }, "bold")}
          />
          {t("style_bold")}
        </label>
        {slider("size", t("style_size"), 0.02, 0.12, 0.001)}
        <div className="field text-color">
          <span>{t("style_text_color")}</span>
          <div className="text-color-row">
            <input
              type="color"
              aria-label={t("style_text_color")}
              value={style.text_color}
              onChange={(event) => onChange({ text_color: event.target.value }, "text_color")}
            />
            <div className="swatches" role="group" aria-label={t("preset_colors")}>
              {TEXT_COLORS.map(([name, value]) => (
                <button
                  key={value}
                  type="button"
                  className="swatch"
                  style={{ background: value }}
                  title={t(name)}
                  aria-label={t(name)}
                  aria-pressed={style.text_color.toLowerCase() === value}
                  onClick={() => onChange({ text_color: value }, "text_color")}
                />
              ))}
            </div>
          </div>
        </div>
        {color("outline_color", t("style_outline_color"))}
        {slider("outline_width", t("style_outline_width"), 0, 0.015, 0.0005)}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={style.background}
            onChange={(event) => onChange({ background: event.target.checked }, "background")}
          />
          {t("style_background")}
        </label>
        {style.background && (
          <>
            {color("background_color", t("style_background_color"))}
            {slider("background_opacity", t("style_background_opacity"), 0.1, 1, 0.05)}
          </>
        )}
        {slider("max_width", t("style_max_width"), 0.4, 1, 0.01)}
      </div>

      <h3 className="style-subtitle">{t("style_word_by_word")}</h3>
      <div className="style-grid">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={style.highlight}
            onChange={(event) => onChange({ highlight: event.target.checked }, "highlight")}
          />
          {t("style_highlight")}
        </label>
        {style.highlight && (
          <>
            {color("highlight_color", t("style_highlight_color"))}
            <label className="checkbox">
              <input
                type="checkbox"
                checked={style.highlight_scale > 1}
                onChange={(event) =>
                  onChange({ highlight_scale: event.target.checked ? BIGGER_WORD : 1 }, "highlight_scale")
                }
              />
              {t("style_highlight_bigger")}
            </label>
          </>
        )}
        <Field label={t("style_max_words")}>
          <select
            value={style.max_words}
            onChange={(event) => onChange({ max_words: Number(event.target.value) }, "max_words")}
          >
            <option value={0}>{t("style_max_words_all")}</option>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="style-position">
        <span>{t("style_position")}</span>
        {Object.entries(POSITIONS).map(([key, y]) => (
          <button key={key} type="button" onClick={() => onChange({ x: 0.5, y }, "position")}>
            {t(key as keyof typeof POSITIONS)}
          </button>
        ))}
      </div>
      <p className="hint">{t("drag_hint")}</p>

      <button type="button" className="link-button" onClick={() => onChange({ ...defaultStyle }, "reset")}>
        {t("style_reset")}
      </button>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
