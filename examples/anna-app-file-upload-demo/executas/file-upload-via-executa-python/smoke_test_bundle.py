#!/usr/bin/env python3

from __future__ import annotations

import json
import selectors
import subprocess
import sys
from pathlib import Path
from typing import Any


class BinaryClient:
    def __init__(self, binary_path: Path) -> None:
        self.process = subprocess.Popen(
            [str(binary_path)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        assert self.process.stdin and self.process.stdout and self.process.stderr
        self.selector = selectors.DefaultSelector()
        self.selector.register(self.process.stdout, selectors.EVENT_READ)

    def invoke(self, request: dict[str, Any]) -> dict[str, Any]:
        self.process.stdin.write(json.dumps(request, separators=(",", ":")) + "\n")
        self.process.stdin.flush()
        if not self.selector.select(timeout=30):
            raise AssertionError("Timed out waiting for binary JSON-RPC response")
        line = self.process.stdout.readline()
        if not line:
            stderr = self.process.stderr.read()
            raise AssertionError(
                f"Binary exited before responding (returncode={self.process.poll()})\n"
                f"stderr:\n{stderr}"
            )
        return json.loads(line)

    def close(self) -> None:
        self.selector.close()
        self.process.terminate()
        try:
            self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait(timeout=5)
        self.process.stdin.close()
        self.process.stdout.close()
        self.process.stderr.close()


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(f"Usage: {Path(sys.argv[0]).name} <binary-path>")

    root = Path(__file__).resolve().parent
    config = json.loads((root / "executa.json").read_text(encoding="utf-8"))
    binary_path = Path(sys.argv[1]).resolve()
    if not binary_path.is_file():
        raise SystemExit(f"Binary not found: {binary_path}")

    client = BinaryClient(binary_path)
    sample_path: Path | None = None
    try:
        describe = client.invoke({"jsonrpc": "2.0", "method": "describe", "id": 1})
        assert describe["result"]["display_name"] == config["name"]
        assert describe["result"]["version"] == config["version"]

        health = client.invoke({"jsonrpc": "2.0", "method": "health", "id": 2})
        assert health["result"]["status"] == "healthy"
        assert health["result"]["version"] == config["version"]

        sample = client.invoke(
            {
                "jsonrpc": "2.0",
                "method": "invoke",
                "id": 3,
                "params": {
                    "tool": "make_sample",
                    "arguments": {
                        "size_bytes": 4096,
                        "filename": "host-upload-binary-smoke.bin",
                    },
                },
            }
        )["result"]["data"]
        sample_path = Path(sample["path"])
        assert sample_path.stat().st_size == 4096

        diagnostic = client.invoke(
            {
                "jsonrpc": "2.0",
                "method": "invoke",
                "id": 4,
                "params": {
                    "tool": "get_diagnostic_log",
                    "arguments": {
                        "run_id": "binary-smoke-empty-run",
                        "cursor": 0,
                        "max_bytes": 24 * 1024,
                    },
                },
            }
        )["result"]["data"]
        assert diagnostic["done"] is True
        assert diagnostic["events"] == []
    finally:
        if sample_path is not None:
            sample_path.unlink(missing_ok=True)
        client.close()


if __name__ == "__main__":
    main()
