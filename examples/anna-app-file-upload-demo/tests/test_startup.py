from __future__ import annotations

import asyncio
import json
import selectors
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1] / "executas" / "file-upload-via-executa-python"
sys.path.insert(0, str(PROJECT_DIR))

from host_upload_client import HostUploadClient, attach_invoke_context, bind_invoke  # noqa: E402


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
        self.assertEqual(response["result"]["version"], "0.2.5")
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

    def test_invoke_context_crosses_the_plugin_thread_hop(self) -> None:
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
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as sample_file:
            sample_file.write(b"invoke context")
            sample_path = Path(sample_file.name)

        def read_message() -> dict:
            if not selector.select(timeout=30):
                raise AssertionError("Timed out waiting for Executa output")
            line = process.stdout.readline()
            if not line:
                raise AssertionError(process.stderr.read())
            return json.loads(line)

        try:
            process.stdin.write(
                json.dumps(
                    {
                        "jsonrpc": "2.0",
                        "method": "invoke",
                        "id": 50,
                        "params": {
                            "tool": "host_upload_path",
                            "arguments": {
                                "path": str(sample_path),
                                "filename": "invoke-context.txt",
                                "mime_type": "text/plain",
                                "mode": "inline",
                            },
                            "context": {"invoke_id": "invoke-startup-context"},
                        },
                    }
                )
                + "\n"
            )
            process.stdin.flush()

            reverse_rpc = read_message()
            self.assertEqual(reverse_rpc["method"], "host/uploadFile")
            self.assertEqual(
                reverse_rpc["params"]["context"]["invoke_id"],
                "invoke-startup-context",
            )
            process.stdin.write(
                json.dumps(
                    {
                        "jsonrpc": "2.0",
                        "id": reverse_rpc["id"],
                        "result": {
                            "download_url": "https://uploads.example/context",
                            "r2_key": "exec-uploads/test/invoke-context.txt",
                            "size_bytes": sample_path.stat().st_size,
                            "expires_at": "2099-01-01T00:00:00Z",
                        },
                    }
                )
                + "\n"
            )
            process.stdin.flush()

            response = read_message()
            self.assertEqual(response["id"], 50)
            self.assertTrue(response["result"]["success"])
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


class InvokeContextTest(unittest.IsolatedAsyncioTestCase):
    async def test_concurrent_reverse_rpcs_keep_distinct_invoke_ids(self) -> None:
        frames: list[dict] = []
        client = HostUploadClient(write_frame=frames.append)

        async def confirm(invoke_id: str) -> dict:
            with bind_invoke({"context": {"invoke_id": invoke_id}}):
                pending = asyncio.create_task(client.confirm(r2_key=invoke_id))
                await asyncio.sleep(0)
                frame = next(
                    item for item in frames if item["params"]["r2_key"] == invoke_id
                )
                client.dispatch_response(
                    {
                        "jsonrpc": "2.0",
                        "id": frame["id"],
                        "result": {"r2_key": invoke_id},
                    }
                )
                return await pending

        await asyncio.gather(confirm("invoke-a"), confirm("invoke-b"))
        by_key = {
            frame["params"]["r2_key"]: frame["params"]["context"]["invoke_id"]
            for frame in frames
        }
        self.assertEqual(by_key, {"invoke-a": "invoke-a", "invoke-b": "invoke-b"})

    async def test_explicit_reverse_rpc_context_is_preserved(self) -> None:
        with bind_invoke("ambient-invoke"):
            params = attach_invoke_context(
                {"context": {"invoke_id": "explicit-invoke"}}
            )
        self.assertEqual(params["context"]["invoke_id"], "explicit-invoke")


if __name__ == "__main__":
    unittest.main()
