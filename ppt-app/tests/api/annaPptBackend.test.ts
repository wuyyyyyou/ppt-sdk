import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { createAnnaPptBackend } from "../../src/api/annaPptBackend.ts";
import type {
  CreateWorkspaceResult,
  HostUploadRef,
  WorkspaceResult,
} from "../../src/api/types.ts";
import type { AnnaRuntime, AnnaToolInvokeInput } from "../../src/runtime/annaRuntime.ts";

function setToolIds() {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      __ANNA_TOOL_IDS__: {
        "ppt-engine": "tool-ppt-engine",
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
      requirements: "/tmp/workspaces/demo/requirements.json",
      outline: "/tmp/workspaces/demo/outline.json",
      pages: "/tmp/workspaces/demo/pages.json",
      template: "/tmp/workspaces/demo/template.json",
    },
    task: {},
    setting: {},
    requirements: {
      version: 1,
      status: "empty",
      source: null,
      candidates: { audience: [], purpose: [], desired_outcome: [], slide_count: [], output_language: [], visual_tone: [] },
      selections: { audience: null, purpose: null, desired_outcome: null, slide_count: null, output_language: null, visual_tone: null },
      updated_at: null,
      confirmed_at: null,
    },
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
  it("keeps small workspace log entries inline", async () => {
    setToolIds();
    const calls: AnnaToolInvokeInput[] = [];
    const backend = createAnnaPptBackend(createRuntimeWithInvoke(async (input) => {
      calls.push(input);
      return {
        success: true,
        data: { workspace_dir: "/tmp/workspaces/demo", log_file: "demo.jsonl", appended: true },
      };
    }));
    const input = {
      workspace_dir: "/tmp/workspaces/demo",
      channel: "ai-research-interactions" as const,
      entry: { event: "ai.research.interaction.started", request: { text: "small" } },
      payload_keys: ["request"],
    };

    await backend.appendWorkspaceLog(input);

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.method, "app_append_workspace_log");
    assert.deepEqual(calls[0]?.args, input);
  });

  it("uploads large workspace log entries before invoking ppt-engine", async () => {
    setToolIds();
    const calls: AnnaToolInvokeInput[] = [];
    const uploadedBodies: string[] = [];
    let negotiatedSize = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      uploadedBodies.push(await new Response(init?.body).text());
      return new Response("", { status: 200 });
    }) as typeof fetch;
    const runtime = createRuntimeWithInvoke(async (input) => {
      calls.push(input);
      return {
        success: true,
        data: { workspace_dir: "/tmp/workspaces/demo", log_file: "demo.jsonl", appended: true },
      };
    });
    runtime.upload = {
      negotiate: async (input) => {
        negotiatedSize = input.size_bytes;
        return {
          put_url: "https://upload.example/put",
          headers: { "content-type": input.mime_type },
          r2_key: "workspace-logs/entry.json",
        };
      },
      confirm: async ({ r2_key }) => ({
        download_url: "https://upload.example/get",
        r2_key,
        size_bytes: negotiatedSize,
      }),
    };
    const entry = {
      event: "ai.research.interaction.started",
      request: { text: "研究".repeat(20_000) },
    };

    try {
      await createAnnaPptBackend(runtime).appendWorkspaceLog({
        workspace_dir: "/tmp/workspaces/demo",
        channel: "ai-research-interactions",
        entry,
        payload_keys: ["request"],
        inline_payload_max_bytes: 1024,
      });

      assert.deepEqual(uploadedBodies, [JSON.stringify(entry)]);
      assert.equal(negotiatedSize, new TextEncoder().encode(JSON.stringify(entry)).byteLength);
      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.method, "app_append_workspace_log");
      const args = calls[0]?.args as Record<string, unknown>;
      assert.equal(args.entry, undefined);
      assert.deepEqual(args.payload_keys, ["request"]);
      assert.equal(args.inline_payload_max_bytes, 1024);
      assert.deepEqual(args.entry_upload, {
        transport: "host_upload",
        r2_key: "workspace-logs/entry.json",
        url: "https://upload.example/get",
        mime_type: "application/json",
        size_bytes: negotiatedSize,
        filename: "workspace-log-entry.json",
        expires_at: undefined,
        expires_in: undefined,
        mode: "negotiate+confirm",
      });
      assert.ok(new TextEncoder().encode(JSON.stringify(calls[0])).byteLength < 48 * 1024);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("reads runtime information from the running ppt-engine tool", async () => {
    setToolIds();
    const runtime = createRuntimeWithInvoke(async (input) => {
      assert.deepEqual(input, {
        tool_id: "tool-ppt-engine",
        method: "app_get_runtime_info",
        args: {},
      });
      return { success: true, data: { ppt_engine_version: "4.2.4" } };
    });

    const backend = createAnnaPptBackend(runtime);
    assert.deepEqual(await backend.getRuntimeInfo(), { ppt_engine_version: "4.2.4" });
  });

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

  it("falls back to ppt-engine when browser CORS blocks a Host Upload JSON reference", async () => {
    setToolIds();
    const workspace = createWorkspace({ workspace_id: "from-server-fallback" });
    const upload = createJsonUploadRef("workspace.json");
    const calls: AnnaToolInvokeInput[] = [];
    const originalFetch = globalThis.fetch;
    const fetchMock = mock.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const backend = createAnnaPptBackend(createRuntimeWithInvoke(async (input) => {
        calls.push(input);
        if (input.method === "app_open_workspace") {
          return {
            success: true,
            data: { workspace_upload: upload },
          };
        }
        if (input.method === "app_resolve_host_upload_json_reference") {
          return {
            success: true,
            data: workspace,
          };
        }
        throw new Error(`Unexpected tool call: ${input.method}`);
      }));

      const result = await backend.openWorkspace({ workspace_dir: "/tmp/workspaces/demo" });

      assert.equal(result.workspace_id, "from-server-fallback");
      assert.equal(fetchMock.mock.callCount(), 1);
      assert.deepEqual(calls.map((call) => call.method), [
        "app_open_workspace",
        "app_resolve_host_upload_json_reference",
      ]);
      assert.deepEqual(calls[1]?.args, { host_upload: upload });
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
          setting: { visual_review_enabled: true },
          persisted_as_default: true,
        },
      }));

      const result = await backend.updateWorkspaceSettings({
        workspace_dir: "/tmp/workspaces/demo",
        setting: { visual_review_enabled: true },
        persist_as_default: true,
      });

      assert.equal(result.setting.visual_review_enabled, true);
      assert.equal(result.persisted_as_default, true);
      assert.equal(fetchMock.mock.callCount(), 0);
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

  it("routes Presentation Requirements reads and writes through ppt-engine", async () => {
    setToolIds();
    const calls: Array<{ method?: unknown; args?: unknown }> = [];
    const requirements = createWorkspace().requirements;
    const backend = createAnnaPptBackend(createRuntimeWithInvoke(async (input) => {
      calls.push(input as { method?: unknown; args?: unknown });
      return {
        success: true,
        data: input.method === "app_get_workspace_requirements"
          ? requirements
          : createWorkspace(),
      };
    }));

    assert.deepEqual(
      await backend.getWorkspaceRequirements({ workspace_dir: "/tmp/workspaces/demo" }),
      requirements,
    );
    await backend.updateWorkspaceRequirements({
      workspace_dir: "/tmp/workspaces/demo",
      requirements,
    });

    assert.equal(calls[0]?.method, "app_get_workspace_requirements");
    assert.equal(calls[1]?.method, "app_update_workspace_requirements");
  });

  it("routes the Outline lifecycle through the dedicated ppt-engine tools", async () => {
    setToolIds();
    const calls: Array<{ method?: unknown; args?: unknown }> = [];
    const backend = createAnnaPptBackend(createRuntimeWithInvoke(async (input) => {
      calls.push(input as { method?: unknown; args?: unknown });
      return { success: true, data: createWorkspace() };
    }));
    const outline = {
      title: "Demo Outline",
      items: [{
        title: "Opening",
        core_message: "Open with one clear idea.",
        required_content: "- Establish the context.",
      }],
    };

    await backend.resetWorkspaceOutline({ workspace_dir: "/tmp/workspaces/demo" });
    await backend.saveWorkspaceOutlineDraft({ workspace_dir: "/tmp/workspaces/demo", outline });
    await backend.confirmWorkspaceOutline({ workspace_dir: "/tmp/workspaces/demo", outline });

    assert.deepEqual(calls.map((call) => call.method), [
      "app_reset_workspace_outline",
      "app_save_workspace_outline_draft",
      "app_confirm_workspace_outline",
    ]);
  });

  it("routes manual page editing through the dedicated ppt-engine tools", async () => {
    setToolIds();
    const calls: Array<{ method?: unknown; args?: unknown }> = [];
    const backend = createAnnaPptBackend(createRuntimeWithInvoke(async (input) => {
      calls.push(input as { method?: unknown; args?: unknown });
      return { success: true, data: {} };
    }));
    const hostUpload: HostUploadRef = {
      transport: "host_upload",
      r2_key: "uploads/page-01.html",
      url: "https://upload.example/page-01.html",
      mime_type: "text/plain",
      size_bytes: 256,
      filename: "page-01.html",
      mode: "negotiate+confirm",
    };

    await backend.getPageEditContext({ workspace_dir: "/tmp/workspaces/demo", page_id: "page-01" });
    await backend.saveManualPageRevision({
      workspace_dir: "/tmp/workspaces/demo",
      page_id: "page-01",
      base_revision: 2,
      size_bytes: 256,
      host_upload: hostUpload,
    });
    await backend.restorePageSourceVersion({ workspace_dir: "/tmp/workspaces/demo", page_id: "page-01" });

    assert.deepEqual(calls.map((call) => call.method), [
      "app_get_page_edit_context",
      "app_save_manual_page_revision",
      "app_restore_page_source_version",
    ]);
    assert.deepEqual(calls[1]?.args, {
      workspace_dir: "/tmp/workspaces/demo",
      page_id: "page-01",
      base_revision: 2,
      size_bytes: 256,
      host_upload: hostUpload,
    });
  });

  it("separates Export Artifact Mirror publication from download URL minting", async () => {
    setToolIds();
    const calls: Array<{ method?: unknown; args?: unknown }> = [];
    const mirror = {
      provider: "aps.files" as const,
      scope: "user" as const,
      path: "workspaces/demo/exports/current.pptx",
      etag: "etag-1",
      size_bytes: 12,
      content_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      source_updated_at: "2026-07-18T10:00:00Z",
      source_sha256: "a".repeat(64),
      published_at: "2026-07-18T10:00:01Z",
    };
    const artifact = {
      workspace_dir: "/tmp/workspaces/demo",
      workspace_id: "demo",
      title: "Demo",
      artifact_type: "pptx" as const,
      path: "/tmp/workspaces/demo/output/deck.pptx",
      filename: "Demo.pptx",
      updated_at: mirror.source_updated_at,
      mirror,
    };
    const backend = createAnnaPptBackend(createRuntimeWithInvoke(async (input) => {
      calls.push(input as { method?: unknown; args?: unknown });
      return {
        success: true,
        data: input.method === "app_publish_export_artifact"
          ? { status: "ready", artifact, mirror, published: true }
          : {
              status: "ready",
              reason: null,
              artifact,
              mirror,
              download_url: "https://storage.example/current.pptx",
              expires_at: "soon",
            },
      };
    }));

    await backend.publishExportArtifact({
      workspace_dir: artifact.workspace_dir,
      artifact_type: "pptx",
    });
    await backend.getExportArtifactDownloadUrl({
      workspace_dir: artifact.workspace_dir,
      artifact_type: "pptx",
    });

    assert.deepEqual(calls.map((call) => call.method), [
      "app_publish_export_artifact",
      "app_get_export_artifact_download_url",
    ]);
    assert.deepEqual(calls[0]?.args, {
      workspace_dir: artifact.workspace_dir,
      artifact_type: "pptx",
    });
  });

  it("prepares a Workspace Diagnostic Bundle through one long-running ppt-engine tool call", async () => {
    setToolIds();
    const calls: Array<{ method?: unknown; args?: unknown; timeoutMs?: unknown }> = [];
    const result = {
      status: "ready" as const,
      workspace_id: "demo",
      filename: "demo-workspace-diagnostics.zip",
      size_bytes: 1024,
      download_url: "https://storage.example/diagnostic.zip",
      expires_at: "2026-07-19T12:00:00Z",
    };
    const backend = createAnnaPptBackend(createRuntimeWithInvoke(async (input) => {
      calls.push(input as { method?: unknown; args?: unknown; timeoutMs?: unknown });
      return { success: true, data: result };
    }));

    assert.deepEqual(await backend.prepareWorkspaceDiagnosticBundle({
      workspace_dir: "/tmp/workspaces/demo",
    }), result);
    assert.equal(calls[0]?.method, "app_prepare_workspace_diagnostic_bundle");
    assert.deepEqual(calls[0]?.args, { workspace_dir: "/tmp/workspaces/demo" });
    assert.equal(calls[0]?.timeoutMs, 600_000);
  });

  it("uses long-running timeouts for page preview and deck rendering", async () => {
    setToolIds();
    const calls: Array<{ method?: unknown; timeoutMs?: unknown }> = [];
    const backend = createAnnaPptBackend(createRuntimeWithInvoke(async (input) => {
      calls.push(input as { method?: unknown; timeoutMs?: unknown });
      return { success: true, data: {} };
    }));

    await backend.renderWorkspacePagePreview({ workspace_dir: "/tmp/workspaces/demo", page_id: "page-1" });
    await backend.renderDeckHtml({ workspace_dir: "/tmp/workspaces/demo" });

    assert.deepEqual(calls.map((call) => [call.method, call.timeoutMs]), [
      ["app_render_workspace_page_preview", 600_000],
      ["app_render_deck_html", 600_000],
    ]);
  });
});
