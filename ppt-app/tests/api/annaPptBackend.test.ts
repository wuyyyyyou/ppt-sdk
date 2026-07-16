import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { createAnnaPptBackend } from "../../src/api/annaPptBackend.ts";
import type {
  CreateWorkspaceResult,
  HostUploadRef,
  WorkspaceResult,
} from "../../src/api/types.ts";
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

function createRuntimeWithInvoke(invoke: AnnaRuntime["tools"]["invoke"]): AnnaRuntime {
  return {
    tools: { invoke },
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

function createJsonUploadRef(filename: string): HostUploadRef {
  return {
    transport: "host_upload",
    r2_key: `uploads/${filename}`,
    url: `https://upload.example/${filename}`,
    mime_type: "application/json",
    size_bytes: 128,
    filename,
    mode: "negotiate+confirm",
  };
}

describe("Anna PPT Backend", () => {
  it("returns bounded create workspace results inline", async () => {
    setToolIds();
    const created: CreateWorkspaceResult = {
      version: 1,
      workspace_root: "/tmp/workspaces",
      workspace_id: "demo",
      workspace_dir: "/tmp/workspaces/demo",
      title: "Demo",
      setting: {
        output_language: "auto",
        text_density: "balanced",
        page_generation_concurrency: 5,
        content_review_enabled: false,
        content_review_failure_limit: 5,
        visual_review_enabled: false,
        visual_review_failure_limit: 2,
        review_outline_first: false,
        disable_web_research: false,
        disable_image_research: false,
      },
    };
    const originalFetch = globalThis.fetch;
    const fetchMock = mock.fn(async () => new Response(null, { status: 500 }));
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const backend = createAnnaPptBackend(createRuntime({ success: true, data: created }));
      assert.deepEqual(await backend.createWorkspace({ title: "Demo" }), created);
      assert.equal(fetchMock.mock.callCount(), 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("fetches Host Upload JSON references for workspace results", async () => {
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
          workspace_upload: createJsonUploadRef("workspace.json"),
        },
      }));

      const result = await backend.openWorkspace({ workspace_dir: "/tmp/workspaces/demo" });

      assert.equal(result.workspace_id, "from-http");
      assert.equal(fetchMock.mock.callCount(), 1);
      assert.equal(fetchMock.mock.calls[0].arguments[0], "https://upload.example/workspace.json");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns inline workspace setting patches without fetching Host Upload JSON", async () => {
    setToolIds();
    const originalFetch = globalThis.fetch;
    const fetchMock = mock.fn(async () => new Response(null, { status: 500 }));
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const backend = createAnnaPptBackend(createRuntime({
        success: true,
        data: {
          workspace_dir: "/tmp/workspaces/demo",
          setting: { review_outline_first: true },
          persisted_as_default: true,
        },
      }));

      const result = await backend.updateWorkspaceSettings({
        workspace_dir: "/tmp/workspaces/demo",
        setting: { review_outline_first: true },
        persist_as_default: true,
      });

      assert.equal(result.setting.review_outline_first, true);
      assert.equal(result.persisted_as_default, true);
      assert.equal(fetchMock.mock.callCount(), 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("fetches Host Upload JSON references for research evidence results", async () => {
    setToolIds();
    const evidence = {
      version: 1,
      status: "curated",
      pages: [{ page_id: "page-01", status: "curated" }],
      shared: { facts: [], visual_assets: [], gaps: [] },
      updated_at: "2026-07-07T00:00:00.000Z",
    };
    const originalFetch = globalThis.fetch;
    const fetchMock = mock.fn(async () =>
      new Response(JSON.stringify(evidence), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const backend = createAnnaPptBackend(createRuntime({
        success: true,
        data: {
          result_upload: createJsonUploadRef("research-evidence.json"),
        },
      }));

      const result = await backend.getResearchEvidence({ workspace_dir: "/tmp/workspaces/demo" });

      assert.equal(result.status, "curated");
      assert.equal(result.pages[0]?.page_id, "page-01");
      assert.equal(fetchMock.mock.callCount(), 1);
      assert.equal(fetchMock.mock.calls[0].arguments[0], "https://upload.example/research-evidence.json");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("routes Style Profile preview and detail tools through ppt-engine", async () => {
    setToolIds();
    const calls: Array<{ method?: unknown; args?: unknown; tool_id?: unknown }> = [];
    const backend = createAnnaPptBackend(createRuntimeWithInvoke(async (input) => {
      calls.push(input as { method?: unknown; args?: unknown; tool_id?: unknown });
      return {
        success: true,
        data: {
          style_profile: { style_profile_id: "style-profile-1" },
          cover_image: null,
          reference_images: [],
          content: "",
          size_bytes: 0,
          sha256: "",
        },
      };
    }));

    await backend.getStyleProfilePreview({ style_profile_id: "style-profile-1" });
    await backend.getStyleProfile({ style_profile_id: "style-profile-1" });

    assert.equal(calls[0]?.tool_id, "tool-ppt-engine");
    assert.equal(calls[0]?.method, "app_get_style_profile_preview");
    assert.deepEqual(calls[0]?.args, { style_profile_id: "style-profile-1" });
    assert.equal(calls[1]?.method, "app_get_style_profile");
  });
});
