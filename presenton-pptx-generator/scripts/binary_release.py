#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


def read_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"Expected JSON object: {path}")
    return payload


def read_tool_manifest(path: Path) -> dict[str, Any]:
    manifest = read_json(path)
    for key in ("name", "version"):
        value = manifest.get(key)
        if not isinstance(value, str) or not value:
            raise ValueError(f"Tool manifest must include a non-empty {key}: {path}")
    return manifest


def build_distribution_manifest(
    tool_manifest: dict[str, Any],
    *,
    binary_name: str,
) -> dict[str, Any]:
    windows_binary_name = f"{binary_name}.exe"
    return {
        "name": tool_manifest["name"],
        "version": tool_manifest["version"],
        "runtime": {
            "binary": {
                "entrypoint": {
                    "default": f"bin/{binary_name}",
                    "windows-x86_64": f"bin/{windows_binary_name}",
                    "windows-arm64": f"bin/{windows_binary_name}",
                },
                "lib_dirs": ["lib"],
                "data_dirs": ["data"],
                "permissions": {
                    f"bin/{binary_name}": "0o755",
                },
            },
        },
    }


def assert_file(path: Path, label: str) -> None:
    if not path.is_file():
        raise AssertionError(f"Missing {label}: {path}")


def assert_directory(path: Path, label: str) -> None:
    if not path.is_dir():
        raise AssertionError(f"Missing {label}: {path}")


def write_manifest(args: argparse.Namespace) -> None:
    tool_manifest = read_tool_manifest(args.tool_manifest)
    distribution_manifest = build_distribution_manifest(
        tool_manifest,
        binary_name=args.binary_name,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        f"{json.dumps(distribution_manifest, indent=2)}\n",
        encoding="utf-8",
    )


def write_sha256(args: argparse.Namespace) -> None:
    digest = hashlib.sha256(args.file.read_bytes()).hexdigest()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(f"{digest}  {args.file.name}\n", encoding="ascii")


def verify_archive(args: argparse.Namespace) -> None:
    tool_manifest = read_tool_manifest(args.tool_manifest)
    expected_distribution_manifest = build_distribution_manifest(
        tool_manifest,
        binary_name=args.binary_name,
    )

    extract_dir = args.extract_dir
    assert_directory(extract_dir / "bin", "bin directory")
    assert_directory(extract_dir / "lib", "lib directory")
    assert_directory(extract_dir / "data", "data directory")
    assert_file(extract_dir / "manifest.json", "distribution manifest")

    binary_file_name = (
        f"{args.binary_name}.exe"
        if args.platform_key.startswith("windows-")
        else args.binary_name
    )
    assert_file(extract_dir / "bin" / binary_file_name, "binary entrypoint")

    actual_distribution_manifest = read_json(extract_dir / "manifest.json")
    if actual_distribution_manifest != expected_distribution_manifest:
        raise AssertionError(
            "Distribution manifest mismatch: "
            f"expected {expected_distribution_manifest}, got {actual_distribution_manifest}",
        )

    # The tool manifest is embedded in the binary, not shipped as bin/manifest.json.
    # Its correctness is verified end-to-end by smoke_test_bundle.py, which invokes
    # the binary's `describe` method and checks the returned name/version.


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    write_manifest_parser = subparsers.add_parser("write-manifest")
    write_manifest_parser.add_argument("--tool-manifest", required=True, type=Path)
    write_manifest_parser.add_argument("--binary-name", required=True)
    write_manifest_parser.add_argument("--output", required=True, type=Path)
    write_manifest_parser.set_defaults(func=write_manifest)

    write_sha256_parser = subparsers.add_parser("write-sha256")
    write_sha256_parser.add_argument("--file", required=True, type=Path)
    write_sha256_parser.add_argument("--output", required=True, type=Path)
    write_sha256_parser.set_defaults(func=write_sha256)

    verify_archive_parser = subparsers.add_parser("verify-archive")
    verify_archive_parser.add_argument("--tool-manifest", required=True, type=Path)
    verify_archive_parser.add_argument("--binary-name", required=True)
    verify_archive_parser.add_argument("--extract-dir", required=True, type=Path)
    verify_archive_parser.add_argument("--platform-key", required=True)
    verify_archive_parser.set_defaults(func=verify_archive)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
