import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveLocalTemplateTsconfigPath } from "../local-template/loader.js";

export type LocalRuntimeEntry = {
  layoutId: string;
  absolutePath: string;
};

type LocalRuntimeBundleMode = "deck" | "slide";

const currentModulePath =
  typeof __filename === "string" ? __filename : fileURLToPath(import.meta.url);
const engineRequire = createRequire(currentModulePath);

function normalizePathForImport(value: string): string {
  return value.replace(/\\/g, "/");
}

function getCurrentModuleDir(): string {
  if (typeof __dirname === "string") {
    return __dirname;
  }

  return path.dirname(fileURLToPath(import.meta.url));
}

function resolveBrowserRenderEntry(mode: LocalRuntimeBundleMode): string {
  const moduleDir = getCurrentModuleDir();
  const distEntry =
    mode === "deck"
      ? "browser/local-render-deck.js"
      : "browser/local-render-slide.js";
  const sourceEntry =
    mode === "deck" ? "browser/render-deck.tsx" : "browser/render-slide.tsx";
  const candidates = [
    path.join(moduleDir, "..", distEntry),
    path.join(moduleDir, "..", "dist", distEntry),
    path.join(moduleDir, "..", sourceEntry),
    path.join(moduleDir, "..", "src", sourceEntry),
    path.join(moduleDir, "..", "..", "src", sourceEntry),
  ];
  const entry = candidates.find((candidate) => existsSync(candidate));
  if (!entry) {
    throw new Error(
      `Failed to locate browser render entry for local templates: ${distEntry} or ${sourceEntry}`,
    );
  }

  return entry;
}

function resolveTemplateUtilsEntry(): string {
  const candidates = [
    path.join(getCurrentModuleDir(), "../browser/template-entry.js"),
    path.join(getCurrentModuleDir(), "../dist/browser/template-entry.js"),
    path.join(getCurrentModuleDir(), "../app/presentation-templates/utils.ts"),
    path.join(getCurrentModuleDir(), "../src/app/presentation-templates/utils.ts"),
    path.join(getCurrentModuleDir(), "../../src/app/presentation-templates/utils.ts"),
  ];
  const sourceEntry = candidates.find((candidate) => existsSync(candidate));
  if (!sourceEntry) {
    throw new Error("Failed to locate template utils source entry for local templates");
  }
  return sourceEntry;
}

function buildLocalRuntimeEntrySource(input: {
  mode: LocalRuntimeBundleMode;
  entries: LocalRuntimeEntry[];
}): string {
  const imports: string[] = [];
  const registryItems: string[] = [];

  input.entries.forEach((entry, index) => {
    const moduleName = `SlideModule${index}`;
    const componentName = `SlideComponent${index}`;
    imports.push(
      `import ${componentName}, * as ${moduleName} from ${JSON.stringify(
        normalizePathForImport(entry.absolutePath),
      )};`,
    );
    registryItems.push(
      `${JSON.stringify(entry.layoutId)}: createTemplateEntry(${componentName}, ${moduleName}.Schema, ${moduleName}.layoutId, ${moduleName}.layoutName, ${moduleName}.layoutDescription, ${JSON.stringify(
        entry.layoutId.split(":")[0] ?? "local",
      )}, ${JSON.stringify(path.basename(entry.absolutePath))}, { sampleData: ${moduleName}.sampleData ?? {} }),`,
    );
  });

  const renderEntry = resolveBrowserRenderEntry(input.mode);
  const renderFunction =
    input.mode === "deck"
      ? "renderPresentonDeckWithErrorBoundary"
      : "renderPresentonSlideWithErrorBoundary";

  return [
    `import { ${renderFunction} } from ${JSON.stringify(normalizePathForImport(renderEntry))};`,
    `import { createTemplateEntry } from ${JSON.stringify(
      normalizePathForImport(resolveTemplateUtilsEntry()),
    )};`,
    ...imports,
    "const localLayouts = {",
    ...registryItems,
    "};",
    "window.__PRESENTON_LOCAL_LAYOUTS__ = { ...(window.__PRESENTON_LOCAL_LAYOUTS__ ?? {}), ...localLayouts };",
    "const resolveLocalLayout = (layoutId) => localLayouts[layoutId];",
    `${renderFunction}(resolveLocalLayout);`,
    "",
  ].join("\n");
}

export async function buildLocalBrowserRuntimeBundle(input: {
  mode: LocalRuntimeBundleMode;
  cwd: string;
  entries: LocalRuntimeEntry[];
}): Promise<string> {
  if (input.entries.length === 0) {
    throw new Error("Local browser runtime bundle requires at least one local entry");
  }

  const { build } = await import("esbuild");
  const compileRoot = await mkdtemp(
    path.join(tmpdir(), "presenton-template-engine-local-browser-runtime-"),
  );
  await mkdir(compileRoot, { recursive: true });

  const entryHash = createHash("sha256")
    .update(input.mode)
    .update("\0")
    .update(input.cwd)
    .update("\0")
    .update(input.entries.map((entry) => `${entry.layoutId}:${entry.absolutePath}`).join("\0"))
    .update("\0")
    .update(String(Date.now()))
    .digest("hex")
    .slice(0, 16);
  const entryPath = path.join(compileRoot, `local-runtime-${entryHash}.tsx`);

  await writeFile(
    entryPath,
    buildLocalRuntimeEntrySource({
      mode: input.mode,
      entries: input.entries,
    }),
    "utf8",
  );

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
      zod: engineRequire.resolve("zod"),
      recharts: engineRequire.resolve("recharts"),
      "use-resize-observer": engineRequire.resolve("use-resize-observer"),
    },
  });

  const output = result.outputFiles?.[0]?.text;
  if (!output || output.length === 0) {
    throw new Error("Failed to build local browser runtime bundle");
  }

  return output;
}
