#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PLUGIN_NAME="presenton-pptx-generator-plugin"
ENTRY_POINT="example_plugin.py"
VENV_DIR="$SCRIPT_DIR/.venv"
UV_CACHE_DIR="$SCRIPT_DIR/.uv-cache"
NUITKA_CACHE_DIR="$SCRIPT_DIR/.cache/nuitka"
BUILD_DIR="$SCRIPT_DIR/.build/nuitka"
BUNDLE_DIR="$SCRIPT_DIR/bundle"
CAIRO_RUNTIME_ROOT="$SCRIPT_DIR/src/presenton_sdk_pptx_generator/_runtime"
CAIRO_STAGING_DIR="$CAIRO_RUNTIME_ROOT/cairo"
NUITKA_PACKAGE_CONFIG="$SCRIPT_DIR/nuitka-package.config.yml"
CAIRO_RUNTIME_HELPER="$SCRIPT_DIR/prepare_cairo_runtime.py"
TEST_DIR=""
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

PLATFORM="$(detect_platform)"
if [[ "$PLATFORM" == "windows" ]]; then
  PYTHON_BIN="$VENV_DIR/Scripts/python.exe"
else
  PYTHON_BIN="$VENV_DIR/bin/python"
fi

OUTPUT_NAME="$(detect_output_name)"
BUILD_OUTPUT_PATH="$BUILD_DIR/$OUTPUT_NAME"
OUTPUT_PATH="$BUNDLE_DIR/$OUTPUT_NAME"

cleanup_generated_runtime() {
  if [[ -n "$TEST_DIR" ]]; then
    rm -rf "$TEST_DIR"
  fi
  rm -rf "$CAIRO_STAGING_DIR"
}

trap cleanup_generated_runtime EXIT

prepend_env_path() {
  local name="$1"
  local value="$2"
  local current="${!name:-}"

  if [[ -z "$current" ]]; then
    printf -v "$name" '%s' "$value"
    export "$name"
    return 0
  fi

  case "${current}${PATH_SEPARATOR:-:}" in
    *"$value${PATH_SEPARATOR:-:}"*)
      return 0
      ;;
  esac

  printf -v "$name" '%s:%s' "$value" "$current"
  export "$name"
}

run_python_with_cairo() {
  local code="$1"
  shift || true

  if [[ "$PLATFORM" == "windows" && -n "${CAIRO_RUNTIME_DIR_WINDOWS:-}" ]]; then
    "$PYTHON_BIN" -c 'import os, sys
runtime_dir = os.environ.get("CAIRO_RUNTIME_DIR_WINDOWS")
if runtime_dir and hasattr(os, "add_dll_directory"):
    os.add_dll_directory(runtime_dir)
if runtime_dir:
    os.environ["CAIROCFFI_DLL_DIRECTORIES"] = runtime_dir
exec(compile(sys.argv[1], "<inline>", "exec"))' "$code" "$@"
    return 0
  fi

  "$PYTHON_BIN" -c "$code" "$@"
}

prepare_cairo_runtime() {
  local -a cmd=("$PYTHON_BIN" "$CAIRO_RUNTIME_HELPER" --platform "$PLATFORM" --staging-dir "$CAIRO_STAGING_DIR")
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

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required but was not found in PATH." >&2
  exit 1
fi

echo "[1/6] Preparing virtual environment..."
if [[ ! -f "$PYTHON_BIN" ]]; then
  uv venv "$VENV_DIR"
fi

echo "[2/6] Preparing Cairo runtime..."
prepare_cairo_runtime

echo "[3/6] Ensuring runtime and build dependencies..."
if ! run_python_with_cairo "import aiohttp, annotated_types, cairosvg, lxml, PIL, pptx, pydantic, presenton_sdk_pptx_generator" >/dev/null 2>&1; then
  UV_CACHE_DIR="$UV_CACHE_DIR" uv pip install \
    --python "$PYTHON_BIN" \
    -e .
fi

if ! "$PYTHON_BIN" -m nuitka --version >/dev/null 2>&1; then
  UV_CACHE_DIR="$UV_CACHE_DIR" uv pip install \
    --python "$PYTHON_BIN" \
    nuitka \
    ordered-set \
    zstandard
fi

PPTX_TEMPLATES_DIR="$(run_python_with_cairo "from pathlib import Path; import pptx; print((Path(pptx.__file__).resolve().parent / 'templates').as_posix())")"
CAIROSVG_VERSION_FILE="$(run_python_with_cairo "from pathlib import Path; import cairosvg; print((Path(cairosvg.__file__).resolve().parent / 'VERSION').as_posix())")"

echo "[4/6] Cleaning previous build outputs..."
rm -rf "$BUILD_DIR" "$BUNDLE_DIR"
mkdir -p "$BUILD_DIR" "$BUNDLE_DIR"
mkdir -p "$NUITKA_CACHE_DIR"

echo "[5/6] Building standalone onefile binary with Nuitka..."
NUITKA_CACHE_DIR="$NUITKA_CACHE_DIR" "$PYTHON_BIN" -m nuitka \
  --standalone \
  --onefile \
  --disable-ccache \
  --remove-output \
  --assume-yes-for-downloads \
  --output-dir="$BUILD_DIR" \
  --output-filename="$PLUGIN_NAME" \
  --user-package-configuration-file="$NUITKA_PACKAGE_CONFIG" \
  --include-module=presenton_pptx_generator_plugin \
  --include-package=presenton_sdk_pptx_generator \
  --include-package-data=presenton_sdk_pptx_generator \
  --include-package-data=PIL \
  --include-data-dir="$PPTX_TEMPLATES_DIR=pptx/templates" \
  --include-data-file="$CAIROSVG_VERSION_FILE=cairosvg/VERSION" \
  "$ENTRY_POINT"

if [[ ! -f "$BUILD_OUTPUT_PATH" ]]; then
  echo "Build failed: missing $BUILD_OUTPUT_PATH" >&2
  exit 1
fi

cp "$BUILD_OUTPUT_PATH" "$OUTPUT_PATH"
chmod +x "$OUTPUT_PATH"
rm -f "$BUILD_OUTPUT_PATH"

if [[ "$(uname -s)" == "Darwin" ]]; then
  codesign --force --sign - "$OUTPUT_PATH" >/dev/null 2>&1 || true
fi

echo "[6/6] Validation"
echo "Binary created at: $OUTPUT_PATH"
ls -lh "$OUTPUT_PATH"

if [[ "$RUN_TEST" == "true" ]]; then
  DESCRIBE_RESULT="$(printf '%s\n' '{"jsonrpc":"2.0","method":"describe","id":1}' | "$OUTPUT_PATH" 2>/dev/null)"
  echo "$DESCRIBE_RESULT" | "$PYTHON_BIN" -c "import json,sys; data=json.load(sys.stdin); assert data['result']['name']=='presenton-pptx-generator-plugin'"

  HEALTH_RESULT="$(printf '%s\n' '{"jsonrpc":"2.0","method":"health","id":2}' | "$OUTPUT_PATH" 2>/dev/null)"
  echo "$HEALTH_RESULT" | "$PYTHON_BIN" -c "import json,sys; data=json.load(sys.stdin); assert data['result']['status']=='healthy'"

  TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/presenton-pptx-generator-binary-test.XXXXXX")"
  MODEL_PATH="$TEST_DIR/model.json"
  PPTX_PATH="$TEST_DIR/output.pptx"

  cat >"$MODEL_PATH" <<'EOF'
{
  "name": "Binary Smoke Test",
  "slides": [
    {
      "note": "Binary smoke note",
      "shapes": [
        {
          "shape_type": "picture",
          "position": {
            "left": 96,
            "top": 96,
            "width": 160,
            "height": 160
          },
          "clip": false,
          "picture": {
            "is_network": false,
            "path": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMTIwIDEyMCI+PHJlY3Qgd2lkdGg9IjEyMCIgaGVpZ2h0PSIxMjAiIHJ4PSIxNiIgZmlsbD0iIzBlYTVlOSIvPjxjaXJjbGUgY3g9IjYwIiBjeT0iNjAiIHI9IjI4IiBmaWxsPSIjZjhmYWZjIi8+PC9zdmc+"
          }
        },
        {
          "shape_type": "textbox",
          "position": {
            "left": 280,
            "top": 96,
            "width": 560,
            "height": 120
          },
          "paragraphs": [
            {
              "text": "Presenton PPTX Generator Binary Test"
            }
          ]
        }
      ]
    }
  ]
}
EOF

  INVOKE_RESULT="$(printf '%s\n' "{\"jsonrpc\":\"2.0\",\"method\":\"invoke\",\"id\":3,\"params\":{\"tool\":\"generatePptx\",\"arguments\":{\"model_path\":\"$MODEL_PATH\",\"output_path\":\"$PPTX_PATH\"}}}" | "$OUTPUT_PATH" 2>/dev/null)"
  echo "$INVOKE_RESULT" | "$PYTHON_BIN" -c "import json,os,sys; data=json.load(sys.stdin); assert data['result']['success'] is True; out=data['result']['data']['path']; assert os.path.isfile(out), out; assert out.endswith('.pptx'), out; assert os.path.getsize(out) > 0, out"

  echo "binary validation passed (including SVG to PNG conversion)"
else
  echo "skip (use --test to validate describe/health/invoke)"
fi

rmdir "$BUILD_DIR" 2>/dev/null || true
rmdir "$SCRIPT_DIR/.build" 2>/dev/null || true
