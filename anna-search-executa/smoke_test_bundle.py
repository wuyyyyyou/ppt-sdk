#!/usr/bin/env python3

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any


def invoke_rpc(binary_path: Path, request: dict[str, Any]) -> dict[str, Any]:
    process = subprocess.run(
        [str(binary_path)],
        input=json.dumps(request, separators=(",", ":")) + "\n",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=20,
        check=False,
    )
    if process.returncode != 0:
        raise AssertionError(
            f"Binary exited with {process.returncode}\n"
            f"stdout:\n{process.stdout}\n"
            f"stderr:\n{process.stderr}"
        )

    lines = [line for line in process.stdout.splitlines() if line.strip()]
    if len(lines) != 1:
        raise AssertionError(f"Expected one JSON-RPC response, got {len(lines)}: {process.stdout!r}")
    return json.loads(lines[0])


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(f"Usage: {Path(sys.argv[0]).name} <binary-path>")

    manifest = json.loads((Path(__file__).resolve().parent / "manifest.json").read_text(encoding="utf-8"))
    binary_path = Path(sys.argv[1]).resolve()
    if not binary_path.is_file():
        raise SystemExit(f"Binary not found: {binary_path}")

    describe = invoke_rpc(
        binary_path,
        {"jsonrpc": "2.0", "method": "describe", "id": 1},
    )
    assert describe["result"]["name"] == manifest["name"]
    assert describe["result"]["version"] == manifest["version"]

    health = invoke_rpc(
        binary_path,
        {"jsonrpc": "2.0", "method": "health", "id": 2},
    )
    assert health["result"]["status"] == "healthy"
    assert health["result"]["version"] == manifest["version"]

    invalid = invoke_rpc(
        binary_path,
        {
            "jsonrpc": "2.0",
            "method": "invoke",
            "id": 3,
            "params": {"tool": "web_search", "arguments": {"max_results": 5}},
        },
    )
    assert invalid["error"]["code"] == -32602


if __name__ == "__main__":
    main()
