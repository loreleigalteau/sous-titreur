/** Display and parsing of subtitle times (in seconds). */

/** Format seconds as "MM:SS.mmm", or "H:MM:SS.mmm" from one hour. */
export function formatTime(seconds: number): string {
  // Integer milliseconds avoid rounding issues such as "00:59.1000".
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const secs = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (n: number, size = 2) => String(n).padStart(size, "0");
  const base = `${pad(minutes)}:${pad(secs)}.${pad(ms, 3)}`;
  return hours > 0 ? `${hours}:${base}` : base;
}

/**
 * Parse a time typed by the user. Accepts "62.5", "1:02.5", "01:02,500",
 * "1:00:00"… Returns null if the text is not a valid time.
 */
export function parseTime(text: string): number | null {
  const parts = text.trim().replace(",", ".").split(":");
  if (parts.length > 3) return null;
  // Only the last part (seconds) may have decimals.
  const valid = parts.every((part, i) =>
    i === parts.length - 1 ? /^\d+(\.\d+)?$/.test(part) : /^\d+$/.test(part),
  );
  if (!valid) return null;
  return parts.reduce((total, part) => total * 60 + Number(part), 0);
}
