from __future__ import annotations

import json
import selectors
import subprocess
import tempfile
import unittest
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1] / "executas" / "file-upload-via-executa-python"
COMMAND = [
    "uv",
    "run",
    "--project",
    str(PROJECT_DIR),
    "tool-test-file-upload-12345678",
]


def invoke_once_with_size(request: dict) -> tuple[dict, int]:
    process = subprocess.Popen(
        COMMAND,
        text=True,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert process.stdin and process.stdout and process.stderr
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    try:
        process.stdin.write(json.dumps(request) + "\n")
        process.stdin.flush()
        if not selector.select(timeout=30):
            raise AssertionError("Timed out waiting for the Executa JSON-RPC response")
        line = process.stdout.readline()
        if not line:
            stderr = process.stderr.read()
            raise AssertionError(
                f"Executa exited before responding (returncode={process.poll()}).\n"
                f"stderr:\n{stderr}"
            )
        return json.loads(line), len(line.encode("utf-8"))
    finally:
        selector.close()
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
        process.stdin.close()
        process.stdout.close()
        process.stderr.close()


def invoke_once(request: dict) -> dict:
    response, _ = invoke_once_with_size(request)
    return response


class StartupTest(unittest.TestCase):
    def test_describe_starts_through_real_uv_command(self) -> None:
        response = invoke_once({"jsonrpc": "2.0", "method": "describe", "id": 1})
        self.assertEqual(response["result"]["version"], "0.2.4")
        tool_names = {tool["name"] for tool in response["result"]["tools"]}
        self.assertTrue(
            {"make_sample", "host_upload_path", "get_diagnostic_log"}.issubset(tool_names)
        )

    def test_make_sample_writes_locally_without_json_rpc_file_bytes(self) -> None:
        response = invoke_once(
            {
                "jsonrpc": "2.0",
                "method": "invoke",
                "id": 2,
                "params": {
                    "tool": "make_sample",
                    "arguments": {
                        "size_bytes": 262_144,
                        "filename": "host-upload-startup-test.png",
                    },
                },
            }
        )
        result = response["result"]["data"]
        sample_path = Path(result["path"])
        try:
            self.assertEqual(result["size_bytes"], 262_144)
            self.assertEqual(sample_path.stat().st_size, 262_144)
        finally:
            sample_path.unlink(missing_ok=True)

    def test_diagnostic_log_is_paginated_below_runtime_line_limit(self) -> None:
        run_id = "host-upload-pagination-regression"
        trace_dir = Path(tempfile.gettempdir()) / "anna-host-upload-demo-traces"
        trace_dir.mkdir(parents=True, exist_ok=True)
        trace_path = trace_dir / f"{run_id}.jsonl"
        expected_events = [
            {
                "timestamp": f"2026-07-24T03:27:{index:02d}.000Z",
                "event": "executa.upload.reverse-rpc",
                "run_id": run_id,
                "call_id": f"call-{index:03d}",
                "phase": "reverse-rpc",
                "status": "succeeded",
                "r2_key": f"exec-uploads/staging/{index:03d}/" + ("x" * 420),
            }
            for index in range(130)
        ]
        trace_path.write_text(
            "".join(json.dumps(event) + "\n" for event in expected_events),
            encoding="utf-8",
        )

        collected_events = []
        cursor = 0
        page_count = 0
        try:
            while True:
                response, response_bytes = invoke_once_with_size(
                    {
                        "jsonrpc": "2.0",
                        "method": "invoke",
                        "id": 100 + page_count,
                        "params": {
                            "tool": "get_diagnostic_log",
                            "arguments": {
                                "run_id": run_id,
                                "cursor": cursor,
                                "max_bytes": 24 * 1024,
                            },
                        },
                    }
                )
                self.assertLess(response_bytes, 64 * 1024)
                page = response["result"]["data"]
                collected_events.extend(page["events"])
                page_count += 1
                if page["done"]:
                    break
                self.assertGreater(page["next_cursor"], cursor)
                cursor = page["next_cursor"]

            self.assertGreater(page_count, 1)
            self.assertEqual(collected_events, expected_events)
        finally:
            trace_path.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
