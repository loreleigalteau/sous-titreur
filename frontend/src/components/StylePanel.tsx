import type { ReactNode } from "react";
import { useI18n } from "../i18n";
import type { FontInfo, Style } from "../types";

interface Props {
  style: Style;
  fonts: FontInfo[];
  defaultStyle: Style;
  /** `key` groups quick successive changes of one control into one undo step. */
  onChange: (change: Partial<Style>, key: string) => void;
}

// Vertical positions offered as buttons (the subtitle can also be dragged).
const POSITIONS = { position_top: 0.15, position_middle: 0.5, position_bottom: 0.8 } as const;

export function StylePanel({ style, fonts, defaultStyle, onChange }: Props) {
  const { t } = useI18n();

  const slider = (field: keyof Style, label: string, min: number, max: number, step: number) => (
    <Field label={label}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={style[field] as number}
        onChange={(event) => onChange({ [field]: Number(event.target.value) }, field)}
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
        {color("text_color", t("style_text_color"))}
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
