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

normalize_runtime_path() {
  local target="$1"

  if [[ "$PLATFORM" == "windows" ]] && command -v cygpath >/dev/null 2>&1; then
    case "$target" in
      [A-Za-z]:/*|[A-Za-z]:\\*)
        cygpath -u "$target"
        return 0
        ;;
    esac
  fi

  printf '%s\n' "$target"
}

to_windows_path() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$1"
    return 0
  fi

  printf '%s\n' "$1"
}

contains_value() {
  local needle="$1"
  shift
  local item

  for item in "$@"; do
    if [[ "$item" == "$needle" ]]; then
      return 0
    fi
  done

  return 1
}

resolve_realpath() {
  python3 -c 'import os, sys; print(os.path.realpath(sys.argv[1]))' "$1"
}

discover_cairo_runtime_dir() {
  local -a candidates=()
  local candidate normalized brew_prefix

  if [[ -n "${CAIRO_RUNTIME_DIR:-}" ]]; then
    candidates+=("$CAIRO_RUNTIME_DIR")
  fi

  case "$PLATFORM" in
    darwin)
      if command -v brew >/dev/null 2>&1; then
        brew_prefix="$(brew --prefix cairo 2>/dev/null || true)"
        if [[ -n "$brew_prefix" ]]; then
          candidates+=("$brew_prefix/lib")
        fi
      fi
      candidates+=("/opt/homebrew/opt/cairo/lib" "/usr/local/opt/cairo/lib")
      ;;
    windows)
      candidates+=(
        "C:/msys64/mingw64/bin"
        "/c/msys64/mingw64/bin"
        "C:/msys64/ucrt64/bin"
        "/c/msys64/ucrt64/bin"
        "C:/msys64/clang64/bin"
        "/c/msys64/clang64/bin"
        "C:/Program Files/GTK3-Runtime Win64/bin"
        "C:/GTK3-Runtime Win64/bin"
      )
      ;;
  esac

  for candidate in "${candidates[@]}"; do
    normalized="$(normalize_runtime_path "$candidate")"
    case "$PLATFORM" in
      darwin)
        [[ -f "$normalized/libcairo.2.dylib" ]] && printf '%s\n' "$normalized" && return 0
        ;;
      windows)
        [[ -f "$normalized/libcairo-2.dll" ]] && printf '%s\n' "$normalized" && return 0
        ;;
    esac
  done

  if [[ "$PLATFORM" == "windows" ]] && command -v where.exe >/dev/null 2>&1; then
    while IFS= read -r candidate; do
      candidate="$(printf '%s' "$candidate" | tr -d '\r')"
      [[ -z "$candidate" ]] && continue
      normalized="$(normalize_runtime_path "$(dirname "$candidate")")"
      [[ -f "$normalized/libcairo-2.dll" ]] && printf '%s\n' "$normalized" && return 0
    done < <(where.exe libcairo-2.dll 2>/dev/null || true)
  fi

  if [[ "$PLATFORM" == "windows" ]]; then
    while IFS= read -r candidate; do
      [[ -z "$candidate" ]] && continue
      printf '%s\n' "$(dirname "$candidate")"
      return 0
    done < <(find /c/msys64 -type f -name 'libcairo-2.dll' 2>/dev/null || true)
  fi

  return 1
}

configure_cairo_runtime_env() {
  local runtime_dir="$1"

  case "$PLATFORM" in
    darwin)
      export CAIROCFFI_DLL_DIRECTORIES="$runtime_dir"
      if [[ -n "${DYLD_FALLBACK_LIBRARY_PATH:-}" ]]; then
        export DYLD_FALLBACK_LIBRARY_PATH="$runtime_dir:$DYLD_FALLBACK_LIBRARY_PATH"
      else
        export DYLD_FALLBACK_LIBRARY_PATH="$runtime_dir"
      fi
      ;;
    windows)
      export CAIRO_RUNTIME_DIR_WINDOWS="$(to_windows_path "$runtime_dir")"
      ;;
  esac
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

stage_windows_cairo_runtime() {
  local runtime_dir="$1"
  local -a patterns=(
    "libcairo-2.dll"
    "libcairo-gobject-2.dll"
    "libpixman-1-0.dll"
    "libpng16-16.dll"
    "zlib1.dll"
    "libfreetype-6.dll"
    "libfontconfig-1.dll"
    "libexpat-1.dll"
    "libffi-*.dll"
    "libglib-2.0-0.dll"
    "libgobject-2.0-0.dll"
    "libgmodule-2.0-0.dll"
    "libgthread-2.0-0.dll"
    "libgio-2.0-0.dll"
    "libintl-8.dll"
    "libiconv-2.dll"
    "libharfbuzz-0.dll"
    "libgraphite2.dll"
    "libfribidi-0.dll"
    "libthai-0.dll"
    "libdatrie-1.dll"
    "libbrotlicommon.dll"
    "libbrotlidec.dll"
    "libbrotlienc.dll"
    "libbz2-1.dll"
    "libpcre2-8-0.dll"
    "libxml2-2.dll"
    "liblzma-5.dll"
    "libstdc++-6.dll"
    "libgcc_s_*.dll"
    "libwinpthread-1.dll"
  )
  local -a copied=()
  local copied_count=0
  local pattern match base

  rm -rf "$CAIRO_STAGING_DIR"
  mkdir -p "$CAIRO_STAGING_DIR"

  shopt -s nullglob
  for pattern in "${patterns[@]}"; do
    for match in "$runtime_dir"/$pattern; do
      base="$(basename "$match")"
      if contains_value "$base" "${copied[@]}"; then
        continue
      fi

      cp "$match" "$CAIRO_STAGING_DIR/$base"
      copied+=("$base")
      copied_count=$((copied_count + 1))
    done
  done
  shopt -u nullglob

  if [[ ! -f "$CAIRO_STAGING_DIR/libcairo-2.dll" ]]; then
    echo "Missing libcairo-2.dll in staged runtime from $runtime_dir" >&2
    return 1
  fi

  if [[ "$copied_count" -lt 5 ]]; then
    echo "Staged Cairo runtime looks incomplete from $runtime_dir" >&2
    return 1
  fi
}

stage_macos_cairo_runtime() {
  local runtime_dir="$1"
  local -a queue=()
  local -a staged=()
  local current current_real base dep dep_real dep_base dylib

  rm -rf "$CAIRO_STAGING_DIR"
  mkdir -p "$CAIRO_STAGING_DIR"

  if [[ -f "$runtime_dir/libcairo.2.dylib" ]]; then
    queue+=("$runtime_dir/libcairo.2.dylib")
  fi
  if [[ -f "$runtime_dir/libcairo-gobject.2.dylib" ]]; then
    queue+=("$runtime_dir/libcairo-gobject.2.dylib")
  fi

  if [[ ${#queue[@]} -eq 0 ]]; then
    echo "Could not find macOS Cairo dylibs in $runtime_dir" >&2
    return 1
  fi

  while [[ ${#queue[@]} -gt 0 ]]; do
    current="${queue[0]}"
    if [[ ${#queue[@]} -eq 1 ]]; then
      queue=()
    else
      queue=("${queue[@]:1}")
    fi

    current_real="$(resolve_realpath "$current")"
    base="$(basename "$current_real")"
    if contains_value "$base" "${staged[@]}"; then
      continue
    fi

    cp "$current_real" "$CAIRO_STAGING_DIR/$base"
    chmod u+w "$CAIRO_STAGING_DIR/$base" || true
    staged+=("$base")

    while IFS= read -r dep; do
      case "$dep" in
        /opt/homebrew/*|/usr/local/*)
          if [[ ! -f "$dep" ]]; then
            continue
          fi
          dep_real="$(resolve_realpath "$dep")"
          dep_base="$(basename "$dep_real")"
          if contains_value "$dep_base" "${staged[@]}" || contains_value "$dep_real" "${queue[@]}"; then
            continue
          fi
          queue+=("$dep_real")
          ;;
      esac
    done < <(otool -L "$current_real" | awk 'NR > 1 {print $1}')
  done

  shopt -s nullglob
  for dylib in "$CAIRO_STAGING_DIR"/*.dylib; do
    install_name_tool -id "@loader_path/$(basename "$dylib")" "$dylib"
  done

  for dylib in "$CAIRO_STAGING_DIR"/*.dylib; do
    while IFS= read -r dep; do
      case "$dep" in
        /opt/homebrew/*|/usr/local/*)
          dep_base="$(basename "$dep")"
          if [[ -f "$CAIRO_STAGING_DIR/$dep_base" ]]; then
            install_name_tool -change "$dep" "@loader_path/$dep_base" "$dylib"
          fi
          ;;
      esac
    done < <(otool -L "$dylib" | awk 'NR > 1 {print $1}')
  done
  shopt -u nullglob

  [[ -f "$CAIRO_STAGING_DIR/libcairo.2.dylib" ]]
}

prepare_cairo_runtime() {
  local runtime_dir

  case "$PLATFORM" in
    darwin|windows)
      runtime_dir="$(discover_cairo_runtime_dir || true)"
      if [[ -z "$runtime_dir" ]]; then
        echo "Unable to locate Cairo runtime. Set CAIRO_RUNTIME_DIR to a directory containing libcairo for platform $PLATFORM." >&2
        return 1
      fi

      configure_cairo_runtime_env "$runtime_dir"

      case "$PLATFORM" in
        darwin) stage_macos_cairo_runtime "$runtime_dir" ;;
        windows) stage_windows_cairo_runtime "$runtime_dir" ;;
      esac
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
