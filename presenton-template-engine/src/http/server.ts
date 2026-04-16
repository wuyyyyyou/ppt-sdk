import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { URL } from "node:url";

import {
  getTemplateGroup,
  listThemePresets,
  listTemplateGroupSummaries,
  renderSlideHtml,
} from "../index.js";

export interface TemplateEngineServerOptions {
  host?: string;
  port?: number;
}

function writeJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload, null, 2));
}

function writeHtml(
  response: ServerResponse,
  statusCode: number,
  payload: string,
) {
  response.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
  });
  response.end(payload);
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(rawBody);
  } catch (error) {
    throw new Error(
      `Invalid JSON request body: ${
        error instanceof Error ? error.message : "Unknown JSON parse error"
      }`,
    );
  }
}

export function createTemplateEngineServer(): Server {
  return createServer(async (request, response) => {
    if (!request.url || !request.method) {
      writeJson(response, 400, { error: "Invalid request" });
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname === "/healthz") {
      writeJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && url.pathname === "/template-groups") {
      writeJson(response, 200, { groups: listTemplateGroupSummaries() });
      return;
    }

    if (request.method === "GET" && url.pathname === "/themes") {
      writeJson(response, 200, { themes: listThemePresets() });
      return;
    }

    if (request.method === "GET" && url.pathname === "/template-info") {
      const groupId = url.searchParams.get("groupId");

      if (!groupId) {
        writeJson(response, 400, { error: 'Missing required query parameter "groupId"' });
        return;
      }

      const group = getTemplateGroup(groupId);
      if (!group) {
        writeJson(response, 404, { error: `Template group "${groupId}" not found` });
        return;
      }

      writeJson(response, 200, { groups: [group] });
      return;
    }

    if (request.method === "POST" && url.pathname === "/render-slide") {
      try {
        const payload = await readJsonBody(request);
        const html = renderSlideHtml(payload);
        writeHtml(response, 200, html);
      } catch (error) {
        writeJson(response, 400, {
          error:
            error instanceof Error ? error.message : "Failed to render slide HTML",
        });
      }
      return;
    }

    writeJson(response, 404, {
      error: "Not found",
      available_endpoints: [
        "GET /healthz",
        "GET /template-groups",
        "GET /themes",
        "GET /template-info?groupId=general",
        "POST /render-slide",
      ],
    });
  });
}

export function startTemplateEngineServer(
  options: TemplateEngineServerOptions = {},
): Promise<Server> {
  const host = options.host ?? process.env.HOST ?? "0.0.0.0";
  const port = options.port ?? Number.parseInt(process.env.PORT ?? "3101", 10);
  const server = createTemplateEngineServer();

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      console.log(`template-engine server listening on http://${host}:${port}`);
      resolve(server);
    });
  });
}
