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

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required but was not found in PATH." >&2
  exit 1
fi

echo "[1/5] Preparing virtual environment..."
if [[ ! -f "$PYTHON_BIN" ]]; then
  uv venv "$VENV_DIR"
fi

echo "[2/5] Ensuring runtime and build dependencies..."
if ! "$PYTHON_BIN" -c "import aiohttp, annotated_types, cairosvg, lxml, PIL, pptx, pydantic, presenton_sdk_pptx_generator" >/dev/null 2>&1; then
  UV_CACHE_DIR="$UV_CACHE_DIR" uv pip install \
    --python "$PYTHON_BIN" \
    -e .
fi

if ! "$PYTHON_BIN" -m nuitka --version >/dev/null 2>&1; then
  UV_CACHE_DIR="$UV_CACHE_DIR" uv pip install \
    --python "$PYTHON_BIN" \
    nuitka \
    ordered-set
fi

PPTX_TEMPLATES_DIR="$("$PYTHON_BIN" -c "from pathlib import Path; import pptx; print((Path(pptx.__file__).resolve().parent / 'templates').as_posix())")"
CAIROSVG_VERSION_FILE="$("$PYTHON_BIN" -c "from pathlib import Path; import cairosvg; print((Path(cairosvg.__file__).resolve().parent / 'VERSION').as_posix())")"

echo "[3/5] Cleaning previous build outputs..."
rm -rf "$BUILD_DIR" "$BUNDLE_DIR"
mkdir -p "$BUILD_DIR" "$BUNDLE_DIR"
mkdir -p "$NUITKA_CACHE_DIR"

echo "[4/5] Building standalone onefile binary with Nuitka..."
NUITKA_CACHE_DIR="$NUITKA_CACHE_DIR" "$PYTHON_BIN" -m nuitka \
  --standalone \
  --onefile \
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

echo "[5/5] Validation"
echo "Binary created at: $OUTPUT_PATH"
ls -lh "$OUTPUT_PATH"

if [[ "$RUN_TEST" == "true" ]]; then
  DESCRIBE_RESULT="$(printf '%s\n' '{"jsonrpc":"2.0","method":"describe","id":1}' | "$OUTPUT_PATH" 2>/dev/null)"
  echo "$DESCRIBE_RESULT" | "$PYTHON_BIN" -c "import json,sys; data=json.load(sys.stdin); assert data['result']['name']=='presenton-pptx-generator-plugin'"

  HEALTH_RESULT="$(printf '%s\n' '{"jsonrpc":"2.0","method":"health","id":2}' | "$OUTPUT_PATH" 2>/dev/null)"
  echo "$HEALTH_RESULT" | "$PYTHON_BIN" -c "import json,sys; data=json.load(sys.stdin); assert data['result']['status']=='healthy'"

  TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/presenton-pptx-generator-binary-test.XXXXXX")"
  trap 'rm -rf "$TEST_DIR"' EXIT
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
          "shape_type": "textbox",
          "position": {
            "left": 96,
            "top": 96,
            "width": 720,
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
  echo "$INVOKE_RESULT" | "$PYTHON_BIN" -c "import json,os,sys; data=json.load(sys.stdin); assert data['result']['success'] is True; out=data['result']['data']['path']; assert os.path.isfile(out), out; assert out.endswith('.pptx'), out"

  echo "binary validation passed"
else
  echo "skip (use --test to validate describe/health/invoke)"
fi

rmdir "$BUILD_DIR" 2>/dev/null || true
rmdir "$SCRIPT_DIR/.build" 2>/dev/null || true
