/**
 * Saving a file served by the application (an export).
 *
 * In a browser it is an ordinary download. In the application window
 * (pywebview, see backend/app/desktop.py) there are no downloads: the Python
 * side shows a native "Save as…" dialog instead.
 */

interface DesktopApi {
  save: (path: string) => Promise<boolean>;
}

declare global {
  interface Window {
    /** Present only in the application window. */
    pywebview?: { api?: DesktopApi };
  }
}

/** `path` is an address of the application, such as "/api/projects/…/export/srt". */
export async function download(path: string): Promise<void> {
  const desktop = window.pywebview?.api;
  if (desktop?.save) {
    await desktop.save(path);
    return;
  }
  const link = document.createElement("a");
  link.href = path;
  link.download = "";
  link.click();
}
