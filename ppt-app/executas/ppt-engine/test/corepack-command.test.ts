import assert from "node:assert/strict";
import test from "node:test";

import { resolveCorepackInvocation } from "../scripts/corepack-command.mjs";

test("resolveCorepackInvocation uses a shell for Windows command wrappers", () => {
  assert.deepEqual(resolveCorepackInvocation("win32"), {
    command: "corepack pnpm build",
    args: [],
    shell: true,
  });
});

test("resolveCorepackInvocation directly spawns Corepack on Unix platforms", () => {
  const expected = {
    command: "corepack",
    args: ["pnpm", "build"],
    shell: false,
  };
  assert.deepEqual(resolveCorepackInvocation("linux"), expected);
  assert.deepEqual(resolveCorepackInvocation("darwin"), expected);
});
