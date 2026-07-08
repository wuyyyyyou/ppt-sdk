import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function readJsonLine(filePath: string): Promise<Record<string, unknown>> {
  const line = (await readFile(filePath, "utf8")).trim().split(/\r?\n/)[0];
  return JSON.parse(line) as Record<string, unknown>;
}

test("workspace AI interaction logs support sidecar payloads", async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-workspace-log-home-"));
  process.env.HOME = homeDir;

  const { createAppWorkspace, appendAppWorkspaceLog } = await import("../../src/app-workspace/index.ts");

  try {
    const workspace = await createAppWorkspace({ title: "Log payloads" });
    const payloadText = "x".repeat(2048);
    const result = await appendAppWorkspaceLog({
      workspace_dir: workspace.workspace_dir,
      channel: "ai-outline-interactions",
      entry: {
        event: "ai.outline.interaction.started",
        schema_version: 1,
        request: { text: payloadText },
      },
      payload_keys: ["request"],
      inline_payload_max_bytes: 32,
    });

    assert.equal(result.appended, true);
    assert.equal(path.basename(result.log_file), "ai-outline-interactions.jsonl");

    const entry = await readJsonLine(result.log_file);
    const ref = entry.request as Record<string, unknown>;
    assert.equal(ref.__workspace_log_payload, true);
    assert.equal(typeof ref.path, "string");
    assert.equal(typeof ref.relative_path, "string");
    assert.equal(typeof ref.sha256, "string");
    assert.equal(typeof ref.size, "number");

    const payload = JSON.parse(await readFile(String(ref.path), "utf8")) as { text?: string };
    assert.equal(payload.text, payloadText);
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    await rm(homeDir, { recursive: true, force: true });
  }
});
