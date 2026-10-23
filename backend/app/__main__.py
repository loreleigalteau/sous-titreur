"""Start the application: local server + application window (or browser).

Usage:
    python -m app [--browser | --no-browser] [--port 8000] [--ui-lang fr]
"""

from __future__ import annotations

import argparse
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path

import uvicorn

from app.cli import make_console_safe, read_ui_language
from app.i18n import LANGUAGES, detect_language, language_from_env, set_language, t
from app.server import create_app
from app.storage import ProjectStore, default_data_dir

# Only this machine can reach the server: it is never exposed on the network.
HOST = "127.0.0.1"


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="python -m app", description=t("server_description"))
    parser.add_argument("--port", type=int, default=8000, help=t("server_help_port"))
    display = parser.add_mutually_exclusive_group()
    display.add_argument("--browser", action="store_true", help=t("server_help_browser"))
    display.add_argument("--no-browser", action="store_true", help=t("server_help_no_browser"))
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


def log_to_file(data_dir: Path) -> None:
    """In the packaged application there is no terminal: messages go to a log
    file in the data folder, useful to understand a problem afterwards."""
    log = open(data_dir / "sous-titreur.log", "a", buffering=1, encoding="utf-8")
    sys.stdout = sys.stderr = log


def run_in_browser(server: uvicorn.Server, url: str, open_browser: bool) -> None:
    print(t("server_ready", url=url), flush=True)
    print(t("server_stop_hint"), flush=True)
    if open_browser:
        threading.Thread(target=open_browser_when_ready, args=(server, url), daemon=True).start()
    server.run()  # blocks until Ctrl+C
    print(t("server_stopped"))


def main(argv: list[str] | None = None) -> int:
    make_console_safe()
    # A language chosen explicitly also applies to the interface; otherwise the
    # interface follows the system's (or browser's) language.
    chosen_language = read_ui_language(argv) or language_from_env()
    set_language(chosen_language or detect_language())
    args = parse_args(argv)

    data_dir = default_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    if getattr(sys, "frozen", False):  # packaged with PyInstaller
        log_to_file(data_dir)

    store = ProjectStore(data_dir / "projects")
    port = find_free_port(args.port)
    app = create_app(store, ui_language=chosen_language)
    server = uvicorn.Server(uvicorn.Config(app, host=HOST, port=port, log_level="warning"))

    if args.browser or args.no_browser:
        run_in_browser(server, f"http://localhost:{port}", open_browser=args.browser)
        return 0

    try:
        from app.desktop import run_window
    except Exception as error:  # e.g. no web engine available on this system
        print(t("window_unavailable", details=error), flush=True)
        run_in_browser(server, f"http://localhost:{port}", open_browser=True)
        return 0
    print(t("window_hint"), flush=True)
    run_window(server, f"http://127.0.0.1:{port}", data_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
