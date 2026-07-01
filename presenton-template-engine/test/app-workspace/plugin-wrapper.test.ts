import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface, type Interface } from "node:readline";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

type JsonRpcResponse = {
  id: string | number | null;
  __file_transport?: string;
  __trans_file__?: string;
  result?: {
    success?: boolean;
    data?: Record<string, unknown>;
    tools?: Array<{ name: string; parameters?: Array<{ name: string; required?: boolean }> }>;
  };
  error?: { message?: string };
};

function getToolParameter(manifest: { tools: Array<{ name: string; parameters?: Array<{ name: string; required?: boolean }> }> }, toolName: string, parameterName: string) {
  const tool = manifest.tools.find((item) => item.name === toolName);
  assert.ok(tool, `Missing tool ${toolName}`);
  const parameter = tool.parameters?.find((item) => item.name === parameterName);
  assert.ok(parameter, `Missing parameter ${parameterName} on ${toolName}`);
  return parameter;
}

class PluginProcess {
  private nextId = 1;
  private readonly pending = new Map<string | number, (response: JsonRpcResponse) => void>();
  private readonly lines: Interface;

  constructor(private readonly child: ChildProcessWithoutNullStreams) {
    this.lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
    this.lines.on("line", async (line) => {
      let response = JSON.parse(line) as JsonRpcResponse;
      const transportPath = response.__file_transport ?? response.__trans_file__;
      if (transportPath) {
        response = JSON.parse(await readFile(transportPath, "utf8")) as JsonRpcResponse;
      }
      const resolve = this.pending.get(response.id ?? "");
      if (resolve) {
        this.pending.delete(response.id ?? "");
        resolve(response);
      }
    });
  }

  request(method: string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
    const id = this.nextId;
    this.nextId += 1;
    const promise = new Promise<JsonRpcResponse>((resolve) => {
      this.pending.set(id, resolve);
    });
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return promise;
  }

  async close() {
    this.lines.close();
    this.child.kill("SIGTERM");
  }
}

async function startPluginProcess(): Promise<PluginProcess> {
  const child = spawn(process.execPath, ["example_plugin.js"], {
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stderr.resume();
  return new PluginProcess(child);
}

test("app_update_workspace_settings plugin wrapper forwards persist_as_default", async () => {
  const source = await readFile(new URL("../../example_plugin.js", import.meta.url), "utf8");

  assert.match(
    source,
    /persist_as_default:\s*args\.persist_as_default\s*===\s*true/,
  );
});

test("app_get_workspace_defaults is declared and routed", async () => {
  const source = await readFile(new URL("../../example_plugin.js", import.meta.url), "utf8");
  const manifest = JSON.parse(
    await readFile(new URL("../../manifest.json", import.meta.url), "utf8"),
  ) as { tools: Array<{ name: string }> };

  assert.match(source, /app_get_workspace_defaults:\s*toolAppGetWorkspaceDefaults/);
  assert.ok(manifest.tools.some((tool) => tool.name === "app_get_workspace_defaults"));
});

test("app_get_rendered_deck_html is declared and routed", async () => {
  const source = await readFile(new URL("../../example_plugin.js", import.meta.url), "utf8");
  const manifest = JSON.parse(
    await readFile(new URL("../../manifest.json", import.meta.url), "utf8"),
  ) as { tools: Array<{ name: string }> };

  assert.match(source, /app_get_rendered_deck_html:\s*toolAppGetRenderedDeckHtml/);
  assert.ok(manifest.tools.some((tool) => tool.name === "app_get_rendered_deck_html"));
});

test("research curation draft tools declare optional draft_id", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../../manifest.json", import.meta.url), "utf8"),
  ) as { tools: Array<{ name: string; parameters?: Array<{ name: string; required?: boolean }> }> };

  for (const toolName of [
    "app_record_research_curation_draft",
    "app_get_research_curation_draft",
    "app_get_research_curation_draft_fingerprint",
  ]) {
    const parameter = getToolParameter(manifest, toolName, "draft_id");
    assert.equal(parameter.required, false);
  }
});

test("research curation draft plugin wrapper forwards draft_id", async () => {
  const source = await readFile(new URL("../../example_plugin.js", import.meta.url), "utf8");

  assert.match(source, /const draftId = readOptionalStringArg\(args, "draft_id"\)/);
  assert.match(source, /draft_id:\s*draftId/);
});

let pluginInvokeSkip: string | false = false;
try {
  const distIndex = await readFile(new URL("../../dist/index.js", import.meta.url), "utf8");
  if (!distIndex.includes("draft_id")) {
    pluginInvokeSkip = "requires a built dist/index.js with draft_id support";
  }
} catch {
  pluginInvokeSkip = "requires a built dist/index.js";
}

test("research curation draft plugin invoke uses scoped draft_id paths", { skip: pluginInvokeSkip }, async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-plugin-draft-home-"));
  const workspaceDir = path.join(homeDir, "anna-workspace", "ppt", "ppt-20260701-000001");
  const previousHome = process.env.HOME;
  process.env.HOME = homeDir;
  const plugin = await startPluginProcess();

  try {
    const describe = await plugin.request("describe");
    assert.ok(!describe.error, describe.error?.message);
    const tools = describe.result?.tools ?? [];
    const manifest = { tools };
    assert.equal(getToolParameter(manifest, "app_record_research_curation_draft", "draft_id").required, false);

    const draftId = "discovery-page-06-web-1-test-run";
    const record = await plugin.request("invoke", {
      tool: "app_record_research_curation_draft",
      arguments: {
        workspace_dir: workspaceDir,
        page_id: "page-01",
        draft_type: "web",
        draft_id: draftId,
        draft: {
          version: 1,
          status: "curated",
          facts: [{ id: "fact-1", claim: "Scoped claim", source_type: "web_source" }],
          derived_insights: [],
          gaps: [],
          rejected_material: [],
        },
      },
    });
    assert.ok(!record.error, record.error?.message);
    assert.equal(path.basename(String(record.result?.data?.draft_path)), `${draftId}-web.json`);

    const read = await plugin.request("invoke", {
      tool: "app_get_research_curation_draft",
      arguments: {
        workspace_dir: workspaceDir,
        page_id: "page-01",
        draft_type: "web",
        draft_id: draftId,
      },
    });
    assert.ok(!read.error, read.error?.message);
    assert.equal(path.basename(String(read.result?.data?.draft_path)), `${draftId}-web.json`);

    const fingerprint = await plugin.request("invoke", {
      tool: "app_get_research_curation_draft_fingerprint",
      arguments: {
        workspace_dir: workspaceDir,
        page_id: "page-01",
        draft_type: "web",
        draft_id: draftId,
      },
    });
    assert.ok(!fingerprint.error, fingerprint.error?.message);
    assert.equal(fingerprint.result?.data?.draft_id, draftId);
    assert.equal(path.basename(String(fingerprint.result?.data?.draft_path)), `${draftId}-web.json`);

    const legacy = await plugin.request("invoke", {
      tool: "app_get_research_curation_draft_fingerprint",
      arguments: {
        workspace_dir: workspaceDir,
        page_id: "page-01",
        draft_type: "web",
      },
    });
    assert.ok(!legacy.error, legacy.error?.message);
    assert.equal(legacy.result?.data?.exists, false);
    assert.equal(path.basename(String(legacy.result?.data?.draft_path)), "page-01-web.json");
  } finally {
    await plugin.close();
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    await rm(homeDir, { recursive: true, force: true });
  }
});
