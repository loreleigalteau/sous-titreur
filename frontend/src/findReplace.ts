/**
 * Find and replace across all subtitles.
 *
 * These functions work on plain arrays of texts and never modify their input,
 * which keeps them easy to test.
 */

export interface FindOptions {
  matchCase: boolean;
  wholeWord: boolean;
}

export interface Match {
  segmentIndex: number;
  start: number; // position in the segment text
  end: number;
}

/** Build the search pattern, or null for an empty query. */
export function buildPattern(query: string, options: FindOptions): RegExp | null {
  if (!query) return null;
  // The query is searched literally: characters such as "." or "?" have no special meaning.
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // "\b" only understands ASCII letters, so it would split "été" or "naïve".
  // Unicode-aware lookarounds check that no letter or digit touches the match.
  const source = options.wholeWord
    ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`
    : escaped;
  return new RegExp(source, options.matchCase ? "gu" : "giu");
}

export function findMatches(texts: string[], query: string, options: FindOptions): Match[] {
  const pattern = buildPattern(query, options);
  if (!pattern) return [];
  return texts.flatMap((text, segmentIndex) =>
    Array.from(text.matchAll(pattern), (m) => ({
      segmentIndex,
      start: m.index,
      end: m.index + m[0].length,
    })),
  );
}

/** Replace one match. */
export function replaceMatch(text: string, match: Match, replacement: string): string {
  return text.slice(0, match.start) + replacement + text.slice(match.end);
}

/** Replace every match; returns the new texts and how many replacements were made. */
export function replaceAll(
  texts: string[],
  query: string,
  replacement: string,
  options: FindOptions,
): { texts: string[]; count: number } {
  const pattern = buildPattern(query, options);
  if (!pattern) return { texts, count: 0 };
  let count = 0;
  const replaced = texts.map((text) =>
    // A function as replacement inserts the text as-is ("$&" etc. are not interpreted).
    text.replace(pattern, () => {
      count += 1;
      return replacement;
    }),
  );
  return { texts: replaced, count };
}
