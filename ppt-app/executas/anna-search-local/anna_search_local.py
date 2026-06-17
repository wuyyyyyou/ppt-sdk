#!/usr/bin/env python3

from __future__ import annotations

import os
import runpy
from pathlib import Path


SHIM_DIR = Path(__file__).resolve().parent
ANNA_DIR = SHIM_DIR.parents[3]
SEARCH_DIR = ANNA_DIR / "anna-search-executa"
PLUGIN_PATH = SEARCH_DIR / "example_plugin.py"

os.chdir(SEARCH_DIR)
runpy.run_path(str(PLUGIN_PATH), run_name="__main__")
