#!/usr/bin/env python3

from __future__ import annotations

import os
import runpy
from pathlib import Path


SHIM_DIR = Path(__file__).resolve().parent
REPO_ROOT = SHIM_DIR.parents[2]
GENERATOR_DIR = REPO_ROOT / "presenton-pptx-generator"
PLUGIN_PATH = GENERATOR_DIR / "example_plugin.py"

os.chdir(GENERATOR_DIR)
runpy.run_path(str(PLUGIN_PATH), run_name="__main__")
