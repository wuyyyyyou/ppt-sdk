#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PLUGIN_NAME="ppt-engine"
BUNDLE_DIR="$SCRIPT_DIR/bundle"
SEA_PREP_DIR="$SCRIPT_DIR/sea-prep"
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

detect_output_name() {
  if [[ "$(detect_platform)" == "windows" ]]; then
    echo "${PLUGIN_NAME}.exe"
  else
    echo "${PLUGIN_NAME}"
  fi
}

detect_platform() {
  local os
  os="$(uname -s)"

  case "$os" in
    Darwin) echo "darwin" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) echo "other" ;;
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

OUTPUT_NAME="$(detect_output_name)"
OUTPUT_PATH="$BUNDLE_DIR/$OUTPUT_NAME"
PLATFORM="$(detect_platform)"

mkdir -p "$BUNDLE_DIR"
rm -f "$OUTPUT_PATH"

echo "[1/5] Building dist artifacts..."
npm run build

echo "[2/5] Preparing SEA app bundle..."
node ./scripts/prepare-sea-bundle.mjs

echo "[3/5] Generating SEA blob..."
node --experimental-sea-config "$SEA_PREP_DIR/sea-config.json"

echo "[4/5] Injecting blob into Node runtime..."
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

echo "[5/5] Validation"
echo "Binary created at: $OUTPUT_PATH"
ls -lh "$OUTPUT_PATH"

if [[ "$RUN_TEST" == "true" ]]; then
  RESULT="$(printf '%s\n' '{"jsonrpc":"2.0","method":"describe","id":1}' | "$OUTPUT_PATH" 2>/dev/null)"
  echo "$RESULT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d);process.exit(r.result&&r.result.name==='ppt-engine'?0:1)})"
  echo "describe validation passed"
else
  echo "skip (use --test to validate describe)"
fi
