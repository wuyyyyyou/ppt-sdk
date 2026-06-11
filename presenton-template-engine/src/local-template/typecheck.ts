import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { resolveLocalTemplateTsconfigPath } from "./loader.js";

const CURRENT_MODULE_PATH = fileURLToPath(import.meta.url);
const CURRENT_MODULE_DIR = path.dirname(CURRENT_MODULE_PATH);
const engineRequire = createRequire(CURRENT_MODULE_PATH);

const MAX_REPORTED_DIAGNOSTICS = 8;
const MAX_FORMATTED_MESSAGE_LENGTH = 6_000;
const ENGINE_RESOLVER_FILE = path.join(CURRENT_MODULE_DIR, "__presenton_typecheck__.ts");

export interface LocalTemplateTypecheckDiagnostic {
  code: number;
  category: string;
  message: string;
  file_path?: string;
  line?: number;
  column?: number;
}

export class LocalTemplateTypecheckError extends Error {
  constructor(
    message: string,
    public readonly diagnostics: LocalTemplateTypecheckDiagnostic[],
  ) {
    super(message);
    this.name = "LocalTemplateTypecheckError";
  }
}

function getDiagnosticLocation(diagnostic: ts.Diagnostic): {
  file_path?: string;
  line?: number;
  column?: number;
} {
  if (!diagnostic.file || diagnostic.start === undefined) {
    return {};
  }

  const location = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return {
    file_path: diagnostic.file.fileName,
    line: location.line + 1,
    column: location.character + 1,
  };
}

function normalizeDiagnostic(diagnostic: ts.Diagnostic): LocalTemplateTypecheckDiagnostic {
  return {
    code: diagnostic.code,
    category: ts.DiagnosticCategory[diagnostic.category] ?? String(diagnostic.category),
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    ...getDiagnosticLocation(diagnostic),
  };
}

function formatDiagnostic(diagnostic: LocalTemplateTypecheckDiagnostic, cwd: string): string {
  const relativePath = diagnostic.file_path
    ? path.relative(cwd, diagnostic.file_path) || path.basename(diagnostic.file_path)
    : "unknown";
  const location = diagnostic.line && diagnostic.column
    ? `${relativePath}:${diagnostic.line}:${diagnostic.column}`
    : relativePath;

  return `${location} TS${diagnostic.code}: ${diagnostic.message}`;
}

function truncateMessage(value: string): string {
  if (value.length <= MAX_FORMATTED_MESSAGE_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_FORMATTED_MESSAGE_LENGTH - 40)}\n... truncated typecheck diagnostics ...`;
}

function getAllowedRuntimePackageName(specifier: string): string {
  if (specifier.startsWith("@")) {
    const [scope, name] = specifier.split("/");
    return scope && name ? `${scope}/${name}` : specifier;
  }

  return specifier.split("/")[0] ?? specifier;
}

function isRelativeOrAbsoluteSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    /^[a-zA-Z]:[\\/]/.test(specifier)
  );
}

function createTypecheckCompilerHost(
  options: ts.CompilerOptions,
  cwd: string,
): ts.CompilerHost {
  const host = ts.createCompilerHost(options, true);
  const defaultResolveModuleNames = host.resolveModuleNames?.bind(host);

  host.resolveModuleNames = (moduleNames, containingFile, reusedNames, redirectedReference, compilerOptions) => {
    return moduleNames.map((moduleName, index) => {
      const defaultResolved = defaultResolveModuleNames?.(
        [moduleName],
        containingFile,
        reusedNames?.slice(index, index + 1),
        redirectedReference,
        compilerOptions,
      )[0] ?? ts.resolveModuleName(moduleName, containingFile, compilerOptions, host).resolvedModule;

      if (defaultResolved) {
        return defaultResolved;
      }

      if (isRelativeOrAbsoluteSpecifier(moduleName)) {
        return undefined;
      }

      try {
        const packageName = getAllowedRuntimePackageName(moduleName);
        engineRequire.resolve(`${packageName}/package.json`);
      } catch {
        return undefined;
      }

      return ts.resolveModuleName(
        moduleName,
        ENGINE_RESOLVER_FILE,
        compilerOptions,
        ts.sys,
      ).resolvedModule;
    });
  };

  const defaultGetCurrentDirectory = host.getCurrentDirectory.bind(host);
  host.getCurrentDirectory = () => cwd || defaultGetCurrentDirectory();

  return host;
}

async function loadCompilerOptions(cwd: string): Promise<ts.CompilerOptions> {
  const tsconfigPath = await resolveLocalTemplateTsconfigPath(cwd);
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);

  if (configFile.error) {
    throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(tsconfigPath),
    {
      allowImportingTsExtensions: true,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      noEmit: true,
      skipLibCheck: true,
      strict: false,
      target: ts.ScriptTarget.ES2022,
    },
    tsconfigPath,
  );

  return {
    ...parsed.options,
    allowImportingTsExtensions: true,
    noEmit: true,
    skipLibCheck: true,
  };
}

export async function assertLocalTemplateTypecheck(input: {
  entryPath: string;
  cwd: string;
  label?: string;
}): Promise<void> {
  const entryPath = path.resolve(input.entryPath);
  const cwd = path.resolve(input.cwd);
  const options = await loadCompilerOptions(cwd);
  const host = createTypecheckCompilerHost(options, cwd);
  const program = ts.createProgram({
    rootNames: [entryPath],
    options,
    host,
  });
  const diagnostics = [
    ...program.getOptionsDiagnostics(),
    ...program.getSyntacticDiagnostics(),
    ...program.getSemanticDiagnostics(),
  ]
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    .map(normalizeDiagnostic);

  if (diagnostics.length === 0) {
    return;
  }

  const reported = diagnostics.slice(0, MAX_REPORTED_DIAGNOSTICS);
  const formattedDiagnostics = reported.map((diagnostic) => formatDiagnostic(diagnostic, cwd));
  const omittedCount = diagnostics.length - reported.length;
  const relativeEntryPath = path.relative(cwd, entryPath);
  const label = input.label ?? (relativeEntryPath || entryPath);
  const suffix = omittedCount > 0
    ? `\n... ${omittedCount} more TypeScript diagnostic(s) omitted ...`
    : "";
  const message = truncateMessage([
    `Pre-render TypeScript check failed for ${label}.`,
    "Fix these diagnostics before rendering:",
    ...formattedDiagnostics,
  ].join("\n") + suffix);

  throw new LocalTemplateTypecheckError(message, diagnostics);
}
