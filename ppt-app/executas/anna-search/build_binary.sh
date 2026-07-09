#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENTRY_POINT="example_plugin.py"
BINARY_NAME="anna-search-executa"
WINDOWS_BINARY_NAME="${BINARY_NAME}.exe"
BUILD_DIR="$SCRIPT_DIR/.build"
PYINSTALLER_BUILD_DIR="$BUILD_DIR/pyinstaller"
PYINSTALLER_WORK_DIR="$PYINSTALLER_BUILD_DIR/work"
PYINSTALLER_DIST_DIR="$PYINSTALLER_BUILD_DIR/dist"
PYINSTALLER_SPEC_DIR="$PYINSTALLER_BUILD_DIR/spec"
RELEASE_STAGE_DIR="$BUILD_DIR/release-stage"
TEST_EXTRACT_DIR="$BUILD_DIR/test-extract"
BUNDLE_DIR="$SCRIPT_DIR/bundle"
BINARY_RELEASE_HELPER="$SCRIPT_DIR/scripts/binary_release.py"
EMBED_MANIFEST_HELPER="$SCRIPT_DIR/scripts/embed_manifest.py"
EMBEDDED_MANIFEST_MODULE="$SCRIPT_DIR/src/anna_search_executa/_embedded_manifest.py"
SMOKE_TEST_SCRIPT="$SCRIPT_DIR/smoke_test_bundle.py"
RUN_TEST=false

read_manifest_value() {
  local key="$1"

  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json, sys; print(json.load(open("manifest.json", encoding="utf-8"))[sys.argv[1]])' "$key"
    return 0
  fi

  python -c 'import json, sys; print(json.load(open("manifest.json", encoding="utf-8"))[sys.argv[1]])' "$key"
}

PLUGIN_VERSION="$(read_manifest_value version)"

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
    Linux) echo "linux" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) echo "other" ;;
  esac
}

detect_arch() {
  local arch
  arch="$(uname -m)"

  case "$arch" in
    x86_64|amd64) echo "x86_64" ;;
    arm64|aarch64) echo "arm64" ;;
    *)
      echo "Unsupported architecture for Anna Binary packaging: $arch" >&2
      return 1
      ;;
  esac
}

detect_platform_key() {
  local platform="$1"
  local arch="$2"

  case "$platform:$arch" in
    darwin:x86_64) echo "darwin-x86_64" ;;
    darwin:arm64) echo "darwin-arm64" ;;
    linux:x86_64) echo "linux-x86_64" ;;
    linux:arm64) echo "linux-aarch64" ;;
    windows:x86_64) echo "windows-x86_64" ;;
    windows:arm64) echo "windows-arm64" ;;
    *)
      echo "Unsupported platform for Anna Binary packaging: $platform:$arch" >&2
      return 1
      ;;
  esac
}

detect_output_name() {
  if [[ "$PLATFORM" == "windows" ]]; then
    echo "$WINDOWS_BINARY_NAME"
  else
    echo "$BINARY_NAME"
  fi
}

find_powershell() {
  if command -v pwsh >/dev/null 2>&1; then
    command -v pwsh
    return 0
  fi

  if command -v powershell.exe >/dev/null 2>&1; then
    command -v powershell.exe
    return 0
  fi

  return 1
}

to_windows_path() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$1"
    return 0
  fi

  printf '%s\n' "$1"
}

compress_zip() {
  local stage_dir="$1"
  local archive_path="$2"
  local powershell_bin

  powershell_bin="$(find_powershell)"
  if [[ -z "$powershell_bin" ]]; then
    echo "PowerShell is required to create zip archives on Windows." >&2
    return 1
  fi

  STAGE_DIR_WIN="$(to_windows_path "$stage_dir")" \
  ARCHIVE_PATH_WIN="$(to_windows_path "$archive_path")" \
    "$powershell_bin" -NoProfile -Command '
      $ErrorActionPreference = "Stop"
      Add-Type -AssemblyName System.IO.Compression
      Add-Type -AssemblyName System.IO.Compression.FileSystem

      $stageDir = [System.IO.Path]::GetFullPath($env:STAGE_DIR_WIN).TrimEnd("\", "/")
      $archivePath = [System.IO.Path]::GetFullPath($env:ARCHIVE_PATH_WIN)
      if (Test-Path -LiteralPath $archivePath) {
        Remove-Item -LiteralPath $archivePath -Force
      }

      $archive = [System.IO.Compression.ZipFile]::Open($archivePath, [System.IO.Compression.ZipArchiveMode]::Create)
      try {
        foreach ($dirName in @("bin", "lib", "data")) {
          $dirPath = Join-Path $stageDir $dirName
          if (-not (Test-Path -LiteralPath $dirPath -PathType Container)) {
            throw "Missing staged directory: $dirPath"
          }
          [void]$archive.CreateEntry("$dirName/")
        }

        foreach ($file in Get-ChildItem -LiteralPath $stageDir -File -Recurse) {
          $filePath = [System.IO.Path]::GetFullPath($file.FullName)
          $relativePath = $filePath.Substring($stageDir.Length).TrimStart("\", "/").Replace("\", "/")
          $entry = $archive.CreateEntry($relativePath, [System.IO.Compression.CompressionLevel]::Optimal)
          $entryStream = $entry.Open()
          $fileStream = [System.IO.File]::OpenRead($filePath)
          try {
            $fileStream.CopyTo($entryStream)
          } finally {
            $fileStream.Dispose()
            $entryStream.Dispose()
          }
        }
      } finally {
        $archive.Dispose()
      }
    '
}

extract_zip() {
  local archive_path="$1"
  local extract_dir="$2"
  local powershell_bin

  powershell_bin="$(find_powershell)"
  if [[ -z "$powershell_bin" ]]; then
    echo "PowerShell is required to extract zip archives on Windows." >&2
    return 1
  fi

  ARCHIVE_PATH_WIN="$(to_windows_path "$archive_path")" \
  EXTRACT_DIR_WIN="$(to_windows_path "$extract_dir")" \
    "$powershell_bin" -NoProfile -Command 'Expand-Archive -LiteralPath $env:ARCHIVE_PATH_WIN -DestinationPath $env:EXTRACT_DIR_WIN -Force'
}

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required but was not found in PATH." >&2
  exit 1
fi

PLATFORM="$(detect_platform)"
ARCH="$(detect_arch)"
PLATFORM_KEY="$(detect_platform_key "$PLATFORM" "$ARCH")"
OUTPUT_NAME="$(detect_output_name)"
OUTPUT_PATH="$RELEASE_STAGE_DIR/bin/$OUTPUT_NAME"
ARCHIVE_EXT="tar.gz"
if [[ "$PLATFORM" == "windows" ]]; then
  ARCHIVE_EXT="zip"
fi
ARCHIVE_NAME="${BINARY_NAME}-v${PLUGIN_VERSION}-${PLATFORM_KEY}.${ARCHIVE_EXT}"
ARCHIVE_PATH="$BUNDLE_DIR/$ARCHIVE_NAME"

echo "[1/7] Ensuring runtime and build dependencies..."
uv sync --extra build

echo "[2/7] Cleaning previous build outputs..."
rm -rf "$BUNDLE_DIR" "$PYINSTALLER_BUILD_DIR" "$RELEASE_STAGE_DIR" "$TEST_EXTRACT_DIR"
mkdir -p "$BUNDLE_DIR" "$PYINSTALLER_WORK_DIR" "$PYINSTALLER_DIST_DIR" "$PYINSTALLER_SPEC_DIR"
mkdir -p "$RELEASE_STAGE_DIR/bin" "$RELEASE_STAGE_DIR/lib" "$RELEASE_STAGE_DIR/data"

echo "[3/7] Embedding tool manifest..."
uv run python "$EMBED_MANIFEST_HELPER" \
  --manifest "$SCRIPT_DIR/manifest.json" \
  --output "$EMBEDDED_MANIFEST_MODULE"

echo "[4/7] Building one-file binary with PyInstaller..."
uv run pyinstaller \
  --clean \
  --noconfirm \
  --onefile \
  --name "$BINARY_NAME" \
  --paths "$SCRIPT_DIR/src" \
  --distpath "$PYINSTALLER_DIST_DIR" \
  --workpath "$PYINSTALLER_WORK_DIR" \
  --specpath "$PYINSTALLER_SPEC_DIR" \
  "$ENTRY_POINT"

BUILD_OUTPUT_PATH="$PYINSTALLER_DIST_DIR/$OUTPUT_NAME"
if [[ ! -f "$BUILD_OUTPUT_PATH" ]]; then
  echo "Build failed: missing $BUILD_OUTPUT_PATH" >&2
  exit 1
fi

echo "[5/7] Staging Anna Binary distribution package..."
cp "$BUILD_OUTPUT_PATH" "$OUTPUT_PATH"
chmod +x "$OUTPUT_PATH" || true
uv run python "$BINARY_RELEASE_HELPER" write-manifest \
  --tool-manifest "$SCRIPT_DIR/manifest.json" \
  --binary-name "$BINARY_NAME" \
  --output "$RELEASE_STAGE_DIR/manifest.json"

echo "[6/7] Creating release archive..."
if [[ "$PLATFORM" == "windows" ]]; then
  compress_zip "$RELEASE_STAGE_DIR" "$ARCHIVE_PATH"
else
  tar -C "$RELEASE_STAGE_DIR" -czf "$ARCHIVE_PATH" bin lib data manifest.json
fi
uv run python "$BINARY_RELEASE_HELPER" write-sha256 \
  --file "$ARCHIVE_PATH" \
  --output "$ARCHIVE_PATH.sha256"

echo "[7/7] Validation"
echo "Release archive created at: $ARCHIVE_PATH"
ls -lh "$ARCHIVE_PATH" "$ARCHIVE_PATH.sha256"

if [[ "$RUN_TEST" == "true" ]]; then
  echo "Validating release archive..."
  rm -rf "$TEST_EXTRACT_DIR"
  mkdir -p "$TEST_EXTRACT_DIR"
  if [[ "$PLATFORM" == "windows" ]]; then
    extract_zip "$ARCHIVE_PATH" "$TEST_EXTRACT_DIR"
  else
    tar -C "$TEST_EXTRACT_DIR" -xzf "$ARCHIVE_PATH"
  fi

  uv run python "$BINARY_RELEASE_HELPER" verify-archive \
    --tool-manifest "$SCRIPT_DIR/manifest.json" \
    --binary-name "$BINARY_NAME" \
    --extract-dir "$TEST_EXTRACT_DIR" \
    --platform-key "$PLATFORM_KEY"

  TEST_BINARY_PATH="$TEST_EXTRACT_DIR/bin/$OUTPUT_NAME"
  chmod +x "$TEST_BINARY_PATH" || true
  uv run python "$SMOKE_TEST_SCRIPT" "$TEST_BINARY_PATH"
  echo "archive validation passed"
else
  echo "skip (use --test to validate release archive)"
fi
