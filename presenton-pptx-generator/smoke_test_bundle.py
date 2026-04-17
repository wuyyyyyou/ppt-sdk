#!/usr/bin/env python3

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

SVG_DATA_URI = (
    "data:image/svg+xml;base64,"
    "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMTIwIDEyMCI+"
    "PHJlY3Qgd2lkdGg9IjEyMCIgaGVpZ2h0PSIxMjAiIHJ4PSIxNiIgZmlsbD0iIzBlYTVlOSIvPjxjaXJjbGUgY3g9IjYwIiBjeT0iNjAiIHI9IjI4IiBm"
    "aWxsPSIjZjhmYWZjIi8+PC9zdmc+"
)


def invoke_rpc(binary_path: Path, payload: dict) -> dict:
    proc = subprocess.run(
        [str(binary_path)],
        input=json.dumps(payload) + "\n",
        text=True,
        capture_output=True,
        check=False,
    )

    if proc.returncode != 0:
        raise RuntimeError(
            f"{binary_path} exited with {proc.returncode}\nstdout:\n{proc.stdout}\nstderr:\n{proc.stderr}"
        )

    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"failed to decode JSON output from {binary_path}\nstdout:\n{proc.stdout}\nstderr:\n{proc.stderr}"
        ) from exc


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(f"Usage: {sys.argv[0]} <binary-path>")

    binary_path = Path(sys.argv[1]).resolve()
    if not binary_path.is_file():
        raise SystemExit(f"Binary not found: {binary_path}")

    describe = invoke_rpc(
        binary_path,
        {"jsonrpc": "2.0", "method": "describe", "id": 1},
    )
    assert describe["result"]["name"] == "ppt-gener"

    health = invoke_rpc(
        binary_path,
        {"jsonrpc": "2.0", "method": "health", "id": 2},
    )
    assert health["result"]["status"] == "healthy"

    with tempfile.TemporaryDirectory(prefix="presenton-pptx-generator-binary-test.") as tmpdir:
        temp_root = Path(tmpdir)
        model_path = temp_root / "model.json"
        output_path = temp_root / "output.pptx"

        model = {
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
                                "height": 160,
                            },
                            "clip": False,
                            "picture": {
                                "is_network": False,
                                "path": SVG_DATA_URI,
                            },
                        },
                        {
                            "shape_type": "textbox",
                            "position": {
                                "left": 280,
                                "top": 96,
                                "width": 560,
                                "height": 120,
                            },
                            "paragraphs": [{"text": "Presenton PPTX Generator Binary Test"}],
                        },
                    ],
                }
            ],
        }
        model_path.write_text(json.dumps(model), encoding="utf-8")

        invoke = invoke_rpc(
            binary_path,
            {
                "jsonrpc": "2.0",
                "method": "invoke",
                "id": 3,
                "params": {
                    "tool": "generatePptx",
                    "arguments": {
                        "model_path": str(model_path),
                        "output_path": str(output_path),
                    },
                },
            },
        )

        assert invoke["result"]["success"] is True
        generated_path = Path(invoke["result"]["data"]["path"])
        assert generated_path.is_file()
        assert generated_path.suffix == ".pptx"
        assert generated_path.stat().st_size > 0


if __name__ == "__main__":
    main()
