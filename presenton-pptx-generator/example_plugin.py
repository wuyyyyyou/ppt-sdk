#!/usr/bin/env python3

import ctypes
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
CAIRO_RUNTIME_DIR = ROOT / "presenton_sdk_pptx_generator" / "_runtime" / "cairo"


def _prepend_env_path(name: str, value: str) -> None:
    current = os.environ.get(name)
    if not current:
        os.environ[name] = value
        return

    parts = current.split(os.pathsep)
    if value in parts:
        return

    os.environ[name] = os.pathsep.join([value, current])


def _bootstrap_cairo_runtime() -> None:
    if not CAIRO_RUNTIME_DIR.is_dir():
        return

    runtime_dir = str(CAIRO_RUNTIME_DIR)
    os.environ.setdefault("CAIROCFFI_DLL_DIRECTORIES", runtime_dir)

    if sys.platform == "win32":
        _prepend_env_path("PATH", runtime_dir)
        if hasattr(os, "add_dll_directory"):
            os.add_dll_directory(runtime_dir)

        cairo_dll = CAIRO_RUNTIME_DIR / "libcairo-2.dll"
        if cairo_dll.is_file():
            ctypes.WinDLL(str(cairo_dll))
        return

    if sys.platform == "darwin":
        _prepend_env_path("DYLD_FALLBACK_LIBRARY_PATH", runtime_dir)
        dylibs = sorted(CAIRO_RUNTIME_DIR.glob("*.dylib"))
        for dylib in dylibs:
            ctypes.CDLL(str(dylib), mode=getattr(ctypes, "RTLD_GLOBAL", 0))


_bootstrap_cairo_runtime()

if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from presenton_pptx_generator_plugin import main


if __name__ == "__main__":
    main()
