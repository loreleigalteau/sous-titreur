"""The application window.

The interface is the same web page as in a browser, shown in a native window
by pywebview, which uses the web engine already built into the system
(WebKit on macOS, Edge WebView2 on Windows): nothing heavy to ship, and the
window feels like an ordinary application. Closing it quits the application.
"""

from __future__ import annotations

import shutil
import threading
import time
import urllib.request
from email.message import Message
from pathlib import Path
from urllib.parse import unquote

import uvicorn
import webview

TITLE = "Sous-titreur"


def filename_from_disposition(header: str) -> str | None:
    """File name proposed by the server in a Content-Disposition header."""
    message = Message()
    message["Content-Disposition"] = header
    # Our server sends filename*=UTF-8''<encoded name> (accents included).
    name = message.get_param("filename*", header="Content-Disposition")
    if isinstance(name, tuple):  # (charset, language, value)
        return unquote(name[2], encoding=name[0] or "utf-8")
    if name:
        return unquote(name.split("''", 1)[-1])
    return message.get_filename()


class DesktopApi:
    """Functions the web page can call through `window.pywebview.api`.

    Only `save` is public. pywebview exposes every public attribute of this
    object to the page, so the others start with an underscore.
    """

    def __init__(self, base_url: str) -> None:
        self._base_url = base_url
        self._window: webview.Window | None = None

    def save(self, path: str) -> bool:
        """Save a file served by the application (an export) where the user chooses.

        In a browser this is an ordinary download; a window has no downloads,
        so a native "Save as…" dialog is shown instead. Returns False if the
        user cancelled.
        """
        assert self._window is not None
        with urllib.request.urlopen(self._base_url + path) as response:
            name = filename_from_disposition(response.headers.get("Content-Disposition", "")) or "export"
            chosen = self._window.create_file_dialog(webview.FileDialog.SAVE, save_filename=name)
            if not chosen:
                return False
            target = chosen if isinstance(chosen, str) else chosen[0]
            with open(target, "wb") as file:
                shutil.copyfileobj(response, file, 1024 * 1024)  # streamed: videos can be big
        return True


def run_window(server: uvicorn.Server, url: str, data_dir: Path) -> None:
    """Start the server in the background, show the window, stop when it closes."""
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    while not server.started:
        if not thread.is_alive():
            raise RuntimeError("The local server could not start")
        time.sleep(0.05)

    api = DesktopApi(url)
    api._window = webview.create_window(
        TITLE,
        url,
        js_api=api,
        width=1400,
        height=900,
        min_size=(900, 600),
        text_select=True,  # pywebview disables text selection by default
    )
    # Not private: the page's own storage (e.g. the chosen language) is kept
    # between launches, in the application's data folder.
    webview.start(private_mode=False, storage_path=str(data_dir / "webview"))

    server.should_exit = True
    thread.join(timeout=5)
