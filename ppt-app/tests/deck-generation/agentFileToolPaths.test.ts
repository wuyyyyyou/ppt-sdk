import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createAgentFileToolPathContext,
  describeAgentFileToolPathContext,
  formatAgentFileToolPathBlock,
  toAgentFileToolPath,
} from "../../src/features/deck-generation/agentFileToolPaths.ts";

describe("Agent file-tool paths", () => {
  it("derives Agent file-tool paths from workspace root and task directory", () => {
    const context = createAgentFileToolPathContext({
      workspaceRoot: "/tmp/anna-workspace/ppt",
      workspaceDir: "/tmp/anna-workspace/ppt/ppt-20260630-152620",
    });
    const path = toAgentFileToolPath(
      context,
      "/tmp/anna-workspace/ppt/ppt-20260630-152620/research/evidence/drafts/page-02-visual.json",
    );

    assert.equal(context.agentFileToolRoot, "/tmp/anna-workspace");
    assert.equal(
      path.agentFileToolPath,
      "ppt/ppt-20260630-152620/research/evidence/drafts/page-02-visual.json",
    );
  });

  it("fails inference when workspaceDir is outside workspaceRoot", () => {
    const context = createAgentFileToolPathContext({
      workspaceRoot: "/tmp/anna-workspace/ppt",
      workspaceDir: "/tmp/other/ppt-20260630-152620",
    });

    assert.equal(context.agentFileToolRoot, null);
    assert.match(context.inferenceFailedReason ?? "", /outside/);
  });

  it("does not generate Agent file-tool paths outside inferred root", () => {
    const context = createAgentFileToolPathContext({
      workspaceRoot: "/tmp/anna-workspace/ppt",
      workspaceDir: "/tmp/anna-workspace/ppt/ppt-20260630-152620",
    });
    const path = toAgentFileToolPath(context, "/private/tmp/outside.json");

    assert.equal(path.agentFileToolPath, null);
  });

  it("formats dual-path blocks for usable tool paths", () => {
    const context = createAgentFileToolPathContext({
      workspaceRoot: "/tmp/anna-workspace/ppt",
      workspaceDir: "/tmp/anna-workspace/ppt/ppt-20260630-152620",
    });
    const block = formatAgentFileToolPathBlock({
      label: "Visual draft JSON path to write",
      path: toAgentFileToolPath(
        context,
        "/tmp/anna-workspace/ppt/ppt-20260630-152620/research/evidence/drafts/page-02-visual.json",
      ),
    });

    assert.match(block, /Canonical absolute path: \/tmp\/anna-workspace\/ppt\/ppt-20260630-152620/);
    assert.match(block, /Agent file-tool path: ppt\/ppt-20260630-152620\/research\/evidence\/drafts\/page-02-visual\.json/);
  });

  it("describes fallback behavior without guessing paths", () => {
    const context = createAgentFileToolPathContext({
      workspaceRoot: "",
      workspaceDir: "/tmp/anna-workspace/ppt/ppt-20260630-152620",
    });
    const description = describeAgentFileToolPathContext(context);
    const block = formatAgentFileToolPathBlock({
      label: "Current slide TSX",
      path: toAgentFileToolPath(
        context,
        "/tmp/anna-workspace/ppt/ppt-20260630-152620/template/slides/page-02.tsx",
      ),
    });

    assert.match(description, /could not be inferred/);
    assert.match(description, /list "\."/);
    assert.match(block, /Agent file-tool path: unavailable/);
    assert.doesNotMatch(block, /Agent file-tool path: ppt\/ppt-20260630-152620/);
  });
});
