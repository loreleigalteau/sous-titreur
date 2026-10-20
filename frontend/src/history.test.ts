import { describe, expect, it } from "vitest";
import { historyReducer, initialHistory, type Doc } from "./history";
import type { Style } from "./types";

const style = { font: "Montserrat" } as Style;
const doc = (text: string): Doc => ({ segments: [{ id: 1, start: 0, end: 1, text, words: [] }], style });
const setText = (text: string) => (d: Doc) => ({ ...d, segments: [{ ...d.segments[0], text }] });

describe("history", () => {
  it("undoes and redoes", () => {
    let state = initialHistory(doc("a"));
    state = historyReducer(state, { type: "apply", update: setText("b"), time: 0 });
    state = historyReducer(state, { type: "apply", update: setText("c"), time: 5000 });
    state = historyReducer(state, { type: "undo" });
    expect(state.present.segments[0].text).toBe("b");
    state = historyReducer(state, { type: "undo" });
    expect(state.present.segments[0].text).toBe("a");
    state = historyReducer(state, { type: "undo" }); // nothing more to undo
    expect(state.present.segments[0].text).toBe("a");
    state = historyReducer(state, { type: "redo" });
    expect(state.present.segments[0].text).toBe("b");
  });

  it("groups quick changes with the same key", () => {
    let state = initialHistory(doc(""));
    for (const [i, text] of ["B", "Bo", "Bon"].entries()) {
      state = historyReducer(state, { type: "apply", update: setText(text), key: "text-1", time: i * 100 });
    }
    expect(state.past).toHaveLength(1);
    state = historyReducer(state, { type: "undo" });
    expect(state.present.segments[0].text).toBe("");
  });

  it("does not group changes far apart or of different kinds", () => {
    let state = initialHistory(doc(""));
    state = historyReducer(state, { type: "apply", update: setText("a"), key: "text-1", time: 0 });
    state = historyReducer(state, { type: "apply", update: setText("b"), key: "text-1", time: 2000 });
    state = historyReducer(state, { type: "apply", update: setText("c"), key: "text-2", time: 2100 });
    expect(state.past).toHaveLength(3);
  });

  it("a new change clears the redo list", () => {
    let state = initialHistory(doc("a"));
    state = historyReducer(state, { type: "apply", update: setText("b"), time: 0 });
    state = historyReducer(state, { type: "undo" });
    state = historyReducer(state, { type: "apply", update: setText("c"), time: 5000 });
    expect(state.future).toHaveLength(0);
  });

  it("counts revisions for saving, except on reset", () => {
    let state = initialHistory(doc("a"));
    state = historyReducer(state, { type: "apply", update: setText("b"), time: 0 });
    state = historyReducer(state, { type: "undo" });
    expect(state.revision).toBe(2);
    state = historyReducer(state, { type: "reset", doc: doc("z") });
    expect(state.revision).toBe(2);
    expect(state.past).toHaveLength(0);
  });

  it("ignores updates that change nothing", () => {
    const state = initialHistory(doc("a"));
    expect(historyReducer(state, { type: "apply", update: (d) => d, time: 0 })).toBe(state);
  });
});
