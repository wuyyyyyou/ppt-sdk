import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createAgentFileToolPathContext,
  describeAgentFileToolPathContext,
  formatAgentFileToolPathBlock,
  toAgentFileToolPath,
} from "../../src/features/deck-generation/agentFileToolPaths.ts";

describe("Agent file-tool paths", () => {
  it("preserves the canonical absolute path for Agent file tools", () => {
    const context = createAgentFileToolPathContext({
      workspaceRoot: "/tmp/anna-workspace/ppt",
      workspaceDir: "/tmp/anna-workspace/ppt/ppt-20260630-152620",
    });
    const path = toAgentFileToolPath(
      context,
      "/tmp/anna-workspace/ppt/ppt-20260630-152620/research/evidence/drafts/page-02-visual.json",
    );

    assert.equal(context.pptTaskDir, "/tmp/anna-workspace/ppt/ppt-20260630-152620");
    assert.equal(
      path.agentFileToolPath,
      "/tmp/anna-workspace/ppt/ppt-20260630-152620/research/evidence/drafts/page-02-visual.json",
    );
  });

  it("does not derive or substitute an Agent workspace root", () => {
    const context = createAgentFileToolPathContext({
      workspaceRoot: "/tmp/anna-workspace/ppt",
      workspaceDir: "/home/agent/anna-workspace/ppt/ppt-20260630-152620",
    });
    const description = describeAgentFileToolPathContext(context);

    assert.match(description, /PPT task directory \(absolute\): \/home\/agent\/anna-workspace/);
    assert.match(description, /Use every Agent file-tool absolute path exactly as provided/);
    assert.doesNotMatch(description, /Agent file-tool root:/);
    assert.doesNotMatch(description, /\/data\/workspace/);
  });

  it("formats one absolute path instead of a canonical and relative path pair", () => {
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

    assert.equal(
      block,
      [
        "Visual draft JSON path to write:",
        "- Agent file-tool absolute path: /tmp/anna-workspace/ppt/ppt-20260630-152620/research/evidence/drafts/page-02-visual.json",
      ].join("\n"),
    );
    assert.doesNotMatch(block, /Canonical absolute path/);
    assert.doesNotMatch(block, /Agent file-tool path: ppt\//);
  });
});
