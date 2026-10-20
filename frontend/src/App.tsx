import { useEffect, useState } from "react";
import { api } from "./api";
import { registerFonts } from "./fonts";
import { Home } from "./components/Home";
import { ProjectView } from "./components/ProjectView";
import { I18nProvider, initialLanguage, MESSAGES, type Language } from "./i18n";
import type { Config } from "./types";

/**
 * The current screen is stored in the URL hash ("#/project/<id>"), so that
 * reloading the page or using the browser's back button keeps working
 * without a routing library.
 */
function useHashRoute(): string {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

export function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [language, setLanguage] = useState<Language | null>(null);
  const [failed, setFailed] = useState(false);
  const hash = useHashRoute();

  useEffect(() => {
    api
      .config()
      .then((config) => {
        registerFonts(config.fonts);
        setConfig(config);
        setLanguage(initialLanguage(config.ui_language));
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    // No server, so no server language: use the browser's.
    return <p className="page">{MESSAGES[initialLanguage()].server_unreachable}</p>;
  }
  if (!config || !language) return null;

  const projectId = hash.match(/^#\/project\/([0-9a-f]+)$/)?.[1];
  return (
    <I18nProvider initial={language}>
      {projectId ? <ProjectView key={projectId} projectId={projectId} config={config} /> : <Home />}
    </I18nProvider>
  );
}
