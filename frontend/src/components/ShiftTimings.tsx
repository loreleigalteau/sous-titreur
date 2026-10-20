import { useState } from "react";
import { useI18n } from "../i18n";

interface Props {
  disabled: boolean;
  /** `fromCurrent`: only the current subtitle and the ones after it. */
  onShift: (seconds: number, fromCurrent: boolean) => void;
}

export function ShiftTimings({ disabled, onShift }: Props) {
  const { t } = useI18n();
  const [seconds, setSeconds] = useState("0.5");
  const [fromCurrent, setFromCurrent] = useState(false);
  // Accept a comma as decimal separator, as typed in French.
  const value = Number(seconds.replace(",", "."));
  const valid = seconds.trim() !== "" && Number.isFinite(value) && value !== 0;

  return (
    <details className="shift-timings">
      <summary>{t("shift_title")}</summary>
      <div className="shift-form">
        <label className="field">
          <span>{t("shift_amount")}</span>
          <input inputMode="decimal" value={seconds} onChange={(event) => setSeconds(event.target.value)} />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={fromCurrent} onChange={(event) => setFromCurrent(event.target.checked)} />
          {t("shift_from_current")}
        </label>
        <button type="button" disabled={disabled || !valid} onClick={() => onShift(value, fromCurrent)}>
          {t("shift_apply")}
        </button>
      </div>
    </details>
  );
}
