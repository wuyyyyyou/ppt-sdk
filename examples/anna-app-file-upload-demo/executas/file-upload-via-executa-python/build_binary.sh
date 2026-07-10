#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENTRY_POINT="file_upload_via_executa_plugin.py"
BINARY_NAME="file-upload"
VENV_DIR="$SCRIPT_DIR/.venv"
PYTHON_BIN="$VENV_DIR/bin/python"
BUILD_DIR="$SCRIPT_DIR/.build"
PYINSTALLER_DIR="$BUILD_DIR/pyinstaller"
PYINSTALLER_WORK_DIR="$PYINSTALLER_DIR/work"
PYINSTALLER_DIST_DIR="$PYINSTALLER_DIR/dist"
PYINSTALLER_SPEC_DIR="$PYINSTALLER_DIR/spec"
RELEASE_STAGE_DIR="$BUILD_DIR/release-stage"
TEST_EXTRACT_DIR="$BUILD_DIR/test-extract"
BUNDLE_DIR="$SCRIPT_DIR/bundle"
RUN_TEST=false

read_executa_value() {
  local key="$1"
  python3 -c 'import json, sys; print(json.load(open("executa.json", encoding="utf-8"))[sys.argv[1]])' "$key"
}

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

detect_platform_key() {
  local os
  local arch
  os="$(uname -s)"
  arch="$(uname -m)"

  if [[ "$os" == "Darwin" && "$arch" == "x86_64" ]]; then
    echo "darwin-x86_64"
    return 0
  fi

  echo "This diagnostic build script currently supports only darwin-x86_64; got $os/$arch." >&2
  return 1
}

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required but was not found in PATH." >&2
  exit 1
fi

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "Missing demo virtual environment Python: $PYTHON_BIN" >&2
  echo "Restore the copied .venv or install executa-sdk into a Python environment before building." >&2
  exit 1
fi

PLUGIN_VERSION="$(read_executa_value version)"
PLATFORM_KEY="$(detect_platform_key)"
ARCHIVE_NAME="${BINARY_NAME}-v${PLUGIN_VERSION}-${PLATFORM_KEY}.tar.gz"
ARCHIVE_PATH="$BUNDLE_DIR/$ARCHIVE_NAME"
STAGED_BINARY_PATH="$RELEASE_STAGE_DIR/$BINARY_NAME"

echo "[1/6] Ensuring build dependency..."
if ! "$PYTHON_BIN" -c 'import PyInstaller' >/dev/null 2>&1; then
  uv pip install --python "$PYTHON_BIN" "pyinstaller>=6.0.0"
fi
"$PYTHON_BIN" -c 'import executa_sdk' >/dev/null

echo "[2/6] Cleaning previous build outputs..."
rm -rf "$PYINSTALLER_DIR" "$RELEASE_STAGE_DIR" "$TEST_EXTRACT_DIR"
mkdir -p "$PYINSTALLER_WORK_DIR" "$PYINSTALLER_DIST_DIR" "$PYINSTALLER_SPEC_DIR"
mkdir -p "$RELEASE_STAGE_DIR" "$BUNDLE_DIR"
rm -f "$ARCHIVE_PATH" "$ARCHIVE_PATH.sha256"

echo "[3/6] Building one-file Executa binary..."
"$PYTHON_BIN" -m PyInstaller \
  --clean \
  --noconfirm \
  --onefile \
  --noupx \
  --name "$BINARY_NAME" \
  --distpath "$PYINSTALLER_DIST_DIR" \
  --workpath "$PYINSTALLER_WORK_DIR" \
  --specpath "$PYINSTALLER_SPEC_DIR" \
  "$ENTRY_POINT"

BUILD_OUTPUT_PATH="$PYINSTALLER_DIST_DIR/$BINARY_NAME"
if [[ ! -f "$BUILD_OUTPUT_PATH" ]]; then
  echo "Build failed: missing $BUILD_OUTPUT_PATH" >&2
  exit 1
fi

echo "[4/6] Staging binary..."
cp "$BUILD_OUTPUT_PATH" "$STAGED_BINARY_PATH"
chmod +x "$STAGED_BINARY_PATH"
codesign --force --sign - "$STAGED_BINARY_PATH" >/dev/null 2>&1 || true

echo "[5/6] Creating archive..."
tar -C "$RELEASE_STAGE_DIR" -czf "$ARCHIVE_PATH" "$BINARY_NAME"
shasum -a 256 "$ARCHIVE_PATH" > "$ARCHIVE_PATH.sha256"

echo "[6/6] Validation"
EXPECTED_ARCHIVE_PATH="bundle/${BINARY_NAME}-v{version}-${PLATFORM_KEY}.tar.gz"
CONFIGURED_ARCHIVE_PATH="$(python3 -c 'import json, sys; d=json.load(open("executa.json", encoding="utf-8")); print(d["distribution"]["profiles"]["binary"]["binary_urls"][sys.argv[1]]["path"])' "$PLATFORM_KEY")"
if [[ "$CONFIGURED_ARCHIVE_PATH" != "$EXPECTED_ARCHIVE_PATH" ]]; then
  echo "executa.json archive path mismatch:" >&2
  echo "  expected: $EXPECTED_ARCHIVE_PATH" >&2
  echo "  actual:   $CONFIGURED_ARCHIVE_PATH" >&2
  exit 1
fi

echo "Release archive created at: $ARCHIVE_PATH"
ls -lh "$ARCHIVE_PATH" "$ARCHIVE_PATH.sha256"

if [[ "$RUN_TEST" == "true" ]]; then
  echo "Running archive and protocol smoke tests..."
  rm -rf "$TEST_EXTRACT_DIR"
  mkdir -p "$TEST_EXTRACT_DIR"
  tar -C "$TEST_EXTRACT_DIR" -xzf "$ARCHIVE_PATH"

  TEST_BINARY_PATH="$TEST_EXTRACT_DIR/$BINARY_NAME"
  if [[ ! -x "$TEST_BINARY_PATH" ]]; then
    echo "Archive validation failed: missing executable $TEST_BINARY_PATH" >&2
    exit 1
  fi

  DESCRIBE_OUTPUT="$(printf '%s\n' '{"jsonrpc":"2.0","method":"describe","id":1}' | "$TEST_BINARY_PATH" 2>/dev/null)"
  printf '%s' "$DESCRIBE_OUTPUT" | python3 -c '
import json, sys
response = json.load(sys.stdin)
manifest = response["result"]
tool_names = {tool["name"] for tool in manifest["tools"]}
assert {"make_sample", "host_upload_path"}.issubset(tool_names)
'
  echo "archive validation passed"
else
  echo "skip protocol smoke test (use --test to run it)"
fi
