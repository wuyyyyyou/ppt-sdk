import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { resolveCorepackInvocation } from "./corepack-command.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const engineDir = path.resolve(scriptDir, "..");
const repoDir = path.resolve(engineDir, "../../..");
const vendorDir = path.join(repoDir, "third_party", "dom-to-pptx");
const outputDir = path.join(engineDir, "dist", "vendor", "dom-to-pptx");

const corepackInvocation = resolveCorepackInvocation();
const result = spawnSync(corepackInvocation.command, corepackInvocation.args, {
  cwd: vendorDir,
  stdio: "inherit",
  shell: corepackInvocation.shell,
  env: {
    ...process.env,
    PUPPETEER_SKIP_DOWNLOAD: "true",
    PUPPETEER_SKIP_CHROME_HEADLESS_SHELL_DOWNLOAD: "true",
  },
});

if (result.error?.code === "ENOENT") {
  throw new Error(
    "Corepack was not found. Install Corepack and run `corepack enable`.",
  );
}
if (result.status !== 0) {
  throw new Error(
    "Failed to build third_party/dom-to-pptx. Run `cd third_party/dom-to-pptx && corepack pnpm install --frozen-lockfile` first.",
  );
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const [source, target] of [
  ["dist/dom-to-pptx.bundle.js", "dom-to-pptx.bundle.js"],
  ["dist/animations.css", "animations.css"],
  ["dist/transitions.css", "transitions.css"],
  ["LICENSE", "LICENSE"],
  ["CONTRIBUTORS.md", "CONTRIBUTORS.md"],
  ["UPSTREAM.md", "provenance.md"],
]) {
  await cp(path.join(vendorDir, source), path.join(outputDir, target));
}

console.log(`Built dom-to-pptx browser runtime: ${path.relative(engineDir, outputDir)}`);
