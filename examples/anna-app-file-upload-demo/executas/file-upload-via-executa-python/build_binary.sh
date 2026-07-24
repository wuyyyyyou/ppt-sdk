#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENTRY_POINT="file_upload_via_executa_plugin.py"
BINARY_NAME="file-upload"
BUILD_DIR="$SCRIPT_DIR/.build"
PYINSTALLER_DIR="$BUILD_DIR/pyinstaller"
PYINSTALLER_WORK_DIR="$PYINSTALLER_DIR/work"
PYINSTALLER_DIST_DIR="$PYINSTALLER_DIR/dist"
PYINSTALLER_SPEC_DIR="$PYINSTALLER_DIR/spec"
RELEASE_STAGE_DIR="$BUILD_DIR/release-stage"
TEST_EXTRACT_DIR="$BUILD_DIR/test-extract"
BUNDLE_DIR="$SCRIPT_DIR/bundle"
BINARY_RELEASE_HELPER="$SCRIPT_DIR/scripts/binary_release.py"
SMOKE_TEST_SCRIPT="$SCRIPT_DIR/smoke_test_bundle.py"
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

  echo "This local diagnostic package supports only darwin-x86_64; got $os/$arch." >&2
  return 1
}

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required but was not found in PATH." >&2
  exit 1
fi

PLUGIN_VERSION="$(read_executa_value version)"
PLATFORM_KEY="$(detect_platform_key)"
ARCHIVE_NAME="${BINARY_NAME}-v${PLUGIN_VERSION}-${PLATFORM_KEY}.tar.gz"
ARCHIVE_PATH="$BUNDLE_DIR/$ARCHIVE_NAME"
ARCHIVE_SHA256_PATH="$ARCHIVE_PATH.sha256"
STAGED_BINARY_PATH="$RELEASE_STAGE_DIR/bin/$BINARY_NAME"

echo "[1/7] Ensuring build dependencies..."
uv sync --extra build

echo "[2/7] Cleaning previous build outputs..."
rm -rf "$PYINSTALLER_DIR" "$RELEASE_STAGE_DIR" "$TEST_EXTRACT_DIR"
mkdir -p "$PYINSTALLER_WORK_DIR" "$PYINSTALLER_DIST_DIR" "$PYINSTALLER_SPEC_DIR"
mkdir -p "$RELEASE_STAGE_DIR/bin" "$RELEASE_STAGE_DIR/lib" "$RELEASE_STAGE_DIR/data"
mkdir -p "$BUNDLE_DIR"
rm -f "$ARCHIVE_PATH" "$ARCHIVE_SHA256_PATH"

echo "[3/7] Building one-file Executa binary..."
uv run pyinstaller \
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

echo "[4/7] Staging Anna Binary package..."
cp "$BUILD_OUTPUT_PATH" "$STAGED_BINARY_PATH"
chmod +x "$STAGED_BINARY_PATH"
codesign --force --sign - "$STAGED_BINARY_PATH" >/dev/null 2>&1 || true
uv run python "$BINARY_RELEASE_HELPER" write-manifest \
  --executa-config "$SCRIPT_DIR/executa.json" \
  --binary-name "$BINARY_NAME" \
  --output "$RELEASE_STAGE_DIR/manifest.json"

echo "[5/7] Creating release archive..."
tar -C "$RELEASE_STAGE_DIR" -czf "$ARCHIVE_PATH" bin lib data manifest.json
uv run python "$BINARY_RELEASE_HELPER" write-sha256 \
  --file "$ARCHIVE_PATH" \
  --output "$ARCHIVE_SHA256_PATH"

echo "[6/7] Validating archive structure..."
EXPECTED_ARCHIVE_PATH="bundle/${BINARY_NAME}-v{version}-${PLATFORM_KEY}.tar.gz"
CONFIGURED_ARCHIVE_PATH="$(python3 -c 'import json, sys; d=json.load(open("executa.json", encoding="utf-8")); print(d["distribution"]["profiles"]["binary"]["binary_artifacts"][sys.argv[1]]["path"])' "$PLATFORM_KEY")"
if [[ "$CONFIGURED_ARCHIVE_PATH" != "$EXPECTED_ARCHIVE_PATH" ]]; then
  echo "executa.json archive path mismatch:" >&2
  echo "  expected: $EXPECTED_ARCHIVE_PATH" >&2
  echo "  actual:   $CONFIGURED_ARCHIVE_PATH" >&2
  exit 1
fi

mkdir -p "$TEST_EXTRACT_DIR"
tar -C "$TEST_EXTRACT_DIR" -xzf "$ARCHIVE_PATH"
uv run python "$BINARY_RELEASE_HELPER" verify-archive \
  --executa-config "$SCRIPT_DIR/executa.json" \
  --binary-name "$BINARY_NAME" \
  --extract-dir "$TEST_EXTRACT_DIR" \
  --platform-key "$PLATFORM_KEY"

echo "[7/7] Protocol smoke test..."
if [[ "$RUN_TEST" == "true" ]]; then
  uv run python "$SMOKE_TEST_SCRIPT" "$TEST_EXTRACT_DIR/bin/$BINARY_NAME"
  echo "protocol smoke test passed"
else
  echo "skip (use --test to run the extracted binary protocol checks)"
fi

echo "Anna Binary archive created at: $ARCHIVE_PATH"
tar -tzf "$ARCHIVE_PATH"
ls -lh "$ARCHIVE_PATH" "$ARCHIVE_SHA256_PATH"
