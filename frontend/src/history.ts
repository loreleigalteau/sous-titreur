/**
 * Undo / redo.
 *
 * The whole document (subtitles + style) is kept as immutable snapshots: undo
 * goes back to the previous snapshot. Unchanged subtitles are shared between
 * snapshots, so this costs little memory.
 *
 * Changes of the same kind made in quick succession (typing in one subtitle,
 * dragging a slider) are grouped into a single undo step.
 */
import type { Segment, Style } from "./types";

export interface Doc {
  segments: Segment[];
  style: Style;
}

export interface HistoryState {
  past: Doc[];
  present: Doc;
  future: Doc[];
  /** Increases with every change, undo and redo: used to trigger saving. */
  revision: number;
  lastKey: string | null;
  lastTime: number;
}

export type HistoryAction =
  | { type: "apply"; update: (doc: Doc) => Doc; key?: string; time: number }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; doc: Doc };

const MAX_STEPS = 200;
const GROUP_WITHIN_MS = 1000;

export function initialHistory(doc: Doc): HistoryState {
  return { past: [], present: doc, future: [], revision: 0, lastKey: null, lastTime: 0 };
}

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "apply": {
      const next = action.update(state.present);
      if (next === state.present) return state;
      const grouped =
        action.key !== undefined &&
        action.key === state.lastKey &&
        action.time - state.lastTime < GROUP_WITHIN_MS;
      return {
        past: grouped ? state.past : [...state.past, state.present].slice(-MAX_STEPS),
        present: next,
        future: [],
        revision: state.revision + 1,
        lastKey: action.key ?? null,
        lastTime: action.time,
      };
    }
    case "undo": {
      if (state.past.length === 0) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
        revision: state.revision + 1,
        lastKey: null,
        lastTime: 0,
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      return {
        past: [...state.past, state.present],
        present: state.future[0],
        future: state.future.slice(1),
        revision: state.revision + 1,
        lastKey: null,
        lastTime: 0,
      };
    }
    case "reset":
      // A new document from the server (e.g. after a transcription): nothing
      // to undo, nothing to save.
      return { ...initialHistory(action.doc), revision: state.revision };
  }
}
