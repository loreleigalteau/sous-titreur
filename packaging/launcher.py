"""Entry point of the packaged application (PyInstaller needs a script file)."""

import sys

from app.__main__ import main

if __name__ == "__main__":
    sys.exit(main())
