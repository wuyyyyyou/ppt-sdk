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
const MAX_SOURCE_LINE_LENGTH = 240;
const MAX_CARET_WIDTH = 80;
const ENGINE_RESOLVER_FILE = path.join(CURRENT_MODULE_DIR, "__presenton_typecheck__.ts");

export interface LocalTemplateTypecheckDiagnostic {
  code: number;
  category: string;
  message: string;
  file_path?: string;
  line?: number;
  column?: number;
  source_line?: string;
  source_caret?: string;
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

function buildCaretLine(input: {
  lineText: string;
  columnIndex: number;
  length: number | undefined;
}): string {
  const columnIndex = Math.max(0, Math.min(input.columnIndex, input.lineText.length));
  const rawLength = typeof input.length === "number" && input.length > 0
    ? input.length
    : 1;
  const boundedLineLength = Math.max(1, input.lineText.length - columnIndex);
  const caretWidth = Math.max(1, Math.min(rawLength, boundedLineLength, MAX_CARET_WIDTH));
  const prefix = input.lineText.slice(0, columnIndex).replace(/[^\t]/g, " ");
  return `${prefix}${"^".repeat(caretWidth)}`;
}

function truncateSourceContext(input: {
  lineText: string;
  caretLine: string;
  columnIndex: number;
}): {
  source_line: string;
  source_caret: string;
} {
  if (input.lineText.length <= MAX_SOURCE_LINE_LENGTH) {
    return {
      source_line: input.lineText,
      source_caret: input.caretLine,
    };
  }

  const halfWindow = Math.floor((MAX_SOURCE_LINE_LENGTH - 5) / 2);
  const start = Math.max(0, input.columnIndex - halfWindow);
  const end = Math.min(input.lineText.length, start + MAX_SOURCE_LINE_LENGTH - 3);
  const adjustedStart = Math.max(0, end - (MAX_SOURCE_LINE_LENGTH - 3));
  const prefix = adjustedStart > 0 ? "..." : "";
  const suffix = end < input.lineText.length ? "..." : "";
  const sourceSlice = input.lineText.slice(adjustedStart, end);
  const caretSlice = input.caretLine.slice(adjustedStart, end);

  return {
    source_line: `${prefix}${sourceSlice}${suffix}`,
    source_caret: `${" ".repeat(prefix.length)}${caretSlice}`,
  };
}

function getDiagnosticSourceContext(diagnostic: ts.Diagnostic): {
  source_line?: string;
  source_caret?: string;
} {
  if (!diagnostic.file || diagnostic.start === undefined) {
    return {};
  }

  const location = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  const lineStarts = diagnostic.file.getLineStarts();
  const lineStart = lineStarts[location.line];
  if (lineStart === undefined) {
    return {};
  }

  const nextLineStart = lineStarts[location.line + 1] ?? diagnostic.file.text.length;
  const lineText = diagnostic.file.text.slice(lineStart, nextLineStart).replace(/\r?\n$/, "");
  const caretLine = buildCaretLine({
    lineText,
    columnIndex: location.character,
    length: diagnostic.length,
  });

  return truncateSourceContext({
    lineText,
    caretLine,
    columnIndex: location.character,
  });
}

function normalizeDiagnostic(diagnostic: ts.Diagnostic): LocalTemplateTypecheckDiagnostic {
  return {
    code: diagnostic.code,
    category: ts.DiagnosticCategory[diagnostic.category] ?? String(diagnostic.category),
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    ...getDiagnosticLocation(diagnostic),
    ...getDiagnosticSourceContext(diagnostic),
  };
}

function formatDiagnostic(diagnostic: LocalTemplateTypecheckDiagnostic, cwd: string): string {
  const relativePath = diagnostic.file_path
    ? path.relative(cwd, diagnostic.file_path) || path.basename(diagnostic.file_path)
    : "unknown";
  const location = diagnostic.line && diagnostic.column
    ? `${relativePath}:${diagnostic.line}:${diagnostic.column}`
    : relativePath;

  const header = `${location} TS${diagnostic.code}: ${diagnostic.message}`;
  if (!diagnostic.source_line || !diagnostic.source_caret || !diagnostic.line) {
    return header;
  }

  const lineLabel = String(diagnostic.line);
  const gutter = " ".repeat(lineLabel.length);
  return [
    header,
    `${lineLabel} | ${diagnostic.source_line}`,
    `${gutter} | ${diagnostic.source_caret}`,
  ].join("\n");
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
