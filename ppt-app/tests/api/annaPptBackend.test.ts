import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { createAnnaPptBackend } from "../../src/api/annaPptBackend.ts";
import type { WorkspaceResult } from "../../src/api/types.ts";
import type { AnnaRuntime } from "../../src/runtime/annaRuntime.ts";

function setToolIds() {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      __ANNA_TOOL_IDS__: {
        "ppt-engine": "tool-ppt-engine",
        "ppt-gener": "tool-ppt-gener",
        "anna-search": "tool-anna-search",
      },
    },
  });
}

function createRuntime(result: unknown): AnnaRuntime {
  return {
    tools: {
      invoke: async () => result,
    },
    llm: { complete: async () => ({}) },
    agent: { session: async () => { throw new Error("not used"); } },
  };
}

function createWorkspace(patch: Partial<WorkspaceResult> = {}): WorkspaceResult {
  return {
    workspace_root: "/tmp/workspaces",
    workspace_dir: "/tmp/workspaces/demo",
    workspace_id: "demo",
    initialized: true,
    created_files: [],
    missing_files: [],
    files: {
      task: "/tmp/workspaces/demo/task.json",
      setting: "/tmp/workspaces/demo/setting.json",
      outline: "/tmp/workspaces/demo/outline.json",
      pages: "/tmp/workspaces/demo/pages.json",
      template: "/tmp/workspaces/demo/template.json",
    },
    task: {},
    setting: {},
    outline: {},
    pages: [],
    template: {},
    ...patch,
  };
}

describe("Anna PPT Backend", () => {
  it("fetches HTTP JSON references for workspace results", async () => {
    setToolIds();
    const workspace = createWorkspace({ workspace_id: "from-http" });
    const originalFetch = globalThis.fetch;
    const fetchMock = mock.fn(async () =>
      new Response(JSON.stringify(workspace), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const backend = createAnnaPptBackend(createRuntime({
        success: true,
        data: {
          workspace_url: "http://127.0.0.1:12345/json/demo/workspace.json",
        },
      }));

      const result = await backend.openWorkspace({ workspace_dir: "/tmp/workspaces/demo" });

      assert.equal(result.workspace_id, "from-http");
      assert.equal(fetchMock.mock.callCount(), 1);
      assert.equal(fetchMock.mock.calls[0].arguments[0], "http://127.0.0.1:12345/json/demo/workspace.json");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
