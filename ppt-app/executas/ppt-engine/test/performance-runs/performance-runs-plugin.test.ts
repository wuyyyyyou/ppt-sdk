import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

test("plugin exposes and runs the Performance Run lifecycle", { timeout: 10_000 }, async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "ppt-performance-plugin-home-"));
  const cwd = fileURLToPath(new URL("../..", import.meta.url));
  const child = spawn(process.execPath, ["example_plugin.js"], {
    cwd,
    env: { ...process.env, HOME: homeDir },
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stderr.resume();
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const pending = new Map<number, (value: Record<string, unknown>) => void>();
  let nextId = 1;
  lines.on("line", async (line) => {
    let message = JSON.parse(line) as { id?: number; __file_transport?: string; __trans_file__?: string };
    const transportPath = message.__file_transport ?? message.__trans_file__;
    if (transportPath) message = JSON.parse(await readFile(transportPath, "utf8")) as typeof message;
    if (typeof message.id === "number") {
      pending.get(message.id)?.(message as Record<string, unknown>);
      pending.delete(message.id);
    }
  });
  const request = (method: string, params?: Record<string, unknown>) => {
    const id = nextId++;
    const response = new Promise<Record<string, unknown>>((resolve) => pending.set(id, resolve));
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return response;
  };
  const invoke = async (tool: string, argumentsValue: Record<string, unknown>) => {
    const response = await request("invoke", { tool, arguments: argumentsValue }) as {
      result?: { data?: Record<string, unknown> };
      error?: { message?: string };
    };
    assert.equal(response.error, undefined, response.error?.message);
    assert.ok(response.result?.data, JSON.stringify(response));
    return response.result.data;
  };

  try {
    await request("initialize", { protocolVersion: "2.0" });
    const described = await request("describe") as { result?: { tools?: Array<{ name?: string; parameters?: Array<{ name?: string }> }> } };
    const createWorkspace = described.result?.tools?.find((tool) => tool.name === "app_create_workspace");
    assert.ok(createWorkspace?.parameters?.some((parameter) => parameter.name === "performance_context"));

    const run = await invoke("app_start_performance_run", { app_version: "test" });
    const runId = String(run.run_id);
    assert.match(runId, /^perf-/);
    await invoke("app_append_performance_events", {
      run_id: runId,
      events: [{
        schema_version: 1,
        event_id: crypto.randomUUID(),
        event_type: "button.interaction",
        recorded_at: new Date().toISOString(),
        producer_id: "plugin-test",
        sequence_number: 0,
        interaction_delay_ms: 1,
        attributes: { button_id: "test.button" },
      }],
    });
    const finalized = await invoke("app_finalize_performance_run", { run_id: runId, locale: "en" });
    assert.equal((finalized.run as Record<string, unknown>)?.status, "completed");
    const regenerated = await invoke("app_regenerate_performance_report", { run_id: runId, locale: "zh" });
    assert.equal(regenerated.status, "completed");
    assert.equal(regenerated.report_locale, "zh");
    const listed = await invoke("app_list_performance_runs", {});
    assert.equal(Array.isArray(listed.runs) ? listed.runs.length : 0, 1);
  } finally {
    child.kill();
    await new Promise<void>((resolve) => child.once("exit", () => resolve()));
    await rm(homeDir, { recursive: true, force: true });
  }
});
