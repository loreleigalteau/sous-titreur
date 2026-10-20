"""Start the application: local server + browser.

Usage:
    python -m app [--port 8000] [--no-browser] [--ui-lang fr]
"""

from __future__ import annotations

import argparse
import socket
import sys
import threading
import time
import webbrowser

import uvicorn

from app.cli import read_ui_language
from app.i18n import LANGUAGES, detect_language, language_from_env, set_language, t
from app.server import create_app
from app.storage import ProjectStore, default_data_dir

# Only this machine can reach the server: it is never exposed on the network.
HOST = "127.0.0.1"


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="python -m app", description=t("server_description"))
    parser.add_argument("--port", type=int, default=8000, help=t("server_help_port"))
    parser.add_argument("--no-browser", action="store_true", help=t("server_help_no_browser"))
    parser.add_argument("--ui-lang", choices=LANGUAGES, help=t("cli_help_ui_lang"))
    return parser.parse_args(argv)


def find_free_port(preferred: int, attempts: int = 20) -> int:
    """Return `preferred` if it is free, otherwise the next free port.

    If none is free, `preferred` is returned and the server will report the error.
    """
    for port in range(preferred, preferred + attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind((HOST, port))
                return port
            except OSError:
                continue
    return preferred


def open_browser_when_ready(server: uvicorn.Server, url: str) -> None:
    while not server.started:
        if server.should_exit:
            return
        time.sleep(0.1)
    webbrowser.open(url)


def main(argv: list[str] | None = None) -> int:
    # A language chosen explicitly also applies to the web interface; otherwise
    # the interface follows the browser's language.
    chosen_language = read_ui_language(argv) or language_from_env()
    set_language(chosen_language or detect_language())
    args = parse_args(argv)

    store = ProjectStore(default_data_dir() / "projects")
    port = find_free_port(args.port)
    app = create_app(store, ui_language=chosen_language)
    server = uvicorn.Server(uvicorn.Config(app, host=HOST, port=port, log_level="warning"))
    url = f"http://localhost:{port}"

    print(t("server_ready", url=url), flush=True)
    print(t("server_stop_hint"), flush=True)
    if not args.no_browser:
        threading.Thread(target=open_browser_when_ready, args=(server, url), daemon=True).start()

    server.run()  # blocks until Ctrl+C
    print(t("server_stopped"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
