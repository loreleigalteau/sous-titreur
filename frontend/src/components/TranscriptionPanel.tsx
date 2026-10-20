import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { useI18n } from "../i18n";
import type { MessageKey } from "../i18n/en";
import { defaultLength, LENGTH_KEYS, LENGTHS, type LengthKey } from "../lengths";
import type { TranscriptionStatus } from "../types";

// Languages offered in the list. Whisper knows many more; these are the most
// common. Their names are shown in the interface language by the browser.
const SPOKEN_LANGUAGES = ["fr", "en", "es", "de", "it", "pt", "nl", "pl", "ru", "uk", "ar", "tr", "hi", "zh", "ja", "ko"];

const POLL_INTERVAL_MS = 1000;

interface Props {
  projectId: string;
  modelSizes: string[];
  hasSegments: boolean;
  /** Orientation of the video, once known: sets the default subtitle length. */
  vertical: boolean;
  /** Called with true while a transcription runs, then false. */
  onRunningChange: (running: boolean) => void;
  /** Called when a transcription has finished successfully. */
  onDone: () => void;
}

export function TranscriptionPanel({ projectId, modelSizes, hasSegments, vertical, onRunningChange, onDone }: Props) {
  const { t, language } = useI18n();
  const [model, setModel] = useState("small");
  const [spokenLanguage, setSpokenLanguage] = useState(""); // "" = auto-detect
  const [chosenLength, setLength] = useState<LengthKey | null>(null);
  const length = chosenLength ?? defaultLength(vertical);
  const [status, setStatus] = useState<TranscriptionStatus | null>(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const running = status !== null && !["idle", "done", "error"].includes(status.status);

  // If a transcription is already running (e.g. after a page reload), follow it.
  // A finished one is ignored: its result is already in the subtitles.
  useEffect(() => {
    api.transcriptionStatus(projectId, language).then((current) => {
      if (["idle", "done", "error"].includes(current.status)) return;
      setStatus(current);
      setPolling(true);
    });
    // Only on opening the project, not when the interface language changes.
  }, [projectId]);

  // Polling: ask the server for progress every second. Simpler than a
  // permanent connection (Server-Sent Events) and just as good at this pace.
  useEffect(() => {
    if (!polling) return;
    const timer = window.setInterval(async () => {
      try {
        const current = await api.transcriptionStatus(projectId, language);
        setStatus(current);
        if (current.status === "done" || current.status === "error") {
          setPolling(false);
          if (current.status === "done") onDone();
        }
      } catch {
        setError(t("server_unreachable"));
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [polling, projectId, language, onDone, t]);

  useEffect(() => onRunningChange(running), [running, onRunningChange]);

  const start = async () => {
    if (hasSegments && !window.confirm(t("confirm_transcribe_again"))) return;
    setError(null);
    try {
      await api.startTranscription(projectId, model, spokenLanguage || null, LENGTHS[length]);
      setStatus({ status: "extracting", progress: 0, error: null });
      setPolling(true);
    } catch (err) {
      const busy = err instanceof ApiError && err.status === 409;
      setError(busy ? t("job_busy") : t("error_generic", { details: (err as Error).message }));
    }
  };

  const languageNames = new Intl.DisplayNames([language], { type: "language" });
  const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase(language) + text.slice(1);

  const form = (
    <div className="transcription-form">
      <label>
        {t("model_label")}
        <select value={model} onChange={(event) => setModel(event.target.value)} disabled={running}>
          {modelSizes.map((size) => (
            <option key={size} value={size}>
              {t(`model_${size}` as MessageKey)}
            </option>
          ))}
        </select>
      </label>
      <p className="hint">{t("model_hint")}</p>
      <label>
        {t("spoken_language_label")}
        <select
          value={spokenLanguage}
          onChange={(event) => setSpokenLanguage(event.target.value)}
          disabled={running}
        >
          <option value="">{t("spoken_language_auto")}</option>
          {SPOKEN_LANGUAGES.map((code) => (
            <option key={code} value={code}>
              {capitalize(languageNames.of(code) ?? code)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("length_label")}
        <select value={length} onChange={(event) => setLength(event.target.value as LengthKey)} disabled={running}>
          {LENGTH_KEYS.map((key) => (
            <option key={key} value={key}>
              {t(`length_${key}`)}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="primary" onClick={start} disabled={running}>
        {t("start_transcription")}
      </button>
    </div>
  );

  return (
    <section className="panel transcription">
      <h2>{t("transcribe_title")}</h2>
      {hasSegments && !running ? (
        <details>
          <summary>{t("transcribe_again")}</summary>
          <p className="hint">{t("transcribe_again_warning")}</p>
          {form}
        </details>
      ) : (
        form
      )}

      {running && status && <StatusLine status={status} />}
      {status?.status === "done" && <p className="success">{t("status_done")}</p>}
      {status?.status === "error" && status.error && <p className="error">{status.error}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function StatusLine({ status }: { status: TranscriptionStatus }) {
  const { t } = useI18n();
  const percent = Math.round(status.progress * 100);
  const label =
    status.status === "transcribing"
      ? t("status_transcribing", { percent })
      : t(`status_${status.status}` as MessageKey);
  return (
    <div className="status-line" role="status">
      {/* Without a value, <progress> shows an "in progress" animation. */}
      <progress value={status.status === "transcribing" ? status.progress : undefined} max={1} />
      <span>{label}</span>
      <p className="hint">{t("transcription_running_notice")}</p>
    </div>
  );
}
