import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

test("workspace research tools prepare directories and persist metadata", async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-research-home-"));
  process.env.HOME = homeDir;

  const {
    createAppWorkspace,
    prepareAppResearchWorkspace,
    recordAppResearchPlan,
    getAppResearchPlan,
    recordAppResearchEvidence,
    recordAppResearchEvidencePage,
    finalizeAppResearchVisualAssets,
    getAppResearchEvidence,
    recordAppResearchCurationDraft,
    getAppResearchCurationDraft,
    getAppResearchCurationDraftFingerprint,
    recordAppResearchEvidencePageMarkdown,
    recordAppResearchStatus,
    recordAppResearchStatusPage,
    getAppResearchStatus,
  } = await import("../../src/app-workspace/index.ts");

  try {
    const workspace = await createAppWorkspace({ title: "Research workspace" });
    const prepared = await prepareAppResearchWorkspace({
      workspace_dir: workspace.workspace_dir,
    });

    for (const dirPath of [
      prepared.raw_web_dir,
      prepared.raw_images_dir,
      prepared.evidence_pages_dir,
      prepared.evidence_images_dir,
      prepared.evidence_drafts_dir,
    ]) {
      assert.equal((await stat(dirPath)).isDirectory(), true);
      assert.equal(path.relative(prepared.root_dir, dirPath).startsWith(".."), false);
    }

    const plan = await recordAppResearchPlan({
      workspace_dir: workspace.workspace_dir,
      research_plan: {
        version: 1,
        status: "planned",
        pages: [{ page_id: "page-01", web_research_needed: true }],
      },
    });
    assert.equal(plan.status, "planned");
    assert.deepEqual((await getAppResearchPlan({ workspace_dir: workspace.workspace_dir })).pages, plan.pages);

    const evidence = await recordAppResearchEvidence({
      workspace_dir: workspace.workspace_dir,
      evidence: {
        version: 1,
        status: "partial",
        pages: [{ page_id: "page-01", status: "gap", gaps: ["No result"] }],
        shared: { facts: [], visual_assets: [], gaps: [] },
      },
    });
    assert.equal(evidence.status, "partial");
    assert.equal(evidence.workspace_dir, workspace.workspace_dir);
    assert.equal(path.basename(evidence.evidence_index_path), "evidence-index.json");
    assert.equal(evidence.page_count, 1);
    assert.ok(evidence.updated_at);
    const recordedEvidence = await getAppResearchEvidence({ workspace_dir: workspace.workspace_dir });
    assert.deepEqual(recordedEvidence.pages, [{ page_id: "page-01", status: "gap", gaps: ["No result"] }]);

    const missingDraftFingerprint = await getAppResearchCurationDraftFingerprint({
      workspace_dir: workspace.workspace_dir,
      page_id: "page-01",
      draft_type: "web",
    });
    assert.equal(missingDraftFingerprint.exists, false);
    assert.equal(path.basename(String(missingDraftFingerprint.draft_path)), "page-01-web.json");

    const draft = await recordAppResearchCurationDraft({
      workspace_dir: workspace.workspace_dir,
      page_id: "page-01",
      draft_type: "web",
      draft: {
        version: 1,
        status: "curated",
        facts: [{ id: "fact-1", claim: "Claim", source_type: "web_source" }],
        derived_insights: [],
        gaps: [],
        rejected_material: [],
      },
    });
    assert.equal(draft.status, "curated");
    assert.equal(draft.page_id, "page-01");
    assert.equal(draft.draft_type, "web");
    assert.equal(path.basename(String(draft.draft_path)), "page-01-web.json");
    const draftFingerprint = await getAppResearchCurationDraftFingerprint({
      workspace_dir: workspace.workspace_dir,
      page_id: "page-01",
      draft_type: "web",
    });
    assert.equal(draftFingerprint.exists, true);
    assert.equal(draftFingerprint.page_id, "page-01");
    assert.equal(draftFingerprint.draft_type, "web");
    assert.equal(path.basename(String(draftFingerprint.draft_path)), "page-01-web.json");
    assert.equal(typeof draftFingerprint.sha256, "string");
    assert.ok(Number(draftFingerprint.size_bytes) > 0);
    assert.deepEqual(
      (await getAppResearchCurationDraft({
        workspace_dir: workspace.workspace_dir,
        page_id: "page-01",
        draft_type: "web",
      })).facts,
      draft.facts,
    );
    const scopedDraft = await recordAppResearchCurationDraft({
      workspace_dir: workspace.workspace_dir,
      page_id: "page-01",
      draft_type: "web",
      draft_id: "discovery-page-06-web-1-run",
      draft: {
        version: 1,
        status: "curated",
        facts: [{ id: "fact-scoped", claim: "Scoped claim", source_type: "web_source" }],
        derived_insights: [],
        gaps: [],
        rejected_material: [],
      },
    });
    assert.equal(path.basename(String(scopedDraft.draft_path)), "discovery-page-06-web-1-run-web.json");
    assert.notEqual(scopedDraft.draft_path, draft.draft_path);
    assert.deepEqual(
      (await getAppResearchCurationDraft({
        workspace_dir: workspace.workspace_dir,
        page_id: "page-01",
        draft_type: "web",
      })).facts,
      draft.facts,
    );
    assert.deepEqual(
      (await getAppResearchCurationDraft({
        workspace_dir: workspace.workspace_dir,
        page_id: "page-01",
        draft_type: "web",
        draft_id: "discovery-page-06-web-1-run",
      })).facts,
      scopedDraft.facts,
    );
    const scopedDraftFingerprint = await getAppResearchCurationDraftFingerprint({
      workspace_dir: workspace.workspace_dir,
      page_id: "page-01",
      draft_type: "web",
      draft_id: "discovery-page-06-web-1-run",
    });
    assert.equal(scopedDraftFingerprint.exists, true);
    assert.equal(scopedDraftFingerprint.draft_id, "discovery-page-06-web-1-run");
    assert.equal(path.basename(String(scopedDraftFingerprint.draft_path)), "discovery-page-06-web-1-run-web.json");

    const markdown = await recordAppResearchEvidencePageMarkdown({
      workspace_dir: workspace.workspace_dir,
      page_id: "page-01",
      markdown: "# Evidence\n",
    });
    assert.equal(path.basename(markdown.markdown_path), "page-01.md");
    assert.equal(await readFile(markdown.markdown_path, "utf8"), "# Evidence\n");

    const status = await recordAppResearchStatus({
      workspace_dir: workspace.workspace_dir,
      status: {
        version: 1,
        status: "gap",
        pages: [{ page_id: "page-01", status: "gap" }],
      },
    });
    assert.equal(status.status, "gap");
    assert.deepEqual((await getAppResearchStatus({ workspace_dir: workspace.workspace_dir })).pages, status.pages);

    const evidenceAfterPageUpserts = await recordAppResearchEvidencePage({
      workspace_dir: workspace.workspace_dir,
      page_evidence: {
        page_id: "page-02",
        status: "curated",
        facts: [{ id: "fact-2", claim: "Another claim", source_type: "web_source" }],
        visual_assets: [],
        derived_insights: [],
        gaps: [],
        rejected_material: [],
        markdown_path: path.join(prepared.evidence_pages_dir, "page-02.md"),
      },
    });
    assert.equal(evidenceAfterPageUpserts.page_id, "page-02");
    assert.equal(evidenceAfterPageUpserts.status, "curated");
    assert.equal(evidenceAfterPageUpserts.evidence_index_path, prepared.evidence_index_path);
    assert.equal(evidenceAfterPageUpserts.page_count, 2);
    const evidenceAfterPageUpsertRead = await getAppResearchEvidence({ workspace_dir: workspace.workspace_dir });
    assert.equal(evidenceAfterPageUpsertRead.status, "partial");
    assert.deepEqual(
      evidenceAfterPageUpsertRead.pages.map((page) => page.page_id).sort(),
      ["page-01", "page-02"],
    );

    const replacementEvidence = await recordAppResearchEvidencePage({
      workspace_dir: workspace.workspace_dir,
      page_evidence: {
        page_id: "page-01",
        status: "curated",
        facts: [{ id: "fact-1b", claim: "Replacement claim", source_type: "web_source" }],
        visual_assets: [],
        derived_insights: [],
        gaps: [],
        rejected_material: [],
        markdown_path: path.join(prepared.evidence_pages_dir, "page-01.md"),
      },
    });
    assert.equal(replacementEvidence.page_id, "page-01");
    assert.equal(replacementEvidence.status, "curated");
    assert.equal(replacementEvidence.evidence_index_path, prepared.evidence_index_path);
    assert.equal(replacementEvidence.page_count, 2);
    const replacementEvidenceRead = await getAppResearchEvidence({ workspace_dir: workspace.workspace_dir });
    assert.equal(replacementEvidenceRead.status, "curated");
    assert.equal(replacementEvidenceRead.pages.length, 2);
    assert.equal(
      replacementEvidenceRead.pages.find((page) => page.page_id === "page-01")?.facts?.[0]?.id,
      "fact-1b",
    );

    const rawImagePath = path.join(prepared.raw_images_dir, "candidate.png");
    const rawImageBytes = Buffer.from("fake-image-bytes");
    await writeFile(rawImagePath, rawImageBytes);
    const rawImageSha256 = createHash("sha256").update(rawImageBytes).digest("hex");
    const finalizedVisualAssets = await finalizeAppResearchVisualAssets({
      workspace_dir: workspace.workspace_dir,
      page_id: "page-01",
      visual_assets: [
        {
          id: "image-1",
          file_path: rawImagePath,
          original_raw_path: rawImagePath,
          image_url: "https://example.com/image.png",
          page_url: "https://example.com/page",
          sha256: "stale-draft-sha",
          reason: "Useful image",
          visual_summary: "A usable image.",
        },
      ],
    });
    assert.equal(finalizedVisualAssets.visual_assets.length, 1);
    assert.equal(finalizedVisualAssets.gaps.length, 0);
    assert.ok(
      finalizedVisualAssets.rejected_material.some((item) =>
        item.reason.includes("draft sha256 did not match"),
      ),
    );
    const finalizedAsset = finalizedVisualAssets.visual_assets[0];
    assert.equal(finalizedAsset?.original_raw_path, rawImagePath);
    assert.equal(finalizedAsset?.sha256, rawImageSha256);
    assert.equal(finalizedAsset?.image_url, "https://example.com/image.png");
    assert.equal(finalizedAsset?.page_url, "https://example.com/page");
    assert.ok(finalizedAsset?.file_path.startsWith(prepared.evidence_images_dir));
    assert.match(path.basename(finalizedAsset?.file_path ?? ""), /^page-01-image-1-[a-f0-9]{16}\.png$/);
    assert.deepEqual(await readFile(finalizedAsset?.file_path ?? ""), rawImageBytes);

    const uploadedSourceImagePath = path.join(
      workspace.workspace_dir,
      "uploaded-sources",
      "files",
      "uploaded-source-1",
      "source.jpg",
    );
    await mkdir(path.dirname(uploadedSourceImagePath), { recursive: true });
    const uploadedSourceImageBytes = Buffer.from("uploaded-source-image-bytes");
    await writeFile(uploadedSourceImagePath, uploadedSourceImageBytes);
    const agentFileToolUploadedSourcePath = path.relative(
      path.dirname(path.dirname(workspace.workspace_dir)),
      uploadedSourceImagePath,
    );
    const uploadedSourceVisualAssets = await finalizeAppResearchVisualAssets({
      workspace_dir: workspace.workspace_dir,
      page_id: "page-01",
      visual_assets: [
        {
          id: "uploaded:visual-1",
          file_path: agentFileToolUploadedSourcePath,
          original_raw_path: agentFileToolUploadedSourcePath,
          reason: "Useful uploaded image",
          visual_summary: "A usable uploaded-source image.",
        },
      ],
    });
    assert.equal(uploadedSourceVisualAssets.visual_assets.length, 1);
    assert.equal(uploadedSourceVisualAssets.gaps.length, 0);
    assert.equal(uploadedSourceVisualAssets.rejected_material.length, 0);
    const uploadedSourceAsset = uploadedSourceVisualAssets.visual_assets[0];
    assert.equal(uploadedSourceAsset?.original_raw_path, uploadedSourceImagePath);
    assert.ok(uploadedSourceAsset?.file_path.startsWith(prepared.evidence_images_dir));
    assert.match(
      path.basename(uploadedSourceAsset?.file_path ?? ""),
      /^page-01-uploaded-visual-1-[a-f0-9]{16}\.jpg$/,
    );
    assert.deepEqual(await readFile(uploadedSourceAsset?.file_path ?? ""), uploadedSourceImageBytes);

    const indexedRawImageDir = path.join(prepared.raw_images_dir, "image-fetch-001");
    await mkdir(indexedRawImageDir, { recursive: true });
    const indexedRawImagePath = path.join(indexedRawImageDir, "001-example-com.png");
    const indexedRawImageBytes = Buffer.from("indexed-image-bytes");
    await writeFile(indexedRawImagePath, indexedRawImageBytes);
    const indexedRawImageSha256 = createHash("sha256").update(indexedRawImageBytes).digest("hex");
    const rawImageIndexPath = path.join(indexedRawImageDir, "index.json");
    await writeFile(rawImageIndexPath, JSON.stringify({
      output_dir: indexedRawImageDir,
      index_path: rawImageIndexPath,
      results: [
        {
          url: "https://example.com/indexed.png",
          success: true,
          file_path: indexedRawImagePath,
          relative_path: "001-example-com.png",
          content_type: "image/png",
          bytes: indexedRawImageBytes.length,
          sha256: indexedRawImageSha256,
        },
      ],
      count: 1,
    }));
    const unusableRawImagePath = path.basename(indexedRawImagePath);
    const recoveredVisualAssets = await finalizeAppResearchVisualAssets({
      workspace_dir: workspace.workspace_dir,
      page_id: "page-01",
      raw_image_index_paths: [rawImageIndexPath],
      visual_assets: [
        {
          id: "image-recovered-path",
          file_path: unusableRawImagePath,
          original_raw_path: unusableRawImagePath,
          image_url: "https://example.com/indexed.png",
          sha256: indexedRawImageSha256,
          reason: "Useful indexed image",
          visual_summary: "A usable indexed image.",
        },
      ],
    });
    assert.equal(recoveredVisualAssets.visual_assets.length, 1);
    assert.equal(recoveredVisualAssets.gaps.length, 0);
    assert.ok(
      recoveredVisualAssets.rejected_material.some((item) =>
        item.reason.includes("recovered from raw image index metadata"),
      ),
    );
    const recoveredAsset = recoveredVisualAssets.visual_assets[0];
    assert.equal(recoveredAsset?.original_raw_path, indexedRawImagePath);
    assert.equal(recoveredAsset?.sha256, indexedRawImageSha256);
    assert.equal(recoveredAsset?.image_url, "https://example.com/indexed.png");
    assert.ok(recoveredAsset?.file_path.startsWith(prepared.evidence_images_dir));
    assert.deepEqual(await readFile(recoveredAsset?.file_path ?? ""), indexedRawImageBytes);

    const hashMismatchRawImagePath = path.join(indexedRawImageDir, "002-hash-mismatch.png");
    await writeFile(hashMismatchRawImagePath, Buffer.from("hash-mismatch-bytes"));
    const hashMismatchRawIndexPath = path.join(indexedRawImageDir, "hash-mismatch-index.json");
    await writeFile(hashMismatchRawIndexPath, JSON.stringify({
      output_dir: indexedRawImageDir,
      index_path: hashMismatchRawIndexPath,
      results: [
        {
          url: "https://example.com/hash-mismatch.png",
          success: true,
          file_path: hashMismatchRawImagePath,
          relative_path: "002-hash-mismatch.png",
          sha256: "wrong-index-sha",
        },
      ],
      count: 1,
    }));
    const hashMismatchVisualAssets = await finalizeAppResearchVisualAssets({
      workspace_dir: workspace.workspace_dir,
      page_id: "page-01",
      raw_image_index_paths: [hashMismatchRawIndexPath],
      visual_assets: [
        {
          id: "image-hash-mismatch",
          file_path: hashMismatchRawImagePath,
          image_url: "https://example.com/hash-mismatch.png",
          reason: "Hash mismatch image",
          visual_summary: "Should be rejected.",
        },
      ],
    });
    assert.equal(hashMismatchVisualAssets.visual_assets.length, 0);
    assert.ok(hashMismatchVisualAssets.gaps.some((gap) => gap.includes("raw image index sha256 did not match")));
    assert.ok(
      hashMismatchVisualAssets.rejected_material.some((item) =>
        item.source === "image-hash-mismatch" &&
        item.reason.includes("raw image index sha256 did not match"),
      ),
    );

    const ambiguousRawImageDir = path.join(prepared.raw_images_dir, "ambiguous-fetch");
    const ambiguousRawImagePathA = path.join(ambiguousRawImageDir, "a", "same-name.png");
    const ambiguousRawImagePathB = path.join(ambiguousRawImageDir, "b", "same-name.png");
    await mkdir(path.dirname(ambiguousRawImagePathA), { recursive: true });
    await mkdir(path.dirname(ambiguousRawImagePathB), { recursive: true });
    await writeFile(ambiguousRawImagePathA, Buffer.from("ambiguous-a"));
    await writeFile(ambiguousRawImagePathB, Buffer.from("ambiguous-b"));
    const ambiguousRawImageIndexPath = path.join(ambiguousRawImageDir, "index.json");
    await writeFile(ambiguousRawImageIndexPath, JSON.stringify({
      output_dir: ambiguousRawImageDir,
      index_path: ambiguousRawImageIndexPath,
      results: [
        {
          url: "https://example.com/a.png",
          success: true,
          file_path: ambiguousRawImagePathA,
          relative_path: "a/same-name.png",
        },
        {
          url: "https://example.com/b.png",
          success: true,
          file_path: ambiguousRawImagePathB,
          relative_path: "b/same-name.png",
        },
      ],
      count: 2,
    }));
    const ambiguousVisualAssets = await finalizeAppResearchVisualAssets({
      workspace_dir: workspace.workspace_dir,
      page_id: "page-01",
      raw_image_index_paths: [ambiguousRawImageIndexPath],
      visual_assets: [
        {
          id: "image-ambiguous",
          file_path: "same-name.png",
          reason: "Ambiguous image",
          visual_summary: "Should be rejected.",
        },
      ],
    });
    assert.equal(ambiguousVisualAssets.visual_assets.length, 0);
    assert.ok(ambiguousVisualAssets.gaps.some((gap) => gap.includes("ambiguous raw image match")));
    assert.ok(
      ambiguousVisualAssets.rejected_material.some((item) =>
        item.source === "image-ambiguous" &&
        item.reason.includes("ambiguous raw image match"),
      ),
    );

    const outsidePath = path.join(homeDir, "outside.png");
    await writeFile(outsidePath, Buffer.from("outside"));
    const rejectedVisualAssets = await finalizeAppResearchVisualAssets({
      workspace_dir: workspace.workspace_dir,
      page_id: "page-01",
      visual_assets: [
        {
          id: "outside-image",
          file_path: outsidePath,
          reason: "Should not be accepted",
          visual_summary: "Outside workspace.",
        },
      ],
    });
    assert.equal(rejectedVisualAssets.visual_assets.length, 0);
    assert.ok(rejectedVisualAssets.gaps.some((gap) => gap.includes("outside research image directories")));
    assert.ok(
      rejectedVisualAssets.rejected_material.some((item) =>
        item.source === "outside-image" &&
        item.reason.includes("outside research image directories"),
      ),
    );

    const statusAfterPageUpserts = await recordAppResearchStatusPage({
      workspace_dir: workspace.workspace_dir,
      page_status: {
        page_id: "page-02",
        status: "curated",
        evidence_path: path.join(prepared.evidence_pages_dir, "page-02.md"),
      },
    });
    assert.equal(statusAfterPageUpserts.status, "gap");
    assert.deepEqual(
      statusAfterPageUpserts.pages.map((page) => page.page_id).sort(),
      ["page-01", "page-02"],
    );

    const readyStatus = await recordAppResearchStatusPage({
      workspace_dir: workspace.workspace_dir,
      page_status: {
        page_id: "page-01",
        status: "curated",
        evidence_path: path.join(prepared.evidence_pages_dir, "page-01.md"),
      },
    });
    assert.equal(readyStatus.status, "ready");
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    await rm(homeDir, { recursive: true, force: true });
  }
});

test("research log channels support sidecar payloads", async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-research-log-home-"));
  process.env.HOME = homeDir;

  const { createAppWorkspace, appendAppWorkspaceLog } = await import("../../src/app-workspace/index.ts");

  try {
    const workspace = await createAppWorkspace({ title: "Research logs" });
    const result = await appendAppWorkspaceLog({
      workspace_dir: workspace.workspace_dir,
      channel: "ai-research-interactions",
      entry: {
        event: "ai.research.interaction.finished",
        response: { text: "x".repeat(2048) },
      },
      payload_keys: ["response"],
      inline_payload_max_bytes: 32,
    });

    assert.equal(path.basename(result.log_file), "ai-research-interactions.jsonl");
    const line = JSON.parse((await readFile(result.log_file, "utf8")).trim()) as Record<string, unknown>;
    const response = line.response as Record<string, unknown>;
    assert.equal(response.__workspace_log_payload, true);
    assert.equal(await pathExists(String(response.path)), true);
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    await rm(homeDir, { recursive: true, force: true });
  }
});

test("export artifact records do not attach research files", async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-research-export-home-"));
  process.env.HOME = homeDir;

  const {
    createAppWorkspace,
    prepareAppResearchWorkspace,
    recordAppPptxExport,
    recordAppPdfExport,
  } = await import("../../src/app-workspace/index.ts");

  try {
    const workspace = await createAppWorkspace({ title: "Research export" });
    const prepared = await prepareAppResearchWorkspace({
      workspace_dir: workspace.workspace_dir,
    });
    await writeFile(path.join(prepared.raw_web_dir, "raw.md"), "raw", "utf8");
    await writeFile(prepared.evidence_index_path, '{"version":1}\n', "utf8");

    const pptxPath = path.join(workspace.workspace_dir, "output", "deck.pptx");
    const pdfPath = path.join(workspace.workspace_dir, "output", "deck.pdf");
    await mkdir(path.dirname(pptxPath), { recursive: true });
    await writeFile(pptxPath, "pptx", "utf8");
    await writeFile(pdfPath, "pdf", "utf8");

    const withPptx = await recordAppPptxExport({
      workspace_dir: workspace.workspace_dir,
      pptx_path: pptxPath,
      generator_result: null,
    });
    const withPdf = await recordAppPdfExport({
      workspace_dir: workspace.workspace_dir,
      pdf_path: pdfPath,
    });

    const pptxArtifacts = (withPptx.task as { artifacts?: Record<string, unknown> }).artifacts ?? {};
    const pdfArtifacts = (withPdf.task as { artifacts?: Record<string, unknown> }).artifacts ?? {};
    assert.equal("research" in pptxArtifacts, false);
    assert.equal("raw_research" in pptxArtifacts, false);
    assert.equal("research_evidence" in pptxArtifacts, false);
    assert.equal("research" in pdfArtifacts, false);
    assert.equal("raw_research" in pdfArtifacts, false);
    assert.equal("research_evidence" in pdfArtifacts, false);
    assert.equal(typeof (pptxArtifacts.pptx as { path?: unknown }).path, "string");
    assert.equal(typeof (pdfArtifacts.pdf as { path?: unknown }).path, "string");
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    await rm(homeDir, { recursive: true, force: true });
  }
});
