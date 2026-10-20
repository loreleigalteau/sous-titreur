/** Subtitle length choices, in maximum characters (null: Whisper's whole sentences). */
export const LENGTHS = {
  short: 20,
  medium: 32,
  long: 42,
  none: null,
} as const;

export type LengthKey = keyof typeof LENGTHS;
export const LENGTH_KEYS = Object.keys(LENGTHS) as LengthKey[];

/** Short subtitles suit vertical videos (TikTok, Reels), standard ones the others. */
export function defaultLength(vertical: boolean): LengthKey {
  return vertical ? "short" : "long";
}
