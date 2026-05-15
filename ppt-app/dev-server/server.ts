import http from "node:http";
import { localToolRegistry } from "./toolRegistry";
import { invokeJsonRpcTool } from "./jsonRpcClient";
import { parseToolInvokeRequest } from "./httpTypes";

const host = process.env.PPT_APP_DEV_HOST ?? "127.0.0.1";
const port = Number(process.env.PPT_APP_DEV_PORT ?? 8787);

function sendJson(
  response: http.ServerResponse,
  statusCode: number,
  payload: unknown
) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "http://127.0.0.1:5174",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "POST, OPTIONS"
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request: http.IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (request.method !== "POST" || request.url !== "/api/tools/invoke") {
    sendJson(response, 404, {
      ok: false,
      error: { message: "Not found." }
    });
    return;
  }

  try {
    const body = parseToolInvokeRequest(await readJsonBody(request));
    const tool = localToolRegistry[body.tool_id];

    if (!tool) {
      sendJson(response, 400, {
        ok: false,
        tool_id: body.tool_id,
        method: body.method,
        error: { message: `Unknown local tool_id: ${body.tool_id}` }
      });
      return;
    }

    sendJson(response, 200, await invokeJsonRpcTool(tool, body));
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      error: {
        message: error instanceof Error ? error.message : "Unexpected error."
      }
    });
  }
});

server.listen(port, host, () => {
  console.log(`ppt-app standalone dev server listening on http://${host}:${port}`);
});
