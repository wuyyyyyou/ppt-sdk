import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveLocalTemplateTsconfigPath } from "../local-template/loader.js";

const CURRENT_MODULE_PATH = fileURLToPath(import.meta.url);
const CURRENT_MODULE_DIR = path.dirname(CURRENT_MODULE_PATH);
const engineRequire = createRequire(CURRENT_MODULE_PATH);

export interface PageSourceRuntimeEntry {
  pageId: string;
  absolutePath: string;
}

type RuntimeMode = "deck" | "slide";

function normalizeImportPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function resolveBrowserEntry(): string {
  const candidates = [
    path.join(CURRENT_MODULE_DIR, "../browser/page-source-render.js"),
    path.join(CURRENT_MODULE_DIR, "../dist/browser/page-source-render.js"),
    path.join(CURRENT_MODULE_DIR, "../browser/page-source-render.tsx"),
    path.join(CURRENT_MODULE_DIR, "../src/browser/page-source-render.tsx"),
    path.join(CURRENT_MODULE_DIR, "../../src/browser/page-source-render.tsx"),
  ];
  const entry = candidates.find((candidate) => existsSync(candidate));
  if (!entry) {
    throw new Error("Failed to locate Page Source browser runtime entry");
  }
  return entry;
}

function buildEntrySource(mode: RuntimeMode, entries: PageSourceRuntimeEntry[]): string {
  const imports = entries.map((entry, index) =>
    `import PageSource${index} from ${JSON.stringify(normalizeImportPath(entry.absolutePath))};`,
  );
  const registry = entries.map((entry, index) =>
    `${JSON.stringify(entry.pageId)}: PageSource${index},`,
  );
  const renderFunction = mode === "deck"
    ? "renderPageSourceDeckWithErrorBoundary"
    : "renderPageSourceSlideWithErrorBoundary";
  return [
    `import { ${renderFunction} } from ${JSON.stringify(normalizeImportPath(resolveBrowserEntry()))};`,
    ...imports,
    "const pageSources = {",
    ...registry,
    "};",
    "const resolvePageSource = (pageId) => pageSources[pageId];",
    `${renderFunction}(resolvePageSource);`,
    "",
  ].join("\n");
}

export async function buildPageSourceRuntimeBundle(input: {
  mode: RuntimeMode;
  cwd: string;
  entries: PageSourceRuntimeEntry[];
}): Promise<string> {
  if (input.entries.length === 0) {
    throw new Error("Page Source runtime bundle requires at least one entry");
  }
  const { build } = await import("esbuild");
  const compileRoot = await mkdtemp(path.join(tmpdir(), "ppt-page-source-runtime-"));
  await mkdir(compileRoot, { recursive: true });
  const hash = createHash("sha256")
    .update(input.mode)
    .update("\0")
    .update(input.cwd)
    .update("\0")
    .update(input.entries.map((entry) => `${entry.pageId}:${entry.absolutePath}`).join("\0"))
    .digest("hex")
    .slice(0, 16);
  const entryPath = path.join(compileRoot, `page-source-${hash}.tsx`);
  await writeFile(entryPath, buildEntrySource(input.mode, input.entries), "utf8");
  const result = await build({
    entryPoints: [entryPath],
    absWorkingDir: input.cwd,
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2020",
    jsx: "automatic",
    minify: false,
    tsconfig: await resolveLocalTemplateTsconfigPath(input.cwd),
    logLevel: "silent",
    alias: {
      react: engineRequire.resolve("react"),
      "react/jsx-runtime": engineRequire.resolve("react/jsx-runtime"),
      "react/jsx-dev-runtime": engineRequire.resolve("react/jsx-dev-runtime"),
      "react-dom": engineRequire.resolve("react-dom"),
      "react-dom/client": engineRequire.resolve("react-dom/client"),
      "react-dom/server": engineRequire.resolve("react-dom/server"),
      recharts: engineRequire.resolve("recharts"),
      "use-resize-observer": engineRequire.resolve("use-resize-observer"),
    },
  });
  const output = result.outputFiles?.[0]?.text;
  if (!output) {
    throw new Error("Failed to build Page Source browser runtime bundle");
  }
  return output;
}
