#!/usr/bin/env python3

from __future__ import annotations

import ctypes
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
_WINDOWS_DLL_HANDLES: list[object] = []
_LOADED_SHARED_LIBRARIES: list[object] = []


def _resolve_cairo_runtime_dir() -> Path | None:
    candidates = [
        Path(sys.executable).resolve().parent / "cairo",
        ROOT / "cairo",
    ]

    seen = set()
    for candidate in candidates:
        key = str(candidate)
        if key in seen:
            continue
        seen.add(key)
        if candidate.is_dir():
            return candidate

    return None


def _prepend_env_path(name: str, value: str) -> None:
    current = os.environ.get(name)
    if not current:
        os.environ[name] = value
        return

    parts = current.split(os.pathsep)
    if value in parts:
        return

    os.environ[name] = os.pathsep.join([value, current])


def _load_shared_libraries(paths: list[Path]) -> None:
    pending = list(dict.fromkeys(path for path in paths if path.is_file()))
    last_error: OSError | None = None

    while pending:
        next_pending: list[Path] = []
        loaded_count = 0
        for library in pending:
            try:
                _LOADED_SHARED_LIBRARIES.append(
                    ctypes.CDLL(str(library), mode=getattr(ctypes, "RTLD_GLOBAL", 0))
                )
                loaded_count += 1
            except OSError as error:
                last_error = error
                next_pending.append(library)

        if loaded_count == 0:
            raise last_error or OSError("Failed to load bundled shared libraries")
        pending = next_pending


def _bootstrap_cairo_runtime() -> None:
    cairo_runtime_dir = _resolve_cairo_runtime_dir()
    if cairo_runtime_dir is None:
        return

    runtime_dir = str(cairo_runtime_dir)
    os.environ.setdefault("CAIROCFFI_DLL_DIRECTORIES", runtime_dir)

    if sys.platform == "win32":
        _prepend_env_path("PATH", runtime_dir)
        if hasattr(os, "add_dll_directory"):
            _WINDOWS_DLL_HANDLES.append(os.add_dll_directory(runtime_dir))

        cairo_dll = cairo_runtime_dir / "libcairo-2.dll"
        if cairo_dll.is_file():
            _LOADED_SHARED_LIBRARIES.append(ctypes.WinDLL(str(cairo_dll)))
        return

    if sys.platform == "darwin":
        _prepend_env_path("DYLD_FALLBACK_LIBRARY_PATH", runtime_dir)
        dylibs = sorted(cairo_runtime_dir.glob("*.dylib"))
        _load_shared_libraries(dylibs)
        return

    if sys.platform.startswith("linux"):
        _prepend_env_path("LD_LIBRARY_PATH", runtime_dir)
        shared_libraries = sorted(cairo_runtime_dir.glob("*.so*"))
        _load_shared_libraries(shared_libraries)


_bootstrap_cairo_runtime()

if SRC.is_dir() and str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from presenton_pptx_generator_plugin import main


if __name__ == "__main__":
    main()
