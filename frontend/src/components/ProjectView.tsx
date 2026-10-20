import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { api, ApiError } from "../api";
import type { Match } from "../findReplace";
import { historyReducer, initialHistory, type Doc } from "../history";
import { useI18n } from "../i18n";
import { defaultLength, LENGTH_KEYS, LENGTHS, type LengthKey } from "../lengths";
import { insertSegment, mergeSegments, nextId, splitSegment } from "../segmentOps";
import { markAtPlayhead, nextSegmentIndex, previousSegmentIndex, shiftSegments, type Span } from "../timing";
import type { Config, Project, Segment, Style } from "../types";
import { ExportMenu } from "./ExportMenu";
import { FindReplace } from "./FindReplace";
import { LanguageSelect } from "./LanguageSelect";
import { SegmentList, type SegmentActions, type SegmentPatch } from "./SegmentList";
import { ShiftTimings } from "./ShiftTimings";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { StylePanel } from "./StylePanel";
import { Timeline } from "./Timeline";
import { TranscriptionPanel } from "./TranscriptionPanel";
import { VideoPlayer, type VideoInfo } from "./VideoPlayer";

// Edits are saved automatically this long after the last change.
const AUTOSAVE_DELAY_MS = 800;

type SaveState = "saved" | "saving" | "unsaved" | "error";

/**
 * Automatic saving of the subtitles and style.
 *
 * `revision` changes with every edit, undo or redo; each change schedules a
 * save. Saves are chained so that they reach the server in order, and the
 * latest version always wins.
 */
function useAutosave(projectId: string, doc: Doc, revision: number) {
  const [state, setState] = useState<SaveState>("saved");
  const latest = useRef({ doc, revision });
  latest.current = { doc, revision };
  const savedRevision = useRef(revision);
  const timer = useRef<number | undefined>(undefined);
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));

  const saveNow = useCallback((): Promise<boolean> => {
    window.clearTimeout(timer.current);
    chain.current = chain.current.then(async () => {
      const { doc, revision } = latest.current;
      if (revision === savedRevision.current) return true;
      setState("saving");
      try {
        await api.saveContent(projectId, doc.segments, doc.style);
        savedRevision.current = revision;
        setState(latest.current.revision === revision ? "saved" : "unsaved");
        return true;
      } catch {
        setState("error");
        return false;
      }
    });
    return chain.current;
  }, [projectId]);

  useEffect(() => {
    if (revision === savedRevision.current) return;
    setState("unsaved");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(saveNow, AUTOSAVE_DELAY_MS);
  }, [revision, saveNow]);

  // Warn before closing the tab with unsaved changes, and save when leaving
  // the project screen.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (latest.current.revision !== savedRevision.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      void saveNow();
    };
  }, [saveNow]);

  return { state, saveNow };
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && target.matches("input, textarea, select, [contenteditable]");
// Elements that react to Enter themselves.
const isInteractive = (target: EventTarget | null) =>
  isTyping(target) || (target instanceof HTMLElement && target.matches("button, summary, a"));

function scrollToRow(index: number) {
  document.querySelector(`li[data-index="${index}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

export function ProjectView({ projectId, config }: { projectId: string; config: Config }) {
  const { t } = useI18n();
  const [project, setProject] = useState<Project | null>(null);
  const [history, dispatch] = useReducer(
    historyReducer,
    initialHistory({ segments: [], style: config.default_style }),
  );
  const { segments, style } = history.present;
  const [notFound, setNotFound] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [transcribing, setTranscribing] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ index: number; cursor: number } | null>(null);
  const [recutLength, setRecutLength] = useState<LengthKey | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { state: saveState, saveNow } = useAutosave(projectId, history.present, history.revision);

  const load = useCallback(() => {
    api
      .getProject(projectId)
      .then((loaded) => {
        setProject(loaded);
        dispatch({ type: "reset", doc: { segments: loaded.segments, style: loaded.style } });
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
      });
  }, [projectId]);

  useEffect(load, [load]);

  /** Apply a change to the document; `key` groups quick changes into one undo step. */
  const apply = useCallback((update: (doc: Doc) => Doc, key?: string) => {
    dispatch({ type: "apply", update, key, time: Date.now() });
  }, []);

  const updateSegments = useCallback(
    (update: (segments: Segment[]) => Segment[], key?: string) =>
      apply((doc) => ({ ...doc, segments: update(doc.segments) }), key),
    [apply],
  );

  const changeStyle = useCallback(
    (change: Partial<Style>, key: string) => apply((doc) => ({ ...doc, style: { ...doc.style, ...change } }), `style-${key}`),
    [apply],
  );

  const seek = useCallback((time: number) => {
    if (videoRef.current) videoRef.current.currentTime = time;
  }, []);

  // Read by the callbacks below without making them change on every edit
  // (which would re-render every subtitle row).
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  const actions = useMemo<SegmentActions>(
    () => ({
      onChange: (index, patch: SegmentPatch) =>
        updateSegments(
          (list) => list.map((s, i) => (i === index ? { ...s, ...patch } : s)),
          // Typing in one subtitle is grouped into one undo step.
          `${"text" in patch ? "text" : "time"}-${segmentsRef.current[index]?.id}`,
        ),
      onSeek: seek,
      onSplit: (index, cursor) => {
        const list = segmentsRef.current;
        const parts = splitSegment(list[index], cursor, nextId(list));
        if (!parts) return false;
        updateSegments((current) => [...current.slice(0, index), ...parts, ...current.slice(index + 1)]);
        setFocusRequest({ index: index + 1, cursor: 0 });
        return true;
      },
      onAddAfter: (index) => {
        const list = segmentsRef.current;
        const [result, newIndex] = insertSegment(list, list[index].end, nextId(list));
        updateSegments(() => result);
        setFocusRequest({ index: newIndex, cursor: 0 });
      },
      onMergeWithNext: (index) =>
        updateSegments((list) =>
          index + 1 < list.length
            ? [...list.slice(0, index), mergeSegments(list[index], list[index + 1]), ...list.slice(index + 2)]
            : list,
        ),
      onDelete: (index) => updateSegments((list) => list.filter((_, i) => i !== index)),
    }),
    [updateSegments, seek],
  );

  const addAtCurrentTime = () => {
    const [result, index] = insertSegment(segments, videoRef.current?.currentTime ?? 0, nextId(segments));
    updateSegments(() => result);
    setFocusRequest({ index, cursor: 0 });
  };

  /** Show a subtitle: move the video to it and bring it into view in the list. */
  const selectSegment = useCallback(
    (index: number) => {
      const segment = segmentsRef.current[index];
      if (!segment) return;
      seek(segment.start);
      scrollToRow(index);
    },
    [seek],
  );

  const placeSegment = useCallback(
    (index: number, span: Span) =>
      updateSegments((list) =>
        list.map((s, i) => {
          if (i !== index) return s;
          // Moved as a whole: its words move with it. Resized: they stay.
          const moved = Math.abs(span.end - span.start - (s.end - s.start)) < 1e-6;
          const delta = span.start - s.start;
          const words = moved ? s.words.map((w) => ({ ...w, start: w.start + delta, end: w.end + delta })) : s.words;
          return { ...s, ...span, words };
        }),
      ),
    [updateSegments],
  );

  const shiftTimings = (seconds: number, fromCurrent: boolean) => {
    const time = videoRef.current?.currentTime ?? 0;
    const from = fromCurrent ? (activeIndex !== -1 ? activeIndex : nextSegmentIndex(segments, time)) : 0;
    if (from !== -1) updateSegments((list) => shiftSegments(list, seconds, from));
  };

  const vertical = videoInfo ? videoInfo.height > videoInfo.width : false;
  const length = recutLength ?? defaultLength(vertical);
  const recut = async () => {
    const maxChars = LENGTHS[length];
    if (maxChars === null) return;
    const result = await api.splitSegments(segments, maxChars);
    updateSegments(() => result);
  };

  // Recomputed only when the subtitles change, not on every video frame.
  const texts = useMemo(() => segments.map((s) => s.text), [segments]);

  const replaceTexts = useCallback(
    (texts: string[]) =>
      updateSegments((list) => list.map((s, i) => (s.text === texts[i] ? s : { ...s, text: texts[i] }))),
    [updateSegments],
  );

  const showMatch = useCallback(
    (match: Match) => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        `textarea[data-index="${match.segmentIndex}"]`,
      );
      textarea?.scrollIntoView({ block: "center", behavior: "smooth" });
      textarea?.focus({ preventScroll: true });
      textarea?.setSelectionRange(match.start, match.end);
      seek(segmentsRef.current[match.segmentIndex].start);
    },
    [seek],
  );

  // Keyboard shortcuts (listed in ShortcutsHelp.tsx).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const video = videoRef.current;
      const time = video?.currentTime ?? 0;
      const list = segmentsRef.current;
      if (command && key === "s") {
        event.preventDefault(); // instead of the browser's "Save page"
        void saveNow();
      } else if (command && (key === "y" || (key === "z" && event.shiftKey))) {
        event.preventDefault();
        dispatch({ type: "redo" });
      } else if (command && key === "z") {
        // Replaces the text fields' own undo, which would not know about
        // splits, merges or style changes.
        event.preventDefault();
        dispatch({ type: "undo" });
      } else if (command || event.altKey || isTyping(event.target)) {
        // Other shortcuts only apply outside the text fields.
      } else if (key === " ") {
        event.preventDefault();
        if (video) void (video.paused ? video.play() : video.pause());
      } else if (key === "arrowleft" || key === "arrowright") {
        event.preventDefault();
        const step = (event.shiftKey ? 5 : 1) * (key === "arrowleft" ? -1 : 1);
        if (video) video.currentTime = Math.max(0, time + step);
      } else if (key === "arrowup" || key === "arrowdown") {
        event.preventDefault();
        const index = key === "arrowup" ? previousSegmentIndex(list, time) : nextSegmentIndex(list, time);
        if (index !== -1) selectSegment(index);
      } else if (key === "enter" && !isInteractive(event.target)) {
        event.preventDefault();
        let index = list.findIndex((s) => time >= s.start && time < s.end);
        if (index === -1) index = nextSegmentIndex(list, time);
        if (index !== -1) setFocusRequest({ index, cursor: list[index].text.length });
      } else if (event.key === "[" || event.key === "]") {
        event.preventDefault();
        const mark = markAtPlayhead(list, time, event.key === "[" ? "start" : "end");
        if (mark) updateSegments((current) => current.map((s, i) => (i === mark.index ? { ...s, ...mark.span } : s)));
      } else if (event.key === "?") {
        event.preventDefault();
        setShowShortcuts(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveNow, selectSegment, updateSegments]);

  if (notFound) {
    return (
      <div className="page">
        <a href="#/">{t("back_to_projects")}</a>
        <p className="error">{t("project_not_found")}</p>
      </div>
    );
  }
  if (!project) return <p className="page">{t("loading")}</p>;

  const saveLabel = {
    saved: t("save_saved"),
    saving: t("save_saving"),
    unsaved: t("save_unsaved"),
    error: t("save_error"),
  }[saveState];

  return (
    <div className="editor">
      <header className="topbar">
        <a href="#/" className="back">
          {t("back_to_projects")}
        </a>
        <h1 title={project.name}>{project.name}</h1>
        {saveState === "error" ? (
          <button type="button" className="save-state error" onClick={() => void saveNow()}>
            {saveLabel}
          </button>
        ) : (
          <span className={`save-state ${saveState}`}>{saveLabel}</span>
        )}
        <div className="actions">
          <button
            type="button"
            className="icon-button"
            title={t("undo")}
            disabled={!history.past.length || transcribing}
            onClick={() => dispatch({ type: "undo" })}
          >
            ↶<span className="visually-hidden">{t("undo")}</span>
          </button>
          <button
            type="button"
            className="icon-button"
            title={t("redo")}
            disabled={!history.future.length || transcribing}
            onClick={() => dispatch({ type: "redo" })}
          >
            ↷<span className="visually-hidden">{t("redo")}</span>
          </button>
          <ExportMenu
            projectId={projectId}
            segments={segments}
            style={style}
            videoSize={videoInfo}
            saveNow={saveNow}
          />
          <button
            type="button"
            className="icon-button"
            title={t("shortcuts_button")}
            onClick={() => setShowShortcuts(true)}
          >
            ?<span className="visually-hidden">{t("shortcuts_button")}</span>
          </button>
          <LanguageSelect />
        </div>
      </header>

      <div className="editor-body">
        <div className="editor-left">
          <VideoPlayer
            ref={videoRef}
            src={api.videoUrl(projectId)}
            segments={segments}
            style={style}
            activeIndex={activeIndex}
            onActiveChange={setActiveIndex}
            onMove={(position) => changeStyle(position, "position")}
            onVideoInfo={setVideoInfo}
          />
          <StylePanel
            style={style}
            fonts={config.fonts}
            defaultStyle={config.default_style}
            onChange={changeStyle}
          />
          <TranscriptionPanel
            projectId={projectId}
            modelSizes={config.model_sizes}
            hasSegments={segments.length > 0}
            vertical={vertical}
            onRunningChange={setTranscribing}
            onDone={load}
          />
        </div>

        <div className="editor-right">
          <FindReplace texts={texts} disabled={transcribing} onShowMatch={showMatch} onReplace={replaceTexts} />
          <div className="segment-toolbar">
            <button type="button" onClick={addAtCurrentTime} disabled={transcribing}>
              + {t("add_subtitle_here")}
            </button>
            <span className="toolbar-group" title={t("recut_hint")}>
              <select
                aria-label={t("length_label")}
                value={length}
                onChange={(event) => setRecutLength(event.target.value as LengthKey)}
              >
                {LENGTH_KEYS.filter((key) => LENGTHS[key] !== null).map((key) => (
                  <option key={key} value={key}>
                    {t(`length_${key}`)}
                  </option>
                ))}
              </select>
              <button type="button" onClick={recut} disabled={transcribing || !segments.length}>
                {t("recut")}
              </button>
            </span>
            <ShiftTimings disabled={transcribing || !segments.length} onShift={shiftTimings} />
          </div>
          <h2 className="visually-hidden">{t("segments_title")}</h2>
          <SegmentList
            segments={segments}
            activeIndex={activeIndex}
            language={project.language}
            disabled={transcribing}
            actions={actions}
            focusRequest={focusRequest}
          />
        </div>
      </div>

      <Timeline
        projectId={projectId}
        video={videoInfo ? videoRef.current : null}
        duration={videoInfo?.duration ?? 0}
        segments={segments}
        activeIndex={activeIndex}
        disabled={transcribing}
        onChange={placeSegment}
        onSelect={selectSegment}
      />
      {showShortcuts && <ShortcutsHelp onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}
