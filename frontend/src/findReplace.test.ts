import { describe, expect, it } from "vitest";
import { findMatches, replaceAll, replaceMatch } from "./findReplace";

const anyCase = { matchCase: false, wholeWord: false };

describe("findMatches", () => {
  it("finds every occurrence across segments", () => {
    expect(findMatches(["un chat, deux chats", "pas ici", "Chat"], "chat", anyCase)).toEqual([
      { segmentIndex: 0, start: 3, end: 7 },
      { segmentIndex: 0, start: 14, end: 18 },
      { segmentIndex: 2, start: 0, end: 4 },
    ]);
  });

  it("respects match case", () => {
    const matches = findMatches(["Chat chat"], "chat", { matchCase: true, wholeWord: false });
    expect(matches).toEqual([{ segmentIndex: 0, start: 5, end: 9 }]);
  });

  it("ignores case of accented letters", () => {
    expect(findMatches(["ÉTÉ"], "été", anyCase)).toHaveLength(1);
  });

  it("matches whole words, including accented ones", () => {
    const options = { matchCase: false, wholeWord: true };
    expect(findMatches(["chat chats achat"], "chat", options)).toHaveLength(1);
    // With "\b", the "é" would be seen as a word boundary and "té" would match.
    expect(findMatches(["été"], "té", options)).toHaveLength(0);
    expect(findMatches(["l'été, enfin"], "été", options)).toHaveLength(1);
  });

  it("treats the query literally", () => {
    expect(findMatches(["a.b axb (c)"], "a.b", anyCase)).toHaveLength(1);
    expect(findMatches(["(c)"], "(c)", anyCase)).toHaveLength(1);
  });

  it("returns nothing for an empty query", () => {
    expect(findMatches(["abc"], "", anyCase)).toEqual([]);
  });
});

describe("replace", () => {
  it("replaces one match", () => {
    expect(replaceMatch("un chat", { segmentIndex: 0, start: 3, end: 7 }, "chien")).toBe("un chien");
  });

  it("replaces all matches and counts them", () => {
    const input = ["Whisper whisper", "rien"];
    const result = replaceAll(input, "whisper", "Wispr", anyCase);
    expect(result).toEqual({ texts: ["Wispr Wispr", "rien"], count: 2 });
    expect(input).toEqual(["Whisper whisper", "rien"]); // input untouched
  });

  it("inserts the replacement literally", () => {
    expect(replaceAll(["prix"], "prix", "$& 5 $1", anyCase).texts).toEqual(["$& 5 $1"]);
  });
});
