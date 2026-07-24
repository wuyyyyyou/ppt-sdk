#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from typing import Any


def read_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"Expected JSON object: {path}")
    return payload


def read_executa_config(path: Path) -> dict[str, Any]:
    config = read_json(path)
    for key in ("name", "version"):
        value = config.get(key)
        if not isinstance(value, str) or not value:
            raise ValueError(f"Executa config must include a non-empty {key}: {path}")
    return config


def build_distribution_manifest(
    executa_config: dict[str, Any],
    *,
    binary_name: str,
) -> dict[str, Any]:
    windows_binary_name = f"{binary_name}.exe"
    return {
        "display_name": executa_config["name"],
        "version": executa_config["version"],
        "runtime": {
            "binary": {
                "entrypoint": {
                    "default": f"bin/{binary_name}",
                    "windows-x86_64": f"bin/{windows_binary_name}",
                    "windows-arm64": f"bin/{windows_binary_name}",
                },
                "lib_dirs": ["lib"],
                "data_dirs": ["data"],
                "permissions": {f"bin/{binary_name}": "0o755"},
            }
        },
    }


def write_manifest(args: argparse.Namespace) -> None:
    config = read_executa_config(args.executa_config)
    manifest = build_distribution_manifest(config, binary_name=args.binary_name)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(f"{json.dumps(manifest, indent=2)}\n", encoding="utf-8")


def write_sha256(args: argparse.Namespace) -> None:
    digest = hashlib.sha256(args.file.read_bytes()).hexdigest()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(f"{digest}  {args.file.name}\n", encoding="ascii")


def verify_archive(args: argparse.Namespace) -> None:
    config = read_executa_config(args.executa_config)
    expected_manifest = build_distribution_manifest(config, binary_name=args.binary_name)
    extract_dir = args.extract_dir

    for directory in ("bin", "lib", "data"):
        path = extract_dir / directory
        if not path.is_dir():
            raise AssertionError(f"Missing Anna Binary directory: {path}")

    manifest_path = extract_dir / "manifest.json"
    if not manifest_path.is_file():
        raise AssertionError(f"Missing distribution manifest: {manifest_path}")
    actual_manifest = read_json(manifest_path)
    if actual_manifest != expected_manifest:
        raise AssertionError(
            f"Distribution manifest mismatch: expected {expected_manifest}, got {actual_manifest}"
        )

    if args.platform_key != "darwin-x86_64":
        raise AssertionError(f"Unsupported diagnostic platform: {args.platform_key}")
    binary_path = extract_dir / "bin" / args.binary_name
    if not binary_path.is_file():
        raise AssertionError(f"Missing binary entrypoint: {binary_path}")
    if not os.access(binary_path, os.X_OK):
        raise AssertionError(f"Binary entrypoint is not executable: {binary_path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    manifest_parser = subparsers.add_parser("write-manifest")
    manifest_parser.add_argument("--executa-config", required=True, type=Path)
    manifest_parser.add_argument("--binary-name", required=True)
    manifest_parser.add_argument("--output", required=True, type=Path)
    manifest_parser.set_defaults(func=write_manifest)

    checksum_parser = subparsers.add_parser("write-sha256")
    checksum_parser.add_argument("--file", required=True, type=Path)
    checksum_parser.add_argument("--output", required=True, type=Path)
    checksum_parser.set_defaults(func=write_sha256)

    verify_parser = subparsers.add_parser("verify-archive")
    verify_parser.add_argument("--executa-config", required=True, type=Path)
    verify_parser.add_argument("--binary-name", required=True)
    verify_parser.add_argument("--extract-dir", required=True, type=Path)
    verify_parser.add_argument("--platform-key", required=True)
    verify_parser.set_defaults(func=verify_archive)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
