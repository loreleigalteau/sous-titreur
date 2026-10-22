# Third-party components

Sous-titreur is free software under the GNU General Public License v3.0 or
later (see `LICENSE`). The packaged application also contains the following
components, each under its own licence, all compatible with the GPL v3.

## Programs and models

| Component | Licence | Notes |
|---|---|---|
| FFmpeg | GNU GPL v2 or later (built with `--enable-gpl`) | Audio extraction and video export. Shipped through imageio-ffmpeg; its exact build configuration is in `licenses/ffmpeg-build.txt`. Source code: https://ffmpeg.org/download.html |
| Whisper "small" model | MIT | Speech recognition model by OpenAI (https://github.com/openai/whisper), in the CTranslate2 format published by Systran (https://huggingface.co/Systran/faster-whisper-small). |
| Silero VAD | MIT | Voice activity detection, shipped with faster-whisper. |
| Montserrat, Poppins, Roboto, Bebas Neue, Anton, Pacifico | SIL Open Font License 1.1 | Licences in `app/fonts/OFL-*.txt`. |
| Python | Python Software Foundation License | The Python interpreter, packaged by PyInstaller (GPL with an exception allowing the distribution of packaged programs). |

## Python libraries

| Library | Licence |
|---|---|
| faster-whisper | MIT |
| CTranslate2 | MIT |
| PyAV | BSD-3-Clause (contains FFmpeg libraries under the LGPL / GPL) |
| imageio-ffmpeg | BSD-2-Clause |
| pywebview | BSD-3-Clause |
| ONNX Runtime | MIT |
| tokenizers, huggingface_hub | Apache-2.0 |
| NumPy | BSD-3-Clause (and compatible licences) |
| FastAPI, Pydantic | MIT |
| Starlette, Uvicorn | BSD-3-Clause |
| tqdm | MPL-2.0 and MIT |
| PyObjC (macOS) / pythonnet (Windows) | MIT |

## Web interface libraries

| Library | Licence |
|---|---|
| React | MIT |
| wavesurfer.js | BSD-3-Clause |

The full text of each licence is in the corresponding project's source code
and distribution.
