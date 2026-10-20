import { memo, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { formatTime, parseTime } from "../time";
import type { Segment } from "../types";

export type SegmentPatch = Partial<Pick<Segment, "start" | "end" | "text">>;

/** Editing actions on one subtitle, identified by its index. */
export interface SegmentActions {
  onChange: (index: number, patch: SegmentPatch) => void;
  onSeek: (time: number) => void;
  /** Returns false if the text cannot be split there. */
  onSplit: (index: number, cursor: number) => boolean;
  onAddAfter: (index: number) => void;
  onMergeWithNext: (index: number) => void;
  onDelete: (index: number) => void;
}

interface ListProps {
  segments: Segment[];
  activeIndex: number;
  /** Language of the subtitles, used by the browser's spell checker. */
  language: string | null;
  disabled: boolean;
  actions: SegmentActions;
  /** Put the cursor in this subtitle's text (e.g. after a split). */
  focusRequest: { index: number; cursor: number } | null;
}

export function SegmentList({ segments, activeIndex, language, disabled, actions, focusRequest }: ListProps) {
  const { t } = useI18n();

  useEffect(() => {
    if (!focusRequest) return;
    const textarea = document.querySelector<HTMLTextAreaElement>(`textarea[data-index="${focusRequest.index}"]`);
    textarea?.focus();
    textarea?.setSelectionRange(focusRequest.cursor, focusRequest.cursor);
  }, [focusRequest]);

  if (segments.length === 0) return <p className="muted">{t("segments_empty")}</p>;
  return (
    <ol className="segment-list">
      {segments.map((segment, index) => (
        <SegmentRow
          key={segment.id}
          index={index}
          segment={segment}
          isLast={index === segments.length - 1}
          active={index === activeIndex}
          language={language}
          disabled={disabled}
          actions={actions}
        />
      ))}
    </ol>
  );
}

interface RowProps {
  index: number;
  segment: Segment;
  isLast: boolean;
  active: boolean;
  language: string | null;
  disabled: boolean;
  actions: SegmentActions;
}

/**
 * One subtitle. `memo` re-renders a row only when its own props change: with
 * hundreds of subtitles, typing in one of them stays fast.
 */
const SegmentRow = memo(function SegmentRow({ index, segment, isLast, active, language, disabled, actions }: RowProps) {
  const { t } = useI18n();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [showSplitHint, setShowSplitHint] = useState(false);
  const invalid = segment.end < segment.start;

  const split = () => {
    // The cursor position stays known after the text field loses focus.
    const ok = actions.onSplit(index, textarea.current?.selectionStart ?? 0);
    setShowSplitHint(!ok);
  };

  return (
    <li
      className={`segment${active ? " active" : ""}${invalid ? " invalid" : ""}`}
      data-index={index}
      onClick={() => actions.onSeek(segment.start)}
    >
      <div className="segment-times">
        <TimeInput
          label={t("segment_start")}
          value={segment.start}
          disabled={disabled}
          onCommit={(start) => actions.onChange(index, { start })}
        />
        <span aria-hidden>→</span>
        <TimeInput
          label={t("segment_end")}
          value={segment.end}
          disabled={disabled}
          onCommit={(end) => actions.onChange(index, { end })}
        />
        <div className="segment-actions">
          <IconButton label={t("segment_split")} disabled={disabled} onClick={split}>
            ✂
          </IconButton>
          <IconButton label={t("segment_add_after")} disabled={disabled} onClick={() => actions.onAddAfter(index)}>
            +
          </IconButton>
          <IconButton
            label={t("segment_merge")}
            disabled={disabled || isLast}
            onClick={() => actions.onMergeWithNext(index)}
          >
            ⤓
          </IconButton>
          <IconButton label={t("segment_delete")} disabled={disabled} onClick={() => actions.onDelete(index)}>
            ✕
          </IconButton>
        </div>
      </div>
      {invalid && <span className="error small">{t("end_before_start")}</span>}
      <textarea
        ref={textarea}
        aria-label={t("segment_text")}
        data-index={index}
        value={segment.text}
        // The browser underlines spelling mistakes, with the dictionary of the
        // subtitles' language when it has one installed.
        spellCheck
        lang={language ?? undefined}
        readOnly={disabled}
        rows={2}
        onChange={(event) => {
          setShowSplitHint(false);
          actions.onChange(index, { text: event.target.value });
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            split();
          } else if (event.key === "Escape") {
            // Leave the field, so that the keyboard shortcuts work again.
            event.currentTarget.blur();
          }
        }}
      />
      {showSplitHint && <p className="hint">{t("split_hint")}</p>}
    </li>
  );
});

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button type="button" className="icon-button" title={label} disabled={disabled} onClick={onClick}>
      <span aria-hidden>{children}</span>
      <span className="visually-hidden">{label}</span>
    </button>
  );
}

interface TimeInputProps {
  label: string;
  value: number;
  disabled: boolean;
  onCommit: (seconds: number) => void;
}

/**
 * Time field. The text is free while typing; it is checked when leaving the
 * field or pressing Enter, and restored if it is not a valid time.
 */
function TimeInput({ label, value, disabled, onCommit }: TimeInputProps) {
  const { t } = useI18n();
  const [text, setText] = useState(formatTime(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => setText(formatTime(value)), [value]);

  const commit = () => {
    const seconds = parseTime(text);
    if (seconds === null) {
      setInvalid(true);
      setText(formatTime(value));
      return;
    }
    setInvalid(false);
    if (seconds !== value) onCommit(seconds);
    else setText(formatTime(value));
  };

  return (
    <input
      className={`time-input${invalid ? " invalid" : ""}`}
      aria-label={label}
      title={invalid ? t("invalid_time") : label}
      value={text}
      disabled={disabled}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setText(formatTime(value));
          event.currentTarget.blur();
        }
      }}
      // Clicking in the field must not move the video.
      onClick={(event) => event.stopPropagation()}
    />
  );
}
