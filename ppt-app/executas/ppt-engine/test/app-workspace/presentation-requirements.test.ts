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
    confirmAppWorkspaceOutline,
    getAppWorkspaceRequirements,
    resetAppWorkspaceOutline,
    saveAppWorkspaceOutlineDraft,
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
      saveAppWorkspaceOutlineDraft({
        workspace_dir: created.workspace_dir,
        outline: {
          title: "Blocked",
          items: [{ title: "Page", core_message: "Message", required_content: "- Content" }],
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

    const workspace = await saveAppWorkspaceOutlineDraft({
      workspace_dir: created.workspace_dir,
      outline: {
        title: "Allowed",
        items: [
          {
            title: "Page one",
            core_message: "One clear message",
            required_content: "* First requirement\nSecond requirement\n1. Third requirement",
          },
          {
            title: "Page two",
            core_message: "Another clear message",
            required_content: "Fourth requirement",
          },
        ],
      },
    });
    assert.equal((workspace.outline as { title: string }).title, "Allowed");
    assert.equal((workspace.outline as { status: string }).status, "draft");
    assert.equal(
      (workspace.outline as { items: Array<{ required_content: string }> }).items[0]?.required_content,
      "- First requirement\n- Second requirement\n- Third requirement",
    );
    assert.equal(
      (workspace.outline as { items: Array<{ required_content: string }> }).items[1]?.required_content,
      "- Fourth requirement",
    );
    assert.equal(workspace.requirements.selections.slide_count, 2);
    assert.equal((workspace.task as { title: string }).title, "Allowed");

    const confirmedWorkspace = await confirmAppWorkspaceOutline({
      workspace_dir: created.workspace_dir,
      outline: {
        title: "Allowed",
        items: (workspace.outline as { items: unknown[] }).items,
      },
    });
    assert.equal((confirmedWorkspace.outline as { status: string }).status, "confirmed");
    assert.ok((confirmedWorkspace.outline as { confirmed_at: string | null }).confirmed_at);

    const resetWorkspace = await resetAppWorkspaceOutline({ workspace_dir: created.workspace_dir });
    assert.deepEqual(resetWorkspace.outline, {
      version: 3,
      status: "empty",
      title: "",
      items: [],
      updated_at: null,
      confirmed_at: null,
    });

    await assert.rejects(
      saveAppWorkspaceOutlineDraft({
        workspace_dir: created.workspace_dir,
        outline: {
          title: "Invalid",
          items: [{ title: "Page", core_message: "", required_content: "plain text" }],
        },
      }),
      /core_message must be a non-empty string/,
    );

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
