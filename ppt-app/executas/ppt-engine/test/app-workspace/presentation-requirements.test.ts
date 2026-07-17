import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

function semanticCandidate(label: string) {
  return { label, description: `${label} description` };
}

function draftRequirements() {
  return {
    version: 1,
    status: "draft",
    source: { brief: "Create a five-page Chinese investor presentation." },
    candidates: {
      audience: [semanticCandidate("Investors")],
      purpose: [semanticCandidate("Fundraising pitch")],
      desired_outcome: [semanticCandidate("Continue diligence")],
      slide_count: [5],
      output_language: ["简体中文"],
      visual_tone: [semanticCandidate("Editorial technology")],
    },
    selections: {
      audience: semanticCandidate("Investors"),
      purpose: semanticCandidate("Fundraising pitch"),
      desired_outcome: semanticCandidate("Continue diligence"),
      slide_count: 5,
      output_language: "简体中文",
      visual_tone: semanticCandidate("Editorial technology"),
    },
    updated_at: null,
    confirmed_at: null,
  };
}

test("Presentation Requirements own Workspace recovery and gate Outline Creation", async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "ppt-requirements-home-"));
  process.env.HOME = homeDir;

  const {
    createAppWorkspace,
    getAppWorkspaceRequirements,
    updateAppWorkspaceOutline,
    updateAppWorkspaceRequirements,
  } = await import("../../src/app-workspace/index.ts");

  try {
    const created = await createAppWorkspace({ title: "Requirements" });
    const empty = await getAppWorkspaceRequirements({ workspace_dir: created.workspace_dir });
    assert.equal(empty.status, "empty");
    assert.equal(empty.source, null);
    assert.deepEqual(empty.candidates.slide_count, []);

    const persistedFile = JSON.parse(
      await readFile(path.join(created.workspace_dir, "requirements.json"), "utf8"),
    ) as { status: string };
    assert.equal(persistedFile.status, "empty");

    const draft = draftRequirements();
    await updateAppWorkspaceRequirements({
      workspace_dir: created.workspace_dir,
      requirements: draft,
    });
    const persistedDraft = await getAppWorkspaceRequirements({ workspace_dir: created.workspace_dir });
    assert.equal(persistedDraft.status, "draft");
    assert.ok(persistedDraft.updated_at);
    assert.equal(persistedDraft.confirmed_at, null);

    await assert.rejects(
      updateAppWorkspaceOutline({
        workspace_dir: created.workspace_dir,
        outline: {
          title: "Blocked",
          status: "draft",
          items: [],
          source: { prompt: "", context: [], setting: {} },
        },
      }),
      /Confirmed Presentation Requirements are required/,
    );

    await updateAppWorkspaceRequirements({
      workspace_dir: created.workspace_dir,
      requirements: { ...draft, status: "confirmed" },
    });
    const confirmed = await getAppWorkspaceRequirements({ workspace_dir: created.workspace_dir });
    assert.equal(confirmed.status, "confirmed");
    assert.ok(confirmed.confirmed_at);

    const workspace = await updateAppWorkspaceOutline({
      workspace_dir: created.workspace_dir,
      outline: {
        title: "Allowed",
        status: "draft",
        items: [],
        source: { prompt: confirmed.source?.brief ?? "", context: [], setting: {} },
      },
    });
    assert.equal((workspace.outline as { title: string }).title, "Allowed");

    await assert.rejects(
      updateAppWorkspaceRequirements({
        workspace_dir: created.workspace_dir,
        requirements: {
          ...draft,
          status: "confirmed",
          selections: { ...draft.selections, output_language: null },
        },
      }),
      /missing selections: output_language/,
    );

    await assert.rejects(
      updateAppWorkspaceRequirements({
        workspace_dir: created.workspace_dir,
        requirements: {
          ...draft,
          status: "confirmed",
          selections: { ...draft.selections, output_language: "auto" },
        },
      }),
      /concrete language/,
    );
  } finally {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    await rm(homeDir, { recursive: true, force: true });
  }
});
