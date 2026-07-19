#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PLUGIN_VERSION="$(node -e "const fs=require('node:fs'); console.log(JSON.parse(fs.readFileSync('manifest.json','utf8')).version)")"
BINARY_NAME="ppt-engine"
WINDOWS_BINARY_NAME="${BINARY_NAME}.exe"
BUNDLE_DIR="$SCRIPT_DIR/bundle"
BUILD_DIR="$SCRIPT_DIR/.build"
RAW_BINARY_DIR="$BUILD_DIR/binary"
RELEASE_STAGE_DIR="$BUILD_DIR/release-stage"
TEST_EXTRACT_DIR="$BUILD_DIR/test-extract"
BINARY_SMOKE_DIR="$BUILD_DIR/binary-smoke"
SEA_PREP_DIR="$BUILD_DIR/sea-prep"
BROWSER_CACHE_DIR="${PRESENTON_BROWSER_BUILD_CACHE_DIR:-$BUILD_DIR/browser-cache}"
BROWSER_RUNTIME_DIR="$BUILD_DIR/browser-runtime"
RUN_TEST=false
REUSE_TEMPLATE_PREVIEWS=false

for arg in "$@"; do
  case "$arg" in
    --test) RUN_TEST=true ;;
    --reuse-template-previews) REUSE_TEMPLATE_PREVIEWS=true ;;
    --help|-h)
      echo "Usage: $0 [--test] [--reuse-template-previews]"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

detect_output_name() {
  if [[ "$PLATFORM" == "windows" ]]; then
    echo "$WINDOWS_BINARY_NAME"
  else
    echo "$BINARY_NAME"
  fi
}

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

find_signtool() {
  if command -v signtool >/dev/null 2>&1; then
    command -v signtool
    return 0
  fi

  if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command '$tool = (Get-ChildItem -Path "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Recurse -Filter "signtool.exe" -ErrorAction SilentlyContinue | Where-Object { $_.Directory.Name -eq "x64" } | Sort-Object FullName -Descending | Select-Object -First 1).FullName; if ($tool) { Write-Output $tool }' | tr -d '\r'
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

remove_windows_signature() {
  local file_path_win signtool_path
  file_path_win="$(to_windows_path "$1")"
  signtool_path="$(find_signtool)"

  if [[ -z "$signtool_path" ]]; then
    echo "signtool.exe not found; cannot remove the copied runtime signature" >&2
    return 1
  fi

  echo "Removing Authenticode signature from copied Node runtime..."
  SIGNTOOL_PATH="$signtool_path" OUTPUT_PATH_WIN="$file_path_win" \
    powershell.exe -NoProfile -Command '& { & $env:SIGNTOOL_PATH remove /s $env:OUTPUT_PATH_WIN }'
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

NODE_MAJOR="$(node -p 'process.versions.node.split(`.`)[0]')"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "Node.js 20+ is required for SEA builds. Current version: $(node -v)" >&2
  exit 1
fi

if [[ ! -d "$SCRIPT_DIR/node_modules" ]]; then
  echo "node_modules is missing. Run npm install first." >&2
  exit 1
fi

if [[ ! -x "$SCRIPT_DIR/node_modules/.bin/postject" ]]; then
  echo "Missing postject. Run npm install in this directory to install dev dependencies." >&2
  exit 1
fi

PLATFORM="$(detect_platform)"
ARCH="$(detect_arch)"
PLATFORM_KEY="$(detect_platform_key "$PLATFORM" "$ARCH")"
OUTPUT_NAME="$(detect_output_name)"
OUTPUT_PATH="$RAW_BINARY_DIR/$OUTPUT_NAME"
ARCHIVE_EXT="tar.gz"
if [[ "$PLATFORM" == "windows" ]]; then
  ARCHIVE_EXT="zip"
fi
ARCHIVE_NAME="${BINARY_NAME}-v${PLUGIN_VERSION}-${PLATFORM_KEY}.${ARCHIVE_EXT}"
ARCHIVE_PATH="$BUNDLE_DIR/$ARCHIVE_NAME"

rm -rf "$BUNDLE_DIR" "$RAW_BINARY_DIR" "$RELEASE_STAGE_DIR" "$TEST_EXTRACT_DIR" "$BINARY_SMOKE_DIR" "$BROWSER_RUNTIME_DIR"
mkdir -p "$BUNDLE_DIR" "$RAW_BINARY_DIR"

echo "[1/8] Preparing pinned Chrome for Testing runtime..."
node ./scripts/prepare-browser-runtime.mjs \
  --cache-dir "$BROWSER_CACHE_DIR" \
  --output-dir "$BROWSER_RUNTIME_DIR" \
  --platform-key "$PLATFORM_KEY"
BROWSER_EXECUTABLE_RELATIVE_PATH="$(node -e "const fs=require('node:fs'); console.log(JSON.parse(fs.readFileSync(process.argv[1],'utf8')).executable_path)" "$BROWSER_RUNTIME_DIR/runtime.json")"
BROWSER_EXECUTABLE_PATH="$BROWSER_RUNTIME_DIR/$BROWSER_EXECUTABLE_RELATIVE_PATH"

echo "[2/8] Building dist artifacts and template previews..."
if [[ "$REUSE_TEMPLATE_PREVIEWS" == "true" ]]; then
  if [[ ! -f "$SCRIPT_DIR/dist/template-previews/index.json" ]]; then
    echo "Template previews are missing. Run npm run build:template-previews or provide dist/template-previews before using --reuse-template-previews." >&2
    exit 1
  fi
  PRESENTON_CHROME_EXECUTABLE_PATH="$BROWSER_EXECUTABLE_PATH" npm run build
else
  PRESENTON_CHROME_EXECUTABLE_PATH="$BROWSER_EXECUTABLE_PATH" npm run build:full
fi

node -e '
const fs = require("node:fs");
const path = require("node:path");

const indexPath = path.join(process.cwd(), "dist", "template-previews", "index.json");
const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const groups = Object.values(index.groups || {});
const imageCount = groups.reduce((count, group) => count + (Array.isArray(group.images) ? group.images.length : 0), 0);

if (groups.length === 0 || imageCount === 0) {
  throw new Error(`Template preview index is empty: ${indexPath}`);
}

for (const group of groups) {
  for (const image of group.images || []) {
    const imagePath = path.join(process.cwd(), "dist", "template-previews", image.relative_path);
    if (!fs.statSync(imagePath).isFile()) {
      throw new Error(`Template preview image is missing: ${imagePath}`);
    }
  }
}

console.log(`Verified ${imageCount} template preview image(s) across ${groups.length} group(s).`);
'

echo "[3/8] Preparing external app runtime and SEA bootstrap..."
PRESENTON_TEMPLATE_ENGINE_SEA_PREP_DIR="$SEA_PREP_DIR" node ./scripts/prepare-sea-bundle.mjs

echo "[4/8] Generating SEA blob..."
node --experimental-sea-config "$SEA_PREP_DIR/sea-config.json"

echo "[5/8] Injecting blob into Node runtime..."
node ./scripts/patch-postject.mjs
if [[ "$PLATFORM" == "windows" ]]; then
  node -e "require('node:fs').copyFileSync(process.execPath, process.argv[1])" "$OUTPUT_PATH"
  chmod u+w "$OUTPUT_PATH" || true
else
  cp "$(node -p 'process.execPath')" "$OUTPUT_PATH"
  chmod u+w "$OUTPUT_PATH"
fi

case "$PLATFORM" in
  darwin)
    codesign --remove-signature "$OUTPUT_PATH" >/dev/null 2>&1 || true
    ;;
  windows)
    remove_windows_signature "$OUTPUT_PATH"
    ;;
esac

POSTJECT_ARGS=(
  "$OUTPUT_PATH"
  NODE_SEA_BLOB
  "$SEA_PREP_DIR/sea.blob"
  --sentinel-fuse
  NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
)

if [[ "$PLATFORM" == "darwin" ]]; then
  POSTJECT_ARGS+=(--macho-segment-name NODE_SEA)
fi

"$SCRIPT_DIR/node_modules/.bin/postject" "${POSTJECT_ARGS[@]}"

if [[ "$PLATFORM" == "darwin" ]]; then
  codesign --force --sign - "$OUTPUT_PATH" >/dev/null 2>&1 || true
fi

echo "[6/8] Staging Anna Binary distribution package..."
mkdir -p "$RELEASE_STAGE_DIR/bin" "$RELEASE_STAGE_DIR/lib" "$RELEASE_STAGE_DIR/data"
cp "$OUTPUT_PATH" "$RELEASE_STAGE_DIR/bin/$OUTPUT_NAME"
chmod 755 "$RELEASE_STAGE_DIR/bin/$OUTPUT_NAME" || true
mkdir -p "$RELEASE_STAGE_DIR/lib/app"
cp -R "$SEA_PREP_DIR/app/." "$RELEASE_STAGE_DIR/lib/app/"
mkdir -p "$RELEASE_STAGE_DIR/lib/browser"
cp -R "$BROWSER_RUNTIME_DIR/." "$RELEASE_STAGE_DIR/lib/browser/"
node ./scripts/binary-release.mjs write-manifest \
  --tool-manifest "$SCRIPT_DIR/manifest.json" \
  --output "$RELEASE_STAGE_DIR/manifest.json"

echo "[7/8] Creating release archive..."
if [[ "$PLATFORM" == "windows" ]]; then
  compress_zip "$RELEASE_STAGE_DIR" "$ARCHIVE_PATH"
else
  tar -C "$RELEASE_STAGE_DIR" -czf "$ARCHIVE_PATH" bin lib data manifest.json
fi
node ./scripts/binary-release.mjs write-sha256 \
  --file "$ARCHIVE_PATH" \
  --output "$ARCHIVE_PATH.sha256"

echo "[8/8] Validation"
echo "Binary created at: $OUTPUT_PATH"
ls -lh "$OUTPUT_PATH"
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

  node ./scripts/binary-release.mjs verify-archive \
    --tool-manifest "$SCRIPT_DIR/manifest.json" \
    --extract-dir "$TEST_EXTRACT_DIR" \
    --platform-key "$PLATFORM_KEY"

  TEST_BINARY_PATH="$TEST_EXTRACT_DIR/bin/$OUTPUT_NAME"
  chmod +x "$TEST_BINARY_PATH" || true
  RESULT="$(printf '%s\n' '{"jsonrpc":"2.0","method":"describe","id":1}' | "$TEST_BINARY_PATH" 2>/dev/null)"
  echo "$RESULT" | node ./scripts/binary-release.mjs verify-describe \
    --tool-manifest "$SCRIPT_DIR/manifest.json"
  node ./scripts/smoke-test-binary.mjs \
    --binary "$TEST_BINARY_PATH" \
    --extract-dir "$TEST_EXTRACT_DIR" \
    --work-dir "$BINARY_SMOKE_DIR" \
    --fixture-dir "$SCRIPT_DIR/test/fixtures/binary-smoke-deck"
  echo "archive validation passed"
else
  echo "skip (use --test to validate release archive)"
fi
