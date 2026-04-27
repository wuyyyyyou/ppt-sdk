import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { constants as fsConstants, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { Plugin } from "esbuild";
import type React from "react";
import type { ZodTypeAny } from "zod";

export type LocalSlideComponent = React.ComponentType<{ data: Record<string, unknown> }>;
type ReactModule = typeof React;
type RenderToStaticMarkup = (element: React.ReactElement) => string;

export type LocalTemplateModule = {
  default: LocalSlideComponent;
  Schema: ZodTypeAny;
  layoutId: string;
  layoutName: string;
  layoutDescription: string;
  sampleData?: Record<string, unknown>;
  layoutTags?: string[];
  layoutRole?: string;
  contentElements?: string[];
  useCases?: string[];
  suitableFor?: string;
  avoidFor?: string;
  density?: "low" | "medium" | "high";
  visualWeight?: "text-heavy" | "balanced" | "visual-heavy";
  editableTextPriority?: "high" | "medium" | "low";
};

export type LocalTemplateRenderRuntime = {
  react: ReactModule;
  renderToStaticMarkup: RenderToStaticMarkup;
};

export const ALLOWED_LOCAL_EXTENSIONS = new Set([
  ".tsx",
  ".ts",
  ".jsx",
  ".js",
  ".mts",
  ".cts",
]);

const currentModulePath =
  typeof __filename === "string" ? __filename : import.meta.url;
const engineRequire = createRequire(currentModulePath);
const LOCAL_TEMPLATE_RUNTIME_ALLOWED_PACKAGES = new Set([
  "react",
  "react-dom",
  "zod",
  "recharts",
]);
const LOCAL_TEMPLATE_RUNTIME_EXTERNAL_PACKAGES = new Set([
  "react",
  "react-dom",
]);

function assertWithinCwd(candidatePath: string, cwd: string, ownerLabel: string): void {
  const relativePath = path.relative(cwd, candidatePath);
  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`${ownerLabel} local source path must stay within cwd: ${candidatePath}`);
  }
}

export async function resolveLocalModulePath(
  sourcePath: string,
  cwd: string,
  ownerLabel: string,
): Promise<string> {
  if (!sourcePath || typeof sourcePath !== "string") {
    throw new Error(`${ownerLabel} is missing required local source path`);
  }

  const absolutePath = path.resolve(cwd, sourcePath);
  assertWithinCwd(absolutePath, cwd, ownerLabel);

  const extension = path.extname(absolutePath).toLowerCase();
  if (!ALLOWED_LOCAL_EXTENSIONS.has(extension)) {
    throw new Error(
      `${ownerLabel} local source must use one of: ${Array.from(ALLOWED_LOCAL_EXTENSIONS).join(", ")}`,
    );
  }

  await access(absolutePath, fsConstants.R_OK);
  return absolutePath;
}

async function findNearestTsconfig(startDir: string): Promise<string | null> {
  let currentDir = path.resolve(startDir);

  while (true) {
    const candidate = path.join(currentDir, "tsconfig.json");
    try {
      await access(candidate, fsConstants.R_OK);
      return candidate;
    } catch {
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        return null;
      }
      currentDir = parentDir;
    }
  }
}

let fallbackLocalTemplateTsconfigPathPromise: Promise<string> | null = null;

async function getFallbackLocalTemplateTsconfigPath(): Promise<string> {
  if (!fallbackLocalTemplateTsconfigPathPromise) {
    fallbackLocalTemplateTsconfigPathPromise = (async () => {
      const directory = path.join(tmpdir(), "presenton-template-engine");
      const filePath = path.join(directory, "manifest-tsconfig.json");

      await mkdir(directory, { recursive: true });
      await writeFile(
        filePath,
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2022",
              module: "NodeNext",
              moduleResolution: "NodeNext",
              jsx: "react-jsx",
              esModuleInterop: true,
              allowSyntheticDefaultImports: true,
            },
          },
          null,
          2,
        ),
        "utf8",
      );

      return filePath;
    })();
  }

  return fallbackLocalTemplateTsconfigPathPromise;
}

export async function resolveLocalTemplateTsconfigPath(cwd: string): Promise<string> {
  return (await findNearestTsconfig(cwd)) ?? getFallbackLocalTemplateTsconfigPath();
}

function isRelativeOrAbsoluteSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    /^[a-zA-Z]:[\\/]/.test(specifier)
  );
}

function getBarePackageName(specifier: string): string {
  if (specifier.startsWith("@")) {
    const [scope, name] = specifier.split("/");
    return scope && name ? `${scope}/${name}` : specifier;
  }

  return specifier.split("/")[0] ?? specifier;
}

function isPathWithinDirectory(candidatePath: string, directoryPath: string): boolean {
  const relativePath = path.relative(
    resolveExistingPath(directoryPath),
    resolveExistingPath(candidatePath),
  );
  return (
    relativePath.length === 0 ||
    (!relativePath.startsWith(`..${path.sep}`) &&
      relativePath !== ".." &&
      !path.isAbsolute(relativePath))
  );
}

function resolveExistingPath(candidatePath: string): string {
  try {
    return realpathSync.native(candidatePath);
  } catch {
    return path.resolve(candidatePath);
  }
}

function resolveAllowedRuntimeModule(specifier: string): string {
  try {
    return engineRequire.resolve(specifier);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Presenton template runtime includes "${specifier}", but it could not be resolved from the bundled runtime: ${message}`,
    );
  }
}

function createLocalTemplateRuntimeResolver(cwd: string): Plugin {
  const templateRoot = resolveExistingPath(cwd);

  return {
    name: "presenton-local-template-runtime",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        const specifier = args.path;

        if (isRelativeOrAbsoluteSpecifier(specifier)) {
          return;
        }

        if (specifier.startsWith("node:")) {
          if (!args.importer || !isPathWithinDirectory(args.importer, templateRoot)) {
            return;
          }

          throw new Error(
            `This template imports "${specifier}", but Node built-in modules are not supported in Presenton local templates.`,
          );
        }

        const packageName = getBarePackageName(specifier);
        if (LOCAL_TEMPLATE_RUNTIME_EXTERNAL_PACKAGES.has(packageName)) {
          return {
            path: resolveAllowedRuntimeModule(specifier),
            external: true,
          };
        }

        if (!args.importer || !isPathWithinDirectory(args.importer, templateRoot)) {
          return;
        }

        if (!LOCAL_TEMPLATE_RUNTIME_ALLOWED_PACKAGES.has(packageName)) {
          throw new Error(
            `This template imports "${specifier}", but it is not included in the Presenton template runtime.`,
          );
        }

        const resolvedPath = resolveAllowedRuntimeModule(specifier);
        return {
          path: resolvedPath,
        };
      });
    },
  };
}

function formatLocalTemplateBuildError(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "errors" in error &&
    Array.isArray((error as { errors?: unknown[] }).errors)
  ) {
    const messages = (error as { errors: Array<{ text?: unknown }> }).errors
      .map((item) => (typeof item.text === "string" ? item.text : null))
      .filter((item): item is string => Boolean(item));

    if (messages.length > 0) {
      return messages.join("; ");
    }
  }

  return error instanceof Error ? error.message : String(error);
}

async function compileLocalTemplateModule(
  absolutePath: string,
  cwd: string,
): Promise<string> {
  const { build } = await import("esbuild");
  const compileRoot = await mkdtemp(
    path.join(tmpdir(), "presenton-template-engine-local-template-"),
  );
  const sourceHash = createHash("sha256")
    .update(path.resolve(absolutePath))
    .update("\0")
    .update(String(Date.now()))
    .digest("hex")
    .slice(0, 16);
  const outputPath = path.join(compileRoot, `${sourceHash}.mjs`);

  try {
    await build({
      entryPoints: [absolutePath],
      outfile: outputPath,
      absWorkingDir: cwd,
      bundle: true,
      platform: "node",
      format: "esm",
      target: "node20",
      jsx: "automatic",
      tsconfig: await resolveLocalTemplateTsconfigPath(cwd),
      logLevel: "silent",
      plugins: [createLocalTemplateRuntimeResolver(cwd)],
    });
  } catch (error) {
    throw new Error(
      `Failed to compile local template "${absolutePath}": ${formatLocalTemplateBuildError(error)}`,
    );
  }

  return outputPath;
}

export async function importLocalTemplateModule(
  absolutePath: string,
  cwd: string,
): Promise<LocalTemplateModule> {
  const compiledPath = await compileLocalTemplateModule(absolutePath, cwd);
  const loaded = await import(pathToFileURL(compiledPath).href);
  return loaded as LocalTemplateModule;
}

function loadTemplateRenderRuntime(
  requireFromRuntime: (id: string) => unknown,
): LocalTemplateRenderRuntime | null {
  const react = requireFromRuntime("react") as ReactModule;
  const reactDomServer = requireFromRuntime("react-dom/server") as {
    renderToStaticMarkup?: RenderToStaticMarkup;
  };

  if (
    !react ||
    typeof react.createElement !== "function" ||
    !reactDomServer ||
    typeof reactDomServer.renderToStaticMarkup !== "function"
  ) {
    return null;
  }

  return {
    react,
    renderToStaticMarkup: reactDomServer.renderToStaticMarkup,
  };
}

export function loadLocalTemplateRenderRuntime(cwd: string): LocalTemplateRenderRuntime | null {
  const localRequire = createRequire(path.join(cwd, "__presenton_manifest_loader__.cjs"));

  try {
    return loadTemplateRenderRuntime(engineRequire) ?? loadTemplateRenderRuntime(localRequire);
  } catch {
    try {
      return loadTemplateRenderRuntime(localRequire);
    } catch {
      return null;
    }
  }
}

export function assertLocalTemplateModule(
  moduleValue: LocalTemplateModule,
  absolutePath: string,
): asserts moduleValue is LocalTemplateModule {
  if (!moduleValue || typeof moduleValue !== "object") {
    throw new Error(`Local template did not export a module object: ${absolutePath}`);
  }

  if (typeof moduleValue.default !== "function") {
    throw new Error(`Local template must default export a React component: ${absolutePath}`);
  }

  if (!moduleValue.layoutId || typeof moduleValue.layoutId !== "string") {
    throw new Error(`Local template must export "layoutId": ${absolutePath}`);
  }

  if (!moduleValue.layoutName || typeof moduleValue.layoutName !== "string") {
    throw new Error(`Local template must export "layoutName": ${absolutePath}`);
  }

  if (
    !moduleValue.layoutDescription ||
    typeof moduleValue.layoutDescription !== "string"
  ) {
    throw new Error(`Local template must export "layoutDescription": ${absolutePath}`);
  }

  if (
    !moduleValue.Schema ||
    typeof moduleValue.Schema !== "object" ||
    typeof moduleValue.Schema.parse !== "function"
  ) {
    throw new Error(`Local template must export "Schema": ${absolutePath}`);
  }

  if (
    moduleValue.sampleData !== undefined &&
    (typeof moduleValue.sampleData !== "object" ||
      moduleValue.sampleData === null ||
      Array.isArray(moduleValue.sampleData))
  ) {
    throw new Error(`Local template "sampleData" must be an object: ${absolutePath}`);
  }

  if (
    moduleValue.layoutTags !== undefined &&
    (!Array.isArray(moduleValue.layoutTags) ||
      moduleValue.layoutTags.some((tag) => typeof tag !== "string"))
  ) {
    throw new Error(`Local template "layoutTags" must be a string array: ${absolutePath}`);
  }

  if (
    moduleValue.contentElements !== undefined &&
    (!Array.isArray(moduleValue.contentElements) ||
      moduleValue.contentElements.some((item) => typeof item !== "string"))
  ) {
    throw new Error(`Local template "contentElements" must be a string array: ${absolutePath}`);
  }

  if (
    moduleValue.useCases !== undefined &&
    (!Array.isArray(moduleValue.useCases) ||
      moduleValue.useCases.some((item) => typeof item !== "string"))
  ) {
    throw new Error(`Local template "useCases" must be a string array: ${absolutePath}`);
  }

  if (
    moduleValue.layoutRole !== undefined &&
    typeof moduleValue.layoutRole !== "string"
  ) {
    throw new Error(`Local template "layoutRole" must be a string: ${absolutePath}`);
  }

  if (
    moduleValue.suitableFor !== undefined &&
    typeof moduleValue.suitableFor !== "string"
  ) {
    throw new Error(`Local template "suitableFor" must be a string: ${absolutePath}`);
  }

  if (
    moduleValue.avoidFor !== undefined &&
    typeof moduleValue.avoidFor !== "string"
  ) {
    throw new Error(`Local template "avoidFor" must be a string: ${absolutePath}`);
  }

  if (
    moduleValue.density !== undefined &&
    !["low", "medium", "high"].includes(moduleValue.density)
  ) {
    throw new Error(
      `Local template "density" must be one of "low", "medium", "high": ${absolutePath}`,
    );
  }

  if (
    moduleValue.visualWeight !== undefined &&
    !["text-heavy", "balanced", "visual-heavy"].includes(moduleValue.visualWeight)
  ) {
    throw new Error(
      `Local template "visualWeight" must be one of "text-heavy", "balanced", "visual-heavy": ${absolutePath}`,
    );
  }

  if (
    moduleValue.editableTextPriority !== undefined &&
    !["high", "medium", "low"].includes(moduleValue.editableTextPriority)
  ) {
    throw new Error(
      `Local template "editableTextPriority" must be one of "high", "medium", "low": ${absolutePath}`,
    );
  }
}
