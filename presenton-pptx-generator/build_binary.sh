#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENTRY_POINT="example_plugin.py"
BINARY_NAME="ppt-gener"
WINDOWS_BINARY_NAME="${BINARY_NAME}.exe"
VENV_DIR="$SCRIPT_DIR/.venv"
UV_CACHE_DIR="$SCRIPT_DIR/.uv-cache"
NUITKA_CACHE_DIR="$SCRIPT_DIR/.cache/nuitka"
BUILD_DIR="$SCRIPT_DIR/.build"
NUITKA_BUILD_DIR="$BUILD_DIR/nuitka"
RELEASE_STAGE_DIR="$BUILD_DIR/release-stage"
TEST_EXTRACT_DIR="$BUILD_DIR/test-extract"
BUNDLE_DIR="$SCRIPT_DIR/bundle"
CAIRO_RUNTIME_HELPER="$SCRIPT_DIR/prepare_cairo_runtime.py"
BINARY_RELEASE_HELPER="$SCRIPT_DIR/scripts/binary_release.py"
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

PLUGIN_NAME="$(read_manifest_value name)"
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

detect_nuitka_output_name() {
  if [[ "$PLATFORM" == "windows" ]]; then
    echo "${PLUGIN_NAME}.exe"
  else
    echo "$PLUGIN_NAME"
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
  local staging_dir="$1"
  local -a cmd=("$PYTHON_BIN" "$CAIRO_RUNTIME_HELPER" --platform "$PLATFORM" --staging-dir "$staging_dir")

  if [[ -n "${CAIRO_RUNTIME_DIR:-}" ]]; then
    cmd+=(--runtime-dir "$CAIRO_RUNTIME_DIR")
  fi

  "${cmd[@]}" >/dev/null
}

find_build_dist_dir() {
  local -a candidates=()

  shopt -s nullglob
  candidates=("$NUITKA_BUILD_DIR"/*.dist)
  shopt -u nullglob

  if [[ ${#candidates[@]} -ne 1 ]]; then
    echo "Expected exactly one Nuitka dist directory in $NUITKA_BUILD_DIR, found ${#candidates[@]}" >&2
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
  for target in "$RELEASE_STAGE_DIR"/bin/cairo/*.dylib "$OUTPUT_PATH"; do
    [[ -f "$target" ]] || continue
    codesign --force --sign - "$target" >/dev/null 2>&1 || true
  done
  shopt -u nullglob
}

verify_macos_relocation() {
  local -a dylibs=()

  if [[ "$PLATFORM" != "darwin" ]]; then
    return 0
  fi

  shopt -s nullglob
  dylibs=("$TEST_EXTRACT_DIR"/bin/cairo/*.dylib)
  shopt -u nullglob

  if [[ ${#dylibs[@]} -eq 0 ]]; then
    echo "No bundled Cairo dylibs found in extracted archive." >&2
    return 1
  fi

  if otool -L "${dylibs[@]}" | grep -E '/usr/local|/opt/homebrew'; then
    echo "Found absolute Homebrew references in bundled Cairo dylibs." >&2
    return 1
  fi
}

run_archive_smoke_test() {
  (
    unset DYLD_LIBRARY_PATH
    unset DYLD_FALLBACK_LIBRARY_PATH
    unset CAIROCFFI_DLL_DIRECTORIES
    "$PYTHON_BIN" "$SMOKE_TEST_SCRIPT" "$TEST_BINARY_PATH"
  )
}

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required but was not found in PATH." >&2
  exit 1
fi

PLATFORM="$(detect_platform)"
ARCH="$(detect_arch)"
PLATFORM_KEY="$(detect_platform_key "$PLATFORM" "$ARCH")"
if [[ "$PLATFORM" == "windows" ]]; then
  PYTHON_BIN="$VENV_DIR/Scripts/python.exe"
else
  PYTHON_BIN="$VENV_DIR/bin/python"
fi
OUTPUT_NAME="$(detect_output_name)"
NUITKA_OUTPUT_NAME="$(detect_nuitka_output_name)"
OUTPUT_PATH="$RELEASE_STAGE_DIR/bin/$OUTPUT_NAME"
ARCHIVE_EXT="tar.gz"
if [[ "$PLATFORM" == "windows" ]]; then
  ARCHIVE_EXT="zip"
fi
ARCHIVE_NAME="${BINARY_NAME}-v${PLUGIN_VERSION}-${PLATFORM_KEY}.${ARCHIVE_EXT}"
ARCHIVE_PATH="$BUNDLE_DIR/$ARCHIVE_NAME"

echo "[1/8] Preparing virtual environment..."
if [[ ! -f "$PYTHON_BIN" ]]; then
  uv venv "$VENV_DIR"
fi

echo "[2/8] Discovering Cairo runtime..."
discover_cairo_runtime

echo "[3/8] Ensuring runtime and build dependencies..."
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

echo "[4/8] Cleaning previous build outputs..."
rm -rf "$BUNDLE_DIR" "$NUITKA_BUILD_DIR" "$RELEASE_STAGE_DIR" "$TEST_EXTRACT_DIR"
mkdir -p "$BUNDLE_DIR" "$NUITKA_BUILD_DIR" "$NUITKA_CACHE_DIR" "$RELEASE_STAGE_DIR/bin" "$RELEASE_STAGE_DIR/lib" "$RELEASE_STAGE_DIR/data"

echo "[5/8] Building standalone bundle with Nuitka..."
NUITKA_CACHE_DIR="$NUITKA_CACHE_DIR" "$PYTHON_BIN" -m nuitka \
  --standalone \
  --disable-ccache \
  --remove-output \
  --assume-yes-for-downloads \
  --output-dir="$NUITKA_BUILD_DIR" \
  --output-filename="$PLUGIN_NAME" \
  --include-module=presenton_pptx_generator_plugin \
  --include-package=presenton_sdk_pptx_generator \
  --include-package-data=presenton_sdk_pptx_generator \
  --include-package-data=PIL \
  --include-data-dir="$PPTX_TEMPLATES_DIR=pptx/templates" \
  --include-data-file="$CAIROSVG_VERSION_FILE=cairosvg/VERSION" \
  "$ENTRY_POINT"

BUILD_DIST_DIR="$(find_build_dist_dir)"
BUILD_OUTPUT_PATH="$BUILD_DIST_DIR/$NUITKA_OUTPUT_NAME"
if [[ ! -f "$BUILD_OUTPUT_PATH" ]]; then
  echo "Build failed: missing $BUILD_OUTPUT_PATH" >&2
  exit 1
fi

echo "[6/8] Staging Anna Binary distribution package..."
cp -R "$BUILD_DIST_DIR"/. "$RELEASE_STAGE_DIR/bin"/
cp "$SCRIPT_DIR/manifest.json" "$RELEASE_STAGE_DIR/bin/manifest.json"
stage_bundled_cairo_runtime "$RELEASE_STAGE_DIR/bin/cairo"
if [[ "$NUITKA_OUTPUT_NAME" != "$OUTPUT_NAME" ]]; then
  rm -f "$OUTPUT_PATH"
  mv "$RELEASE_STAGE_DIR/bin/$NUITKA_OUTPUT_NAME" "$OUTPUT_PATH"
fi
chmod +x "$OUTPUT_PATH"
codesign_bundle_if_needed
"$PYTHON_BIN" "$BINARY_RELEASE_HELPER" write-manifest \
  --tool-manifest "$SCRIPT_DIR/manifest.json" \
  --binary-name "$BINARY_NAME" \
  --output "$RELEASE_STAGE_DIR/manifest.json"

echo "[7/8] Creating release archive..."
if [[ "$PLATFORM" == "windows" ]]; then
  compress_zip "$RELEASE_STAGE_DIR" "$ARCHIVE_PATH"
else
  tar -C "$RELEASE_STAGE_DIR" -czf "$ARCHIVE_PATH" bin lib data manifest.json
fi
"$PYTHON_BIN" "$BINARY_RELEASE_HELPER" write-sha256 \
  --file "$ARCHIVE_PATH" \
  --output "$ARCHIVE_PATH.sha256"

echo "[8/8] Validation"
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

  "$PYTHON_BIN" "$BINARY_RELEASE_HELPER" verify-archive \
    --tool-manifest "$SCRIPT_DIR/manifest.json" \
    --binary-name "$BINARY_NAME" \
    --extract-dir "$TEST_EXTRACT_DIR" \
    --platform-key "$PLATFORM_KEY"

  verify_macos_relocation

  TEST_BINARY_PATH="$TEST_EXTRACT_DIR/bin/$OUTPUT_NAME"
  chmod +x "$TEST_BINARY_PATH" || true
  run_archive_smoke_test
  echo "archive validation passed"
else
  echo "skip (use --test to validate release archive)"
fi
