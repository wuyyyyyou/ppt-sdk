import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

TOOL_NAME = "generatePptx"

MANIFEST = {
    "name": "tool-lightvoss_5433-ppt-gener-w7g2hnsn",
    "display_name": "ppt-gener",
    "version": "0.1.0",
    "description": "Anna Executa plugin for generating .pptx files from PptxPresentationModel JSON files.",
    "author": "Anna Developer",
    "tools": [
        {
            "name": TOOL_NAME,
            "description": "Generate a .pptx file from a PptxPresentationModel JSON file and return the output path.",
            "parameters": [
                {
                    "name": "model_path",
                    "type": "string",
                    "description": "Path to the PptxPresentationModel JSON file.",
                    "required": True,
                },
                {
                    "name": "output_path",
                    "type": "string",
                    "description": "Path where the generated .pptx file should be written.",
                    "required": True,
                },
                {
                    "name": "cwd",
                    "type": "string",
                    "description": "Working directory used to resolve relative input and output paths.",
                    "required": False,
                },
            ],
        }
    ],
    "runtime": {
        "type": "uv",
        "min_version": "1.0.0",
    },
}


def make_response(
    request_id: Any,
    result: Any = None,
    error: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    response = {"jsonrpc": "2.0", "id": request_id}
    if error is not None:
        response["error"] = error
    else:
        response["result"] = result
    return response


def resolve_path(cwd: Optional[str], target: str) -> Path:
    if not isinstance(target, str) or not target:
        raise ValueError("Expected a non-empty path string")

    base_dir = Path(cwd).expanduser().resolve() if cwd else Path.cwd()
    return (base_dir / target).resolve() if not Path(target).expanduser().is_absolute() else Path(target).expanduser().resolve()


def tool_generate_pptx(args: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(args, dict):
        raise ValueError("Arguments must be an object")

    model_path_arg = args.get("model_path")
    output_path_arg = args.get("output_path")
    cwd_arg = args.get("cwd")

    if not isinstance(model_path_arg, str) or not model_path_arg:
        raise ValueError('Missing required parameter: "model_path"')

    if not isinstance(output_path_arg, str) or not output_path_arg:
        raise ValueError('Missing required parameter: "output_path"')

    if cwd_arg is not None and (not isinstance(cwd_arg, str) or not cwd_arg):
        raise ValueError('"cwd" must be a non-empty string when provided')

    model_path = resolve_path(cwd_arg, model_path_arg)
    output_path = resolve_path(cwd_arg, output_path_arg)

    from presenton_sdk_pptx_generator import generate_pptx_sync

    result = generate_pptx_sync(
        model_path,
        output_path=output_path,
    )

    return result.model_dump()


TOOL_DISPATCH = {
    TOOL_NAME: tool_generate_pptx,
}


def handle_invoke(request_id: Any, params: dict[str, Any]) -> dict[str, Any]:
    tool_name = params.get("tool")
    arguments = params.get("arguments", {})

    if not tool_name:
        return make_response(
            request_id,
            error={"code": -32602, "message": "Missing 'tool' in params"},
        )

    fn = TOOL_DISPATCH.get(tool_name)
    if fn is None:
        return make_response(
            request_id,
            error={
                "code": -32601,
                "message": f"Unknown tool: {tool_name}",
                "data": {"available_tools": list(TOOL_DISPATCH.keys())},
            },
        )

    if not isinstance(arguments, dict):
        return make_response(
            request_id,
            error={"code": -32602, "message": "'arguments' must be an object"},
        )

    try:
        data = fn(arguments)
        return make_response(
            request_id,
            result={"success": True, "data": data, "tool": tool_name},
        )
    except ValueError as exc:
        return make_response(
            request_id,
            error={"code": -32602, "message": str(exc)},
        )
    except Exception as exc:  # noqa: BLE001
        return make_response(
            request_id,
            error={"code": -32603, "message": str(exc)},
        )


def handle_request(line: str) -> dict[str, Any]:
    try:
        request = json.loads(line)
    except json.JSONDecodeError:
        return make_response(None, error={"code": -32700, "message": "Parse error"})

    request_id = request.get("id")
    method = request.get("method")
    params = request.get("params", {})

    if method == "describe":
        return make_response(request_id, result=MANIFEST)
    if method == "invoke":
        return handle_invoke(request_id, params)
    if method == "health":
        return make_response(
            request_id,
            result={
                "status": "healthy",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "version": MANIFEST["version"],
                "tools_count": len(MANIFEST["tools"]),
            },
        )

    return make_response(
        request_id,
        error={"code": -32601, "message": f"Method not found: {method}"},
    )


def main() -> None:
    print("Presenton PPTX Generator Executa plugin started", file=sys.stderr)
    print(f"Tools: {list(TOOL_DISPATCH.keys())}", file=sys.stderr)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        print(f"← {line}", file=sys.stderr)
        response = handle_request(line)
        serialized = json.dumps(response, ensure_ascii=False)
        print(serialized, flush=True)
        print(f"→ {serialized}", file=sys.stderr)
