import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api";
import { download } from "../download";
import { useI18n } from "../i18n";
import { startVideoExport } from "../renderExport";
import type { Segment, Style } from "../types";

interface Props {
  projectId: string;
  segments: Segment[];
  style: Style;
  videoSize: { width: number; height: number } | null;
  /** Saves pending edits; resolves to false if saving failed. */
  saveNow: () => Promise<boolean>;
}

type Format = "srt" | "vtt" | "ass";

/** Progress of a video export, shown in a dialog. */
type Phase =
  | { step: "preparing"; done: number; total: number }
  | { step: "encoding"; progress: number }
  | { step: "done" }
  | { step: "error"; message: string };

const POLL_INTERVAL_MS = 1000;


export function ExportMenu({ projectId, segments, style, videoSize, saveNow }: Props) {
  const { t, language } = useI18n();
  const [phase, setPhase] = useState<Phase | null>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  // Set when the dialog is closed or the page left: stops following the export.
  const stopped = useRef(false);
  useEffect(() => () => void (stopped.current = true), []);

  const closeMenu = () => menu.current?.removeAttribute("open");

  const exportFile = async (format: Format) => {
    closeMenu();
    // Save first, so the file contains the latest edits.
    if (await saveNow()) await download(api.exportUrl(projectId, format, language));
  };

  const exportVideo = async () => {
    if (!videoSize) return;
    closeMenu();
    stopped.current = false;
    const update = (next: Phase) => !stopped.current && setPhase(next);
    update({ step: "preparing", done: 0, total: segments.length });
    try {
      // The export uses the subtitles and style as they are at this moment.
      await startVideoExport(projectId, segments, style, videoSize, (done, total) =>
        update({ step: "preparing", done, total }),
      );
      while (!stopped.current) {
        const status = await api.renderStatus(projectId, language);
        if (status.status === "done") {
          update({ step: "done" });
          void download(api.renderFileUrl(projectId));
          return;
        }
        if (status.status === "error") {
          update({ step: "error", message: status.error ?? "" });
          return;
        }
        update({ step: "encoding", progress: status.progress });
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (err) {
      const busy = err instanceof ApiError && err.status === 409;
      update({
        step: "error",
        message: busy ? t("job_busy") : t("error_generic", { details: (err as Error).message }),
      });
    }
  };

  const closeDialog = () => {
    stopped.current = true;
    setPhase(null);
  };

  const disabled = segments.length === 0;
  return (
    <>
      <details className="menu" ref={menu}>
        <summary className={disabled ? "disabled" : undefined}>{t("export_menu")} ▾</summary>
        {!disabled && (
          <div className="menu-items">
            <button type="button" className="primary" disabled={!videoSize} onClick={exportVideo}>
              {t("export_mp4")}
            </button>
            <button type="button" onClick={() => exportFile("srt")}>
              {t("export_srt")}
            </button>
            <button type="button" onClick={() => exportFile("vtt")}>
              {t("export_vtt")}
            </button>
            <button type="button" onClick={() => exportFile("ass")} title={t("export_ass_hint")}>
              {t("export_ass")}
            </button>
          </div>
        )}
      </details>

      {phase && (
        <div className="dialog-backdrop">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
            <h2 id="export-title">{t("render_title")}</h2>
            {phase.step === "preparing" && (
              <>
                <progress value={phase.total ? phase.done / phase.total : undefined} max={1} />
                <p>{t("render_preparing", { current: phase.done, total: phase.total })}</p>
                <p className="hint">{t("render_keep_open")}</p>
              </>
            )}
            {phase.step === "encoding" && (
              <>
                <progress value={phase.progress} max={1} />
                <p>{t("render_encoding", { percent: Math.round(phase.progress * 100) })}</p>
              </>
            )}
            {phase.step === "done" && (
              <>
                <p className="success">{t("render_done")}</p>
                <button
                  type="button"
                  className="primary"
                  onClick={() => void download(api.renderFileUrl(projectId))}
                >
                  {t("render_download")}
                </button>
              </>
            )}
            {phase.step === "error" && <p className="error">{phase.message}</p>}
            <div className="dialog-actions">
              <button type="button" onClick={closeDialog}>
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
