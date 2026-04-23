#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PLUGIN_NAME="tool-lightvoss_5433-ppt-gener-w7g2hnsn"
ENTRY_POINT="example_plugin.py"
VENV_DIR="$SCRIPT_DIR/.venv"
UV_CACHE_DIR="$SCRIPT_DIR/.uv-cache"
NUITKA_CACHE_DIR="$SCRIPT_DIR/.cache/nuitka"
BUILD_DIR="$SCRIPT_DIR/.build/nuitka"
BUNDLE_DIR="$SCRIPT_DIR/bundle"
CAIRO_RUNTIME_HELPER="$SCRIPT_DIR/prepare_cairo_runtime.py"
SMOKE_TEST_SCRIPT="$SCRIPT_DIR/smoke_test_bundle.py"
RUN_TEST=false

for arg in "$@"; do
  case "$arg" in
    --test) RUN_TEST=true ;;
    --help|-h)
      echo "Usage: $0 [--test]"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

detect_platform() {
  local os
  os="$(uname -s)"

  case "$os" in
    Darwin) echo "darwin" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) echo "other" ;;
  esac
}

detect_output_name() {
  if [[ "$PLATFORM" == "windows" ]]; then
    echo "${PLUGIN_NAME}.exe"
  else
    echo "${PLUGIN_NAME}"
  fi
}

prepend_env_path() {
  local name="$1"
  local value="$2"
  local current="${!name:-}"

  if [[ -z "$current" ]]; then
    printf -v "$name" '%s' "$value"
    export "$name"
    return 0
  fi

  case ":$current:" in
    *":$value:"*)
      return 0
      ;;
  esac

  printf -v "$name" '%s:%s' "$value" "$current"
  export "$name"
}

PLATFORM="$(detect_platform)"
if [[ "$PLATFORM" == "windows" ]]; then
  PYTHON_BIN="$VENV_DIR/Scripts/python.exe"
else
  PYTHON_BIN="$VENV_DIR/bin/python"
fi

OUTPUT_NAME="$(detect_output_name)"
BUNDLE_ROOT="$BUNDLE_DIR/$PLUGIN_NAME"
OUTPUT_PATH="$BUNDLE_ROOT/$OUTPUT_NAME"

run_python_with_cairo() {
  local code="$1"
  shift || true

  if [[ "$PLATFORM" == "windows" && -n "${CAIRO_RUNTIME_DIR_WINDOWS:-}" ]]; then
    "$PYTHON_BIN" -c 'import ctypes, os, sys
runtime_dir = os.environ.get("CAIRO_RUNTIME_DIR_WINDOWS")
dll_handles = []
if runtime_dir:
    current_path = os.environ.get("PATH")
    if current_path:
        parts = current_path.split(os.pathsep)
        if runtime_dir not in parts:
            os.environ["PATH"] = os.pathsep.join([runtime_dir, current_path])
    else:
        os.environ["PATH"] = runtime_dir
    os.environ["CAIROCFFI_DLL_DIRECTORIES"] = runtime_dir
    if hasattr(os, "add_dll_directory"):
        dll_handles.append(os.add_dll_directory(runtime_dir))
    cairo_dll = os.path.join(runtime_dir, "libcairo-2.dll")
    if os.path.isfile(cairo_dll):
        dll_handles.append(ctypes.WinDLL(cairo_dll))
exec(compile(sys.argv[1], "<inline>", "exec"))' "$code" "$@"
    return $?
  fi

  "$PYTHON_BIN" -c "$code" "$@"
}

discover_cairo_runtime() {
  local -a cmd=("$PYTHON_BIN" "$CAIRO_RUNTIME_HELPER" --platform "$PLATFORM" --discover-only)
  local helper_output

  if [[ -n "${CAIRO_RUNTIME_DIR:-}" ]]; then
    cmd+=(--runtime-dir "$CAIRO_RUNTIME_DIR")
  fi

  helper_output="$("${cmd[@]}")"
  eval "$helper_output"

  case "$PLATFORM" in
    darwin)
      export CAIROCFFI_DLL_DIRECTORIES="$CAIRO_RUNTIME_DIR_FOR_IMPORTS"
      prepend_env_path DYLD_FALLBACK_LIBRARY_PATH "$CAIRO_RUNTIME_DIR_FOR_IMPORTS"
      ;;
    windows)
      export CAIRO_RUNTIME_DIR_WINDOWS="$CAIRO_RUNTIME_DIR_FOR_IMPORTS"
      ;;
  esac
}

stage_bundled_cairo_runtime() {
  local -a cmd=("$PYTHON_BIN" "$CAIRO_RUNTIME_HELPER" --platform "$PLATFORM" --staging-dir "$BUNDLE_ROOT/cairo")

  if [[ -n "${CAIRO_RUNTIME_DIR:-}" ]]; then
    cmd+=(--runtime-dir "$CAIRO_RUNTIME_DIR")
  fi

  "${cmd[@]}" >/dev/null
}

find_build_dist_dir() {
  local -a candidates=()

  shopt -s nullglob
  candidates=("$BUILD_DIR"/*.dist)
  shopt -u nullglob

  if [[ ${#candidates[@]} -ne 1 ]]; then
    echo "Expected exactly one Nuitka dist directory in $BUILD_DIR, found ${#candidates[@]}" >&2
    return 1
  fi

  printf '%s\n' "${candidates[0]}"
}

codesign_bundle_if_needed() {
  local target

  if [[ "$PLATFORM" != "darwin" ]]; then
    return 0
  fi

  shopt -s nullglob
  for target in "$BUNDLE_ROOT"/cairo/*.dylib "$OUTPUT_PATH"; do
    [[ -f "$target" ]] || continue
    codesign --force --sign - "$target" >/dev/null 2>&1 || true
  done
  shopt -u nullglob
}

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required but was not found in PATH." >&2
  exit 1
fi

echo "[1/6] Preparing virtual environment..."
if [[ ! -f "$PYTHON_BIN" ]]; then
  uv venv "$VENV_DIR"
fi

echo "[2/6] Discovering Cairo runtime..."
discover_cairo_runtime

echo "[3/6] Ensuring runtime and build dependencies..."
if ! run_python_with_cairo "import aiohttp, annotated_types, cairosvg, lxml, PIL, pptx, pydantic, presenton_sdk_pptx_generator" >/dev/null 2>&1; then
  UV_CACHE_DIR="$UV_CACHE_DIR" uv pip install \
    --python "$PYTHON_BIN" \
    -e .
fi

run_python_with_cairo "import aiohttp, annotated_types, cairosvg, lxml, PIL, pptx, pydantic, presenton_sdk_pptx_generator" >/dev/null

if ! "$PYTHON_BIN" -m nuitka --version >/dev/null 2>&1; then
  UV_CACHE_DIR="$UV_CACHE_DIR" uv pip install \
    --python "$PYTHON_BIN" \
    nuitka \
    ordered-set
fi

if ! PPTX_TEMPLATES_DIR="$(run_python_with_cairo "from pathlib import Path; import pptx; print((Path(pptx.__file__).resolve().parent / 'templates').as_posix())")"; then
  echo "Failed to locate python-pptx templates after dependency installation." >&2
  exit 1
fi

if [[ -z "$PPTX_TEMPLATES_DIR" ]]; then
  echo "Resolved python-pptx templates path is empty." >&2
  exit 1
fi

if ! CAIROSVG_VERSION_FILE="$(run_python_with_cairo "from pathlib import Path; import cairosvg; print((Path(cairosvg.__file__).resolve().parent / 'VERSION').as_posix())")"; then
  echo "Failed to locate CairoSVG version file after dependency installation." >&2
  exit 1
fi

if [[ -z "$CAIROSVG_VERSION_FILE" ]]; then
  echo "Resolved CairoSVG version file path is empty." >&2
  exit 1
fi

echo "[4/6] Cleaning previous build outputs..."
rm -rf "$BUILD_DIR" "$BUNDLE_DIR"
mkdir -p "$BUILD_DIR" "$BUNDLE_DIR" "$NUITKA_CACHE_DIR"

echo "[5/6] Building standalone bundle with Nuitka..."
NUITKA_CACHE_DIR="$NUITKA_CACHE_DIR" "$PYTHON_BIN" -m nuitka \
  --standalone \
  --disable-ccache \
  --remove-output \
  --assume-yes-for-downloads \
  --output-dir="$BUILD_DIR" \
  --output-filename="$PLUGIN_NAME" \
  --include-module=presenton_pptx_generator_plugin \
  --include-package=presenton_sdk_pptx_generator \
  --include-package-data=presenton_sdk_pptx_generator \
  --include-package-data=PIL \
  --include-data-dir="$PPTX_TEMPLATES_DIR=pptx/templates" \
  --include-data-file="$CAIROSVG_VERSION_FILE=cairosvg/VERSION" \
  "$ENTRY_POINT"

BUILD_DIST_DIR="$(find_build_dist_dir)"
BUILD_OUTPUT_PATH="$BUILD_DIST_DIR/$OUTPUT_NAME"
if [[ ! -f "$BUILD_OUTPUT_PATH" ]]; then
  echo "Build failed: missing $BUILD_OUTPUT_PATH" >&2
  exit 1
fi

mkdir -p "$BUNDLE_ROOT"
cp -R "$BUILD_DIST_DIR"/. "$BUNDLE_ROOT"/
stage_bundled_cairo_runtime
chmod +x "$OUTPUT_PATH"
codesign_bundle_if_needed

echo "[6/6] Validation"
echo "Bundle created at: $BUNDLE_ROOT"
ls -lah "$BUNDLE_ROOT"

if [[ "$RUN_TEST" == "true" ]]; then
  "$PYTHON_BIN" "$SMOKE_TEST_SCRIPT" "$OUTPUT_PATH"
fi
