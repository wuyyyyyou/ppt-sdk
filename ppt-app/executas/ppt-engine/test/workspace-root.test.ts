import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";

import { getPptWorkspaceRoot } from "../src/workspace-root.ts";

test("uses ANNA_WORKSPACE_DIR as the Cloud Agent workspace base", () => {
  const previous = process.env.ANNA_WORKSPACE_DIR;
  try {
    process.env.ANNA_WORKSPACE_DIR = "/mnt/anna-persistent";
    assert.equal(getPptWorkspaceRoot(), "/mnt/anna-persistent/ppt");
  } finally {
    if (previous === undefined) delete process.env.ANNA_WORKSPACE_DIR;
    else process.env.ANNA_WORKSPACE_DIR = previous;
  }
});

test("keeps the historical local fallback when ANNA_WORKSPACE_DIR is unset", () => {
  const previous = process.env.ANNA_WORKSPACE_DIR;
  try {
    delete process.env.ANNA_WORKSPACE_DIR;
    assert.equal(getPptWorkspaceRoot(), path.join(os.homedir(), "anna-workspace", "ppt"));
  } finally {
    if (previous === undefined) delete process.env.ANNA_WORKSPACE_DIR;
    else process.env.ANNA_WORKSPACE_DIR = previous;
  }
});

test("rejects a configured relative workspace directory", () => {
  const previous = process.env.ANNA_WORKSPACE_DIR;
  try {
    process.env.ANNA_WORKSPACE_DIR = "relative/workspace";
    assert.throws(() => getPptWorkspaceRoot(), /ANNA_WORKSPACE_DIR must be an absolute path/);
  } finally {
    if (previous === undefined) delete process.env.ANNA_WORKSPACE_DIR;
    else process.env.ANNA_WORKSPACE_DIR = previous;
  }
});
