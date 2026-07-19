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

function getToolParameter(
  manifest: {
    tools: Array<{
      name: string;
      parameters?: Array<{ name: string; required?: boolean; description?: string }>;
    }>;
  },
  toolName: string,
  parameterName: string,
) {
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

test("app_patch_workspace_settings is declared and returns settings without a workspace upload", async () => {
  const source = await readFile(new URL("../../example_plugin.js", import.meta.url), "utf8");
  const manifest = JSON.parse(
    await readFile(new URL("../../manifest.json", import.meta.url), "utf8"),
  ) as { tools: Array<{ name: string }> };

  assert.match(source, /app_patch_workspace_settings:\s*toolAppPatchWorkspaceSettings/);
  assert.match(source, /return patchAppWorkspaceSettings\(\{/);
  assert.ok(manifest.tools.some((tool) => tool.name === "app_patch_workspace_settings"));
});

test("Workspace Diagnostic Bundle tool is declared and routed through the APS plugin wrapper", async () => {
  const source = await readFile(new URL("../../example_plugin.js", import.meta.url), "utf8");
  const manifest = JSON.parse(
    await readFile(new URL("../../manifest.json", import.meta.url), "utf8"),
  ) as { tools: Array<{ name: string }> };

  assert.match(
    source,
    /app_prepare_workspace_diagnostic_bundle:\s*toolAppPrepareWorkspaceDiagnosticBundle/,
  );
  assert.ok(
    manifest.tools.some((tool) => tool.name === "app_prepare_workspace_diagnostic_bundle"),
  );
});

test("dedicated Outline lifecycle tools are declared and routed", async () => {
  const source = await readFile(new URL("../../example_plugin.js", import.meta.url), "utf8");
  const manifest = JSON.parse(
    await readFile(new URL("../../manifest.json", import.meta.url), "utf8"),
  ) as { tools: Array<{ name: string }> };
  const toolNames = manifest.tools.map((tool) => tool.name);

  assert.match(source, /app_reset_workspace_outline:\s*toolAppResetWorkspaceOutline/);
  assert.match(source, /app_save_workspace_outline_draft:\s*toolAppSaveWorkspaceOutlineDraft/);
  assert.match(source, /app_confirm_workspace_outline:\s*toolAppConfirmWorkspaceOutline/);
  assert.ok(toolNames.includes("app_reset_workspace_outline"));
  assert.ok(toolNames.includes("app_save_workspace_outline_draft"));
  assert.ok(toolNames.includes("app_confirm_workspace_outline"));
  assert.equal(toolNames.includes("app_update_workspace_outline"), false);
});

let patchSettingsInvokeSkip: string | false = false;
try {
  const distIndex = await readFile(new URL("../../dist/index.js", import.meta.url), "utf8");
  if (!distIndex.includes("patchAppWorkspaceSettings")) {
    patchSettingsInvokeSkip = "requires a built dist/index.js with patchAppWorkspaceSettings support";
  }
} catch {
  patchSettingsInvokeSkip = "requires a built dist/index.js";
}

test(
  "app_patch_workspace_settings plugin invoke returns inline settings data",
  { skip: patchSettingsInvokeSkip, timeout: 15_000 },
  async () => {
    const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-plugin-settings-home-"));
    const workspaceDir = path.join(homeDir, "anna-workspace", "ppt", "ppt-20260710-000001");
    const previousHome = process.env.HOME;
    process.env.HOME = homeDir;
    const plugin = await startPluginProcess();

    try {
      const response = await plugin.request("invoke", {
        tool: "app_patch_workspace_settings",
        arguments: {
          workspace_dir: workspaceDir,
          setting: { visual_review_enabled: true },
          persist_as_default: true,
        },
      });

      assert.ok(!response.error, response.error?.message);
      assert.equal(response.result?.data?.workspace_dir, workspaceDir);
      assert.deepEqual(response.result?.data?.setting, {
        page_generation_concurrency: 5,
        visual_review_enabled: true,
        visual_review_failure_limit: 2,
        disable_web_research: false,
        disable_image_research: false,
        updated_at: (response.result?.data?.setting as Record<string, unknown>)?.updated_at,
      });
      assert.equal(response.result?.data?.persisted_as_default, true);
      assert.equal("workspace_upload" in (response.result?.data ?? {}), false);
    } finally {
      await plugin.close();
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
      await rm(homeDir, { recursive: true, force: true });
    }
  },
);

test("app_get_workspace_defaults is declared and routed", async () => {
  const source = await readFile(new URL("../../example_plugin.js", import.meta.url), "utf8");
  const manifest = JSON.parse(
    await readFile(new URL("../../manifest.json", import.meta.url), "utf8"),
  ) as { tools: Array<{ name: string }> };

  assert.match(source, /app_get_workspace_defaults:\s*toolAppGetWorkspaceDefaults/);
  assert.ok(manifest.tools.some((tool) => tool.name === "app_get_workspace_defaults"));
});

test("Authoring Kit and Page Source workspace tools are declared and routed", async () => {
  const source = await readFile(new URL("../../example_plugin.js", import.meta.url), "utf8");
  const manifest = JSON.parse(
    await readFile(new URL("../../manifest.json", import.meta.url), "utf8"),
  ) as { tools: Array<{ name: string; parameters?: Array<{ name: string; required?: boolean }> }> };

  for (const [toolName, handlerName] of [
    ["app_install_workspace_authoring_kit", "toolAppInstallWorkspaceAuthoringKit"],
    ["app_ensure_confirmed_outline_page_ids", "toolAppEnsureConfirmedOutlinePageIds"],
    ["app_prepare_workspace_page_sources", "toolAppPrepareWorkspacePageSources"],
    ["app_reconcile_workspace_page_sources", "toolAppReconcileWorkspacePageSources"],
    ["app_commit_workspace_style_guide_host_upload", "toolAppCommitWorkspaceStyleGuideHostUpload"],
    ["app_get_workspace_style_guide_status", "toolAppGetWorkspaceStyleGuideStatus"],
    ["app_initialize_page_progress", "toolAppInitializePageProgress"],
    ["app_rebuild_workspace_deck_manifest", "toolAppRebuildWorkspaceDeckManifest"],
    ["app_get_workspace_page_source_fingerprint", "toolAppGetWorkspacePageSourceFingerprint"],
  ] as const) {
    assert.match(source, new RegExp(`${toolName}:\\s*${handlerName}`));
    assert.ok(manifest.tools.some((tool) => tool.name === toolName), `Missing ${toolName}`);
    assert.equal(getToolParameter(manifest, toolName, "workspace_dir").required, true);
  }

  assert.equal(
    getToolParameter(manifest, "app_get_workspace_page_source_fingerprint", "page_id").required,
    true,
  );
});

test("Workspace Style Guide Host Upload waits for persistence before staging cleanup", async () => {
  const source = await readFile(new URL("../../example_plugin.js", import.meta.url), "utf8");
  const handler = source.match(
    /async function toolAppCommitWorkspaceStyleGuideHostUpload\(args\) \{[\s\S]*?\n\}/,
  )?.[0];

  assert.ok(handler, "Missing Workspace Style Guide Host Upload handler");
  assert.match(handler, /return await recordAppWorkspaceStyleGuide\(\{/);
});

test("app_get_rendered_deck_html is declared and routed", async () => {
  const source = await readFile(new URL("../../example_plugin.js", import.meta.url), "utf8");
  const manifest = JSON.parse(
    await readFile(new URL("../../manifest.json", import.meta.url), "utf8"),
  ) as { tools: Array<{ name: string }> };

  assert.match(source, /app_get_rendered_deck_html:\s*toolAppGetRenderedDeckHtml/);
  assert.ok(manifest.tools.some((tool) => tool.name === "app_get_rendered_deck_html"));
});

test("app_rasterize_pptx_to_images is declared and routed", async () => {
  const source = await readFile(new URL("../../example_plugin.js", import.meta.url), "utf8");
  const manifest = JSON.parse(
    await readFile(new URL("../../manifest.json", import.meta.url), "utf8"),
  ) as { tools: Array<{ name: string; parameters?: Array<{ name: string; required?: boolean }> }> };

  assert.match(source, /app_rasterize_pptx_to_images:\s*toolAppRasterizePptxToImages/);
  assert.match(source, /rasterizePptxToImages\(/);
  assert.equal(getToolParameter(manifest, "app_rasterize_pptx_to_images", "pptx_path").required, true);
  assert.equal(getToolParameter(manifest, "app_rasterize_pptx_to_images", "output_dir").required, true);
  assert.equal(getToolParameter(manifest, "app_rasterize_pptx_to_images", "target_height").required, false);
  assert.equal(getToolParameter(manifest, "app_rasterize_pptx_to_images", "overwrite").required, false);
});

test("style profile app tools are declared and routed", async () => {
  const source = await readFile(new URL("../../example_plugin.js", import.meta.url), "utf8");
  const manifest = JSON.parse(
    await readFile(new URL("../../manifest.json", import.meta.url), "utf8"),
  ) as { tools: Array<{ name: string; parameters?: Array<{ name: string; required?: boolean }> }> };

  for (const [toolName, handlerName] of [
    ["app_list_style_profiles", "toolAppListStyleProfiles"],
    ["app_get_style_profile_preview", "toolAppGetStyleProfilePreview"],
    ["app_get_style_profile", "toolAppGetStyleProfile"],
    ["app_prepare_style_profile_creation", "toolAppPrepareStyleProfileCreation"],
    ["app_commit_style_profile_reference_host_upload", "toolAppCommitStyleProfileReferenceHostUpload"],
    ["app_get_style_profile_creation_context", "toolAppGetStyleProfileCreationContext"],
    ["app_get_style_profile_draft_fingerprint", "toolAppGetStyleProfileDraftFingerprint"],
    ["app_get_style_profile_draft", "toolAppGetStyleProfileDraft"],
    ["app_publish_style_profile", "toolAppPublishStyleProfile"],
    ["app_select_workspace_style_profile", "toolAppSelectWorkspaceStyleProfile"],
    ["app_get_workspace_style_profile", "toolAppGetWorkspaceStyleProfile"],
    ["app_clear_workspace_style_profile", "toolAppClearWorkspaceStyleProfile"],
  ] as const) {
    assert.match(source, new RegExp(`${toolName}:\\s*${handlerName}`));
    assert.ok(manifest.tools.some((tool) => tool.name === toolName), `Missing ${toolName}`);
  }

  assert.equal(
    getToolParameter(manifest, "app_get_style_profile_preview", "style_profile_id").required,
    true,
  );
  assert.equal(
    getToolParameter(manifest, "app_get_style_profile", "style_profile_id").required,
    true,
  );
  assert.match(source, /uploadStyleProfileReferenceImagePreview/);
  assert.match(source, /const\s+\{\s*file_path,\s*\.\.\.publicImage\s*\}\s*=\s*image/);
  assert.match(source, /image_upload:\s*await uploadLocalFileToHost/);

  assert.equal(
    getToolParameter(manifest, "app_commit_style_profile_reference_host_upload", "creation_id").required,
    true,
  );
  assert.equal(
    getToolParameter(manifest, "app_commit_style_profile_reference_host_upload", "host_upload").required,
    true,
  );
  assert.equal(
    getToolParameter(manifest, "app_publish_style_profile", "display_name").required,
    false,
  );
});

test("app_get_research_evidence returns a JSON result reference", async () => {
  const source = await readFile(new URL("../../example_plugin.js", import.meta.url), "utf8");
  const manifest = JSON.parse(
    await readFile(new URL("../../manifest.json", import.meta.url), "utf8"),
  ) as { tools: Array<{ name: string; description?: string }> };

  assert.match(source, /app_get_research_evidence:\s*toolAppGetResearchEvidence/);
  assert.match(source, /registerJsonReference\(\s*await getAppResearchEvidence/);
  assert.match(source, /"research-evidence\.json"/);
  assert.match(source, /"result_upload"/);
  assert.match(
    manifest.tools.find((tool) => tool.name === "app_get_research_evidence")?.description ?? "",
    /result_upload/,
  );
});

test("workspace theme token tools are declared and routed", async () => {
  const source = await readFile(new URL("../../example_plugin.js", import.meta.url), "utf8");
  const manifest = JSON.parse(
    await readFile(new URL("../../manifest.json", import.meta.url), "utf8"),
  ) as { tools: Array<{ name: string; parameters?: Array<{ name: string; required?: boolean }> }> };

  for (const [toolName, handlerName] of [
    ["app_get_workspace_theme_context", "toolAppGetWorkspaceThemeContext"],
    ["app_validate_workspace_theme_token", "toolAppValidateWorkspaceThemeToken"],
    ["app_record_workspace_theme_token", "toolAppRecordWorkspaceThemeToken"],
  ] as const) {
    assert.match(source, new RegExp(`${toolName}:\\s*${handlerName}`));
    assert.ok(manifest.tools.some((tool) => tool.name === toolName), `Missing ${toolName}`);
  }

  assert.equal(
    getToolParameter(manifest, "app_record_workspace_theme_token", "use_default").required,
    false,
  );

  assert.match(source, /"ai-theme"/);
  assert.match(source, /"ai-theme-interactions"/);
  assert.match(
    getToolParameter(manifest, "app_append_workspace_log", "channel").description ?? "",
    /ai-theme-interactions/,
  );
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

test("app_append_workspace_log plugin wrapper accepts theme and style-guide log channels", { skip: pluginInvokeSkip }, async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-plugin-theme-log-home-"));
  const workspaceDir = path.join(homeDir, "anna-workspace", "ppt", "ppt-20260701-000002");
  const previousHome = process.env.HOME;
  process.env.HOME = homeDir;
  const plugin = await startPluginProcess();

  try {
    for (const channel of [
      "ai-theme",
      "ai-theme-interactions",
      "ai-style-guide",
      "ai-style-guide-interactions",
    ] as const) {
      const response = await plugin.request("invoke", {
        tool: "app_append_workspace_log",
        arguments: {
          workspace_dir: workspaceDir,
          channel,
          entry: {
            event: `${channel}.test`,
            schema_version: 1,
          },
        },
      });
      assert.ok(!response.error, response.error?.message);
    }

    const themeLog = await readFile(path.join(workspaceDir, ".log", "ai-theme.jsonl"), "utf8");
    const themeInteractionLog = await readFile(
      path.join(workspaceDir, ".log", "ai-theme-interactions.jsonl"),
      "utf8",
    );
    const styleGuideLog = await readFile(path.join(workspaceDir, ".log", "ai-style-guide.jsonl"), "utf8");
    const styleGuideInteractionLog = await readFile(
      path.join(workspaceDir, ".log", "ai-style-guide-interactions.jsonl"),
      "utf8",
    );
    assert.match(themeLog, /ai-theme\.test/);
    assert.match(themeInteractionLog, /ai-theme-interactions\.test/);
    assert.match(styleGuideLog, /ai-style-guide\.test/);
    assert.match(styleGuideInteractionLog, /ai-style-guide-interactions\.test/);
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
