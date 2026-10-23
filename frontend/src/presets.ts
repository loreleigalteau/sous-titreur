/** Recognising which preset the current style corresponds to. */
import type { Preset, Style } from "./types";

/** Same settings? Numbers from sliders and dragging are compared with a tiny tolerance. */
export function sameStyle(a: Style, b: Style): boolean {
  return (Object.keys(a) as (keyof Style)[]).every((key) => {
    const x = a[key];
    const y = b[key];
    return typeof x === "number" && typeof y === "number" ? Math.abs(x - y) < 1e-9 : x === y;
  });
}

/**
 * The preset whose settings are exactly the current ones, if any. The preset
 * the user last chose wins when several match; then the user's own presets.
 */
export function matchingPreset(style: Style, presets: Preset[], preferredId: string | null): Preset | null {
  const matches = presets.filter((preset) => sameStyle(preset.style, style));
  return (
    matches.find((p) => p.id === preferredId) ??
    matches.find((p) => !p.id.startsWith("builtin:")) ??
    matches[0] ??
    null
  );
}
