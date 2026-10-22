import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { api, ApiError } from "../api";
import { useI18n } from "../i18n";
import type { ProjectSummary } from "../types";
import { InfoTip } from "./InfoTip";
import { LanguageSelect } from "./LanguageSelect";

/** Home screen: import a video, or reopen a project. */
export function Home({ projectsDir }: { projectsDir: string }) {
  const { t, tn, language } = useI18n();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [upload, setUpload] = useState<{ progress: number; abort: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    api
      .listProjects()
      .then(setProjects)
      .catch(() => setError(t("server_unreachable")));
  }, [t]);

  useEffect(refresh, [refresh]);

  const importFile = (file: File) => {
    setError(null);
    const { promise, abort } = api.uploadVideo(file, (progress) =>
      setUpload((current) => current && { ...current, progress }),
    );
    setUpload({ progress: 0, abort });
    promise
      .then((project) => {
        window.location.hash = `#/project/${project.id}`;
      })
      .catch((err: ApiError) => {
        setUpload(null);
        if (err.message !== "aborted") setError(t("error_generic", { details: err.message }));
      });
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && !upload) importFile(file);
  };

  const remove = async (project: ProjectSummary) => {
    if (!window.confirm(t("confirm_delete", { name: project.name }))) return;
    try {
      await api.deleteProject(project.id);
    } catch (err) {
      setError(t("error_generic", { details: (err as Error).message }));
    }
    refresh();
  };

  const dateFormat = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="page home">
      <header className="topbar">
        <div className="brand-block">
          <h1 className="brand">
            <img src="/logo.svg" alt="" width={36} height={36} />
            <span className="brand-name">{t("app_title")}</span>
          </h1>
          <p className="tagline">{t("app_tagline")}</p>
        </div>
        <LanguageSelect />
      </header>

      <section
        className={`dropzone${dragging ? " dragging" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <h2>{t("import_title")}</h2>
        {upload ? (
          <div className="upload-progress">
            <progress value={upload.progress} max={1} />
            <span>{t("uploading", { percent: Math.round(upload.progress * 100) })}</span>
            <button type="button" onClick={upload.abort}>
              {t("cancel")}
            </button>
          </div>
        ) : (
          <>
            <p>{t("import_hint")}</p>
            <button type="button" className="primary" onClick={() => fileInput.current?.click()}>
              {t("import_button")}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="video/*,audio/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) importFile(file);
                event.target.value = "";
              }}
            />
          </>
        )}
      </section>

      {error && <p className="error">{error}</p>}

      <section>
        <h2 className="with-info">
          {t("projects_title")}
          <InfoTip label={t("projects_location_label")}>
            {t("projects_location")}
            <code>{projectsDir}</code>
            {t("projects_location_note")}
          </InfoTip>
        </h2>
        {projects === null ? (
          <p>{t("loading")}</p>
        ) : projects.length === 0 ? (
          <p className="muted">{t("projects_empty")}</p>
        ) : (
          <ul className="project-list">
            {projects.map((project) => (
              <li key={project.id}>
                <a href={`#/project/${project.id}`} className="project-link">
                  <strong>{project.name}</strong>
                  <span className="muted">
                    {dateFormat.format(new Date(project.created_at))} ·{" "}
                    {project.segment_count > 0
                      ? tn("project_segments", project.segment_count)
                      : t("project_not_transcribed")}
                  </span>
                </a>
                <button type="button" className="danger" onClick={() => remove(project)}>
                  {t("delete")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
