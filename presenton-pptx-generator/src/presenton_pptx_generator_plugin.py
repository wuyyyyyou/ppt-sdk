import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

TOOL_NAME = "generatePptx"

MANIFEST = {
    "name": "tool-lightvoss_5433-ppt-gener-dc7ftcep",
    "display_name": "ppt-gener",
    "version": "1.0.0",
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
                    "description": "Absolute path to the PptxPresentationModel JSON file.",
                    "required": True,
                },
                {
                    "name": "output_path",
                    "type": "string",
                    "description": "Absolute path where the generated .pptx file should be written.",
                    "required": True,
                },
                {
                    "name": "cwd",
                    "type": "string",
                    "description": "Optional absolute working directory retained for compatibility.",
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


def read_required_absolute_path(args: dict[str, Any], parameter_name: str) -> Path:
    value = args.get(parameter_name)
    if not isinstance(value, str) or not value:
        raise ValueError(f'Missing required parameter: "{parameter_name}"')

    expanded = Path(value).expanduser()
    if not expanded.is_absolute():
        raise ValueError(f'"{parameter_name}" must be an absolute path')

    return expanded.resolve()


def validate_optional_absolute_path(args: dict[str, Any], parameter_name: str) -> None:
    value = args.get(parameter_name)
    if value is None:
        return

    if not isinstance(value, str) or not value:
        raise ValueError(f'"{parameter_name}" must be a non-empty string when provided')

    if not Path(value).expanduser().is_absolute():
        raise ValueError(f'"{parameter_name}" must be an absolute path')


def tool_generate_pptx(args: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(args, dict):
        raise ValueError("Arguments must be an object")

    validate_optional_absolute_path(args, "cwd")
    model_path = read_required_absolute_path(args, "model_path")
    output_path = read_required_absolute_path(args, "output_path")

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
