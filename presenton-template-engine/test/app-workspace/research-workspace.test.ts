import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
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
    assert.deepEqual((await getAppResearchEvidence({ workspace_dir: workspace.workspace_dir })).pages, evidence.pages);

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
    assert.equal(evidenceAfterPageUpserts.status, "partial");
    assert.deepEqual(
      evidenceAfterPageUpserts.pages.map((page) => page.page_id).sort(),
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
    assert.equal(replacementEvidence.status, "curated");
    assert.equal(replacementEvidence.pages.length, 2);
    assert.equal(
      replacementEvidence.pages.find((page) => page.page_id === "page-01")?.facts?.[0]?.id,
      "fact-1b",
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
