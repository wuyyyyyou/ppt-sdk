#!/usr/bin/env python3

from __future__ import annotations

import argparse
import os
from pathlib import Path, PureWindowsPath
import shlex
import shutil
import subprocess
import sys


def normalize_windows_path(value: str) -> Path:
    if value.startswith("/") and len(value) >= 3 and value[1].isalpha() and value[2] == "/":
        value = f"{value[1].upper()}:/{value[3:]}"
    return Path(value).expanduser()


def normalize_candidate(value: str, platform: str) -> Path:
    if platform == "windows":
        return normalize_windows_path(value)
    return Path(value).expanduser()


def windows_string(path: Path) -> str:
    return str(PureWindowsPath(path))


def discover_runtime_dir(platform: str, runtime_dir: str | None) -> Path:
    candidates: list[Path] = []

    if runtime_dir:
        candidates.append(normalize_candidate(runtime_dir, platform))

    if platform == "darwin":
        candidates.extend(
            [
                Path("/opt/homebrew/opt/cairo/lib"),
                Path("/usr/local/opt/cairo/lib"),
            ]
        )
    elif platform == "windows":
        candidates.extend(
            [
                normalize_windows_path("C:/msys64/mingw64/bin"),
                normalize_windows_path("C:/msys64/ucrt64/bin"),
                normalize_windows_path("C:/msys64/clang64/bin"),
                normalize_windows_path("C:/Program Files/GTK3-Runtime Win64/bin"),
                normalize_windows_path("C:/GTK3-Runtime Win64/bin"),
            ]
        )

    expected = "libcairo.2.dylib" if platform == "darwin" else "libcairo-2.dll"

    for candidate in candidates:
        if (candidate / expected).is_file():
            return candidate.resolve()

    if platform == "windows":
        where_exe = shutil.which("where.exe")
        if where_exe:
            proc = subprocess.run(
                [where_exe, expected],
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
                check=False,
            )
            for line in proc.stdout.splitlines():
                line = line.strip().rstrip("\r")
                if not line:
                    continue
                candidate = Path(line).parent
                if (candidate / expected).is_file():
                    return candidate.resolve()

        msys_root = normalize_windows_path("C:/msys64")
        if msys_root.exists():
            matches = sorted(msys_root.rglob(expected))
            if matches:
                return matches[0].parent.resolve()

    raise SystemExit(
        f"Unable to locate Cairo runtime. Set CAIRO_RUNTIME_DIR to a directory containing {expected}."
    )


def stage_windows_runtime(runtime_dir: Path, staging_dir: Path) -> None:
    shutil.rmtree(staging_dir, ignore_errors=True)
    staging_dir.mkdir(parents=True, exist_ok=True)

    copied = 0
    for dll in sorted(runtime_dir.glob("*.dll")):
        shutil.copy2(dll, staging_dir / dll.name)
        copied += 1

    if copied == 0 or not (staging_dir / "libcairo-2.dll").is_file():
        raise SystemExit(f"Failed to stage Cairo runtime DLLs from {runtime_dir}")


def otool_dependencies(path: Path) -> list[Path]:
    proc = subprocess.run(
        ["otool", "-L", str(path)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=True,
    )
    result: list[Path] = []
    for line in proc.stdout.splitlines()[1:]:
        dep = line.strip().split(" ", 1)[0]
        if dep.startswith(("/opt/homebrew/", "/usr/local/")):
            result.append(Path(dep))
    return result


def stage_macos_runtime(runtime_dir: Path, staging_dir: Path) -> None:
    shutil.rmtree(staging_dir, ignore_errors=True)
    staging_dir.mkdir(parents=True, exist_ok=True)

    queue: list[Path] = []
    for name in ("libcairo.2.dylib", "libcairo-gobject.2.dylib"):
        candidate = runtime_dir / name
        if candidate.is_file():
            queue.append(candidate.resolve())

    if not queue:
        raise SystemExit(f"Could not find macOS Cairo dylibs in {runtime_dir}")

    copied_by_name: dict[str, Path] = {}
    seen_realpaths: set[Path] = set()

    while queue:
        current = queue.pop(0).resolve()
        if current in seen_realpaths:
            continue
        seen_realpaths.add(current)

        target = staging_dir / current.name
        shutil.copy2(current, target)
        target.chmod(target.stat().st_mode | 0o200)
        copied_by_name[current.name] = target

        for dep in otool_dependencies(current):
            if dep.is_file():
                queue.append(dep.resolve())

    for dylib in copied_by_name.values():
        subprocess.run(
            ["install_name_tool", "-id", f"@loader_path/{dylib.name}", str(dylib)],
            check=True,
        )

    for dylib in copied_by_name.values():
        for dep in otool_dependencies(dylib):
            dep_name = dep.name
            if dep_name in copied_by_name:
                subprocess.run(
                    [
                        "install_name_tool",
                        "-change",
                        str(dep),
                        f"@loader_path/{dep_name}",
                        str(dylib),
                    ],
                    check=True,
                )

    if "libcairo.2.dylib" not in copied_by_name:
        raise SystemExit(f"Failed to stage libcairo.2.dylib from {runtime_dir}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--platform", required=True, choices=["darwin", "windows"])
    parser.add_argument("--staging-dir", required=True)
    parser.add_argument("--runtime-dir")
    args = parser.parse_args()

    staging_dir = Path(args.staging_dir)
    runtime_dir = discover_runtime_dir(args.platform, args.runtime_dir)

    if args.platform == "darwin":
        stage_macos_runtime(runtime_dir, staging_dir)
        runtime_for_imports = str(runtime_dir)
    else:
        stage_windows_runtime(runtime_dir, staging_dir)
        runtime_for_imports = windows_string(runtime_dir)

    print(f"CAIRO_RUNTIME_DIR_FOR_IMPORTS={shlex.quote(runtime_for_imports)}")


if __name__ == "__main__":
    main()
