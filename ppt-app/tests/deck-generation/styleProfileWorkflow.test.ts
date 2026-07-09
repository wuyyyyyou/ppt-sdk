import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AgentClient, AgentRunOptions } from "../../src/agent/agentClient.ts";
import type { PptBackend } from "../../src/api/pptBackend.ts";
import type { AppHostUploadClient } from "../../src/runtime/appHostUploadClient.ts";
import {
  createStyleProfile,
  type CreateStyleProfileWorkflowEvent,
} from "../../src/features/deck-generation/styleProfileWorkflow.ts";

function createFile(name = "reference.png") {
  return new File(["reference"], name, { type: "image/png" });
}

function createHarness(options: { retry?: boolean } = {}) {
  let fingerprintReads = 0;
  const events: CreateStyleProfileWorkflowEvent[] = [];
  const calls: string[] = [];
  const context = {
    library_dir: "/tmp/style-profiles",
    creation_dir: "/tmp/style-profiles/creating/style-profile-creation-1",
    uploads_dir: "/tmp/style-profiles/creating/style-profile-creation-1/uploads",
    references_dir: "/tmp/style-profiles/creating/style-profile-creation-1/references",
    rasterized_dir: "/tmp/style-profiles/creating/style-profile-creation-1/rasterized",
    draft_dir: "/tmp/style-profiles/creating/style-profile-creation-1/draft",
    draft_profile_path: "/tmp/style-profiles/creating/style-profile-creation-1/draft/profile.md",
    manifest_path: "/tmp/style-profiles/creating/style-profile-creation-1/manifest.json",
    creation_id: "style-profile-creation-1",
    manifest: {
      version: 1 as const,
      creation_id: "style-profile-creation-1",
      display_name: "Profile",
      status: "uploaded" as const,
      reference_materials: [],
      reference_images: [],
      selected_reference_image_ids: ["image-1"],
      created_at: "2026-07-09T00:00:00.000Z",
      updated_at: "2026-07-09T00:00:00.000Z",
    },
    selected_reference_images: [{
      reference_image_id: "image-1",
      source_reference_id: "reference-1",
      source_file_path: "/tmp/reference.png",
      page_number: null,
      file_path: "/tmp/style-profiles/creating/style-profile-creation-1/references/reference.png",
      width: 1280,
      height: 720,
      selected_for_analysis: true,
      order: 1,
    }],
  };
  const backend = {
    prepareStyleProfileCreation: async () => {
      calls.push("prepare");
      return {
        ...context,
        display_name: "Profile",
        prepared_at: "2026-07-09T00:00:00.000Z",
      };
    },
    commitStyleProfileReferenceHostUpload: async () => {
      calls.push("commit");
      return {
        creation_id: "style-profile-creation-1",
        upload_id: "upload-1",
        host_upload: {
          transport: "host_upload" as const,
          r2_key: "r2",
          url: "https://upload.example/reference.png",
          mime_type: "image/png",
          size_bytes: 9,
        },
        material: {
          reference_id: "reference-1",
          original_filename: "reference.png",
          display_name: "reference.png",
          mime_type: "image/png",
          extension: ".png",
          size_bytes: 9,
          sha256: "sha",
          file_path: "/tmp/reference.png",
          kind: "image" as const,
          created_at: "2026-07-09T00:00:00.000Z",
        },
        manifest: context.manifest,
        warnings: [],
      };
    },
    getStyleProfileCreationContext: async () => {
      calls.push("context");
      return context;
    },
    getStyleProfileDraftFingerprint: async () => {
      fingerprintReads += 1;
      return fingerprintReads % 2 === 1
        ? { creation_id: "style-profile-creation-1", draft_path: context.draft_profile_path, exists: false as const }
        : {
            creation_id: "style-profile-creation-1",
            draft_path: context.draft_profile_path,
            exists: true as const,
            sha256: `sha-${fingerprintReads}`,
            size_bytes: 512,
          };
    },
    publishStyleProfile: async () => {
      calls.push("publish");
      return {
        style_profile: {
          version: 1 as const,
          style_profile_id: "style-profile-1",
          display_name: "Profile",
          profile_dir: "/tmp/profile",
          profile_path: "/tmp/profile/profile.md",
          metadata_path: "/tmp/profile/metadata.json",
          profile_sha256: "sha",
          size_bytes: 512,
          reference_count: 1,
          source_file_count: 1,
          created_at: "2026-07-09T00:00:00.000Z",
          updated_at: "2026-07-09T00:00:00.000Z",
        },
        index: {
          version: 1 as const,
          library_dir: "/tmp/style-profiles",
          profiles: [],
          updated_at: "2026-07-09T00:00:00.000Z",
        },
        profile_path: "/tmp/profile/profile.md",
        reference_count: 1,
      };
    },
  } as unknown as PptBackend;
  const hostUploadClient = {
    uploadFile: async () => ({
      transport: "host_upload" as const,
      r2_key: "r2",
      url: "https://upload.example/reference.png",
      mime_type: "image/png",
      size_bytes: 9,
      filename: "reference.png",
    }),
  } satisfies AppHostUploadClient;
  const agentClient = {
    checkToolAccess: async () => undefined,
    runAuthoringPrompt: async (_prompt: string, runOptions?: AgentRunOptions) => {
      runOptions?.onStreamEvent?.({ type: "activity", message: "Analyzing reference image" });
      runOptions?.onStreamEvent?.({ type: "content", text: "stream line" });
      return {
        status: "ready_for_render" as const,
        changed_files: ["draft/profile.md"],
        summary: "Wrote profile",
        needs_render: false,
        notes: [],
      };
    },
    runPageVisualReviewPrompt: async () => { throw new Error("not used"); },
    runPageContentReviewPrompt: async () => { throw new Error("not used"); },
    close: async () => undefined,
  } satisfies AgentClient;

  return {
    backend,
    hostUploadClient,
    agentClient,
    events,
    calls,
    input: {
      backend,
      hostUploadClient,
      agentClient,
      displayName: "Profile",
      files: options.retry ? [] : [createFile()],
      creationId: options.retry ? "style-profile-creation-1" : undefined,
      skipUpload: options.retry,
      onProgress: (event: CreateStyleProfileWorkflowEvent) => events.push(event),
    },
  };
}

describe("Style Profile workflow", () => {
  it("emits three-phase progress and Agent stream events", async () => {
    const harness = createHarness();
    const result = await createStyleProfile(harness.input);

    assert.equal(result.publishResult.style_profile.style_profile_id, "style-profile-1");
    assert.deepEqual(
      harness.events
        .filter((event) => event.type === "phase-start")
        .map((event) => event.phase),
      ["prepare", "analyze", "publish"],
    );
    assert.ok(harness.events.some((event) => event.type === "creation-prepared"));
    assert.ok(harness.events.some((event) => event.type === "stream" && event.event.type === "content"));
  });

  it("can retry analysis with an existing creation id without re-uploading files", async () => {
    const harness = createHarness({ retry: true });
    await createStyleProfile(harness.input);

    assert.equal(harness.calls.includes("prepare"), false);
    assert.equal(harness.calls.includes("commit"), false);
    assert.ok(harness.calls.includes("context"));
    assert.ok(harness.calls.includes("publish"));
  });
});
