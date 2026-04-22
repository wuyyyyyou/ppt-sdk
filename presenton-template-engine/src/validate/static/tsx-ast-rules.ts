import { readFile } from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

import type { StabilityDiagnostic, StabilityRule } from "../types.js";
import {
  collectLocalManifestSlides,
  createRuleDiagnostic,
  loadManifestState,
  validateLocalSourcePath,
} from "./helpers.js";

interface ParsedSourceFileState {
  filePath: string;
  sourceText: string;
  sourceFile: ts.SourceFile;
}

const parsedSourceFileCache = new Map<string, Promise<ParsedSourceFileState>>();
const ALLOWED_BARE_IMPORTS = new Set(["react", "zod"]);

async function loadParsedSourceFile(filePath: string): Promise<ParsedSourceFileState> {
  const absolutePath = path.resolve(filePath);
  const cached = parsedSourceFileCache.get(absolutePath);
  if (cached) {
    return cached;
  }

  const nextStatePromise = (async () => {
    const sourceText = await readFile(absolutePath, "utf8");
    const scriptKind = absolutePath.endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : absolutePath.endsWith(".jsx")
        ? ts.ScriptKind.JSX
        : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(
      absolutePath,
      sourceText,
      ts.ScriptTarget.ES2022,
      true,
      scriptKind,
    );

    return {
      filePath: absolutePath,
      sourceText,
      sourceFile,
    };
  })();

  parsedSourceFileCache.set(absolutePath, nextStatePromise);
  return nextStatePromise;
}

function collectZodImportNames(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) {
      continue;
    }

    if (statement.moduleSpecifier.getText(sourceFile).slice(1, -1) !== "zod") {
      continue;
    }

    const importClause = statement.importClause;
    if (!importClause) {
      continue;
    }

    if (importClause.name) {
      names.add(importClause.name.text);
    }

    if (!importClause.namedBindings) {
      continue;
    }

    if (ts.isNamespaceImport(importClause.namedBindings)) {
      names.add(importClause.namedBindings.name.text);
      continue;
    }

    for (const element of importClause.namedBindings.elements) {
      names.add((element.propertyName ?? element.name).text);
      names.add(element.name.text);
    }
  }

  return names;
}

function findExportedSchemaInitializer(sourceFile: ts.SourceFile): ts.Expression | null {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    const isExported = statement.modifiers?.some((modifier) =>
      modifier.kind === ts.SyntaxKind.ExportKeyword
    );
    if (!isExported) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === "Schema") {
        return declaration.initializer ?? null;
      }
    }
  }

  return null;
}

function walk(node: ts.Node, visitor: (node: ts.Node) => void) {
  visitor(node);
  node.forEachChild((child) => walk(child, visitor));
}

function schemaUsesZod(initializer: ts.Expression | null, zodImports: Set<string>): boolean {
  if (!initializer || zodImports.size === 0) {
    return false;
  }

  let usesZod = false;
  walk(initializer, (node) => {
    if (usesZod) {
      return;
    }

    if (ts.isPropertyAccessExpression(node)) {
      if (ts.isIdentifier(node.expression) && zodImports.has(node.expression.text)) {
        usesZod = true;
      }
      return;
    }

    if (ts.isIdentifier(node) && zodImports.has(node.text)) {
      usesZod = true;
    }
  });

  return usesZod;
}

function extractTopLevelSchemaKeys(
  initializer: ts.Expression | null,
  zodImports: Set<string>,
): Set<string> | null {
  if (!initializer) {
    return null;
  }

  let schemaObjectLiteral: ts.ObjectLiteralExpression | null = null;
  walk(initializer, (node) => {
    if (schemaObjectLiteral || !ts.isCallExpression(node)) {
      return;
    }

    if (
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      zodImports.has(node.expression.expression.text) &&
      node.expression.name.text === "object" &&
      node.arguments.length > 0 &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      schemaObjectLiteral = node.arguments[0];
    }
  });

  if (!schemaObjectLiteral) {
    return null;
  }

  const objectLiteral = schemaObjectLiteral as ts.ObjectLiteralExpression;
  const keys = new Set<string>();
  for (const property of objectLiteral.properties) {
    if (!("name" in property) || !property.name) {
      continue;
    }

    if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) {
      keys.add(property.name.text);
    }
  }

  return keys;
}

function collectSchemaParseVariableNames(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set<string>();

  walk(sourceFile, (node) => {
    if (!ts.isVariableDeclaration(node) || !node.initializer || !ts.isIdentifier(node.name)) {
      return;
    }

    if (
      ts.isCallExpression(node.initializer) &&
      ts.isPropertyAccessExpression(node.initializer.expression) &&
      ts.isIdentifier(node.initializer.expression.expression) &&
      node.initializer.expression.expression.text === "Schema" &&
      node.initializer.expression.name.text === "parse"
    ) {
      names.add(node.name.text);
    }
  });

  return names;
}

function collectUsedFieldNames(sourceFile: ts.SourceFile): Set<string> {
  const parsedAliases = collectSchemaParseVariableNames(sourceFile);
  const fields = new Set<string>();

  walk(sourceFile, (node) => {
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === "data" || parsedAliases.has(node.expression.text)) {
        fields.add(node.name.text);
      }
      return;
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer &&
      ts.isIdentifier(node.initializer) &&
      (node.initializer.text === "data" || parsedAliases.has(node.initializer.text))
    ) {
      for (const element of node.name.elements) {
        if (ts.isIdentifier(element.name)) {
          fields.add((element.propertyName ?? element.name).getText(sourceFile));
        }
      }
    }
  });

  return fields;
}

function hasSchemaParseOnData(sourceFile: ts.SourceFile): boolean {
  let found = false;

  walk(sourceFile, (node) => {
    if (found || !ts.isCallExpression(node) || node.arguments.length === 0) {
      return;
    }

    if (
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "Schema" &&
      node.expression.name.text === "parse"
    ) {
      const argumentText = node.arguments[0].getText(sourceFile);
      if (argumentText.includes("data")) {
        found = true;
      }
    }
  });

  return found;
}

function hasFixedCanvasHints(sourceText: string): boolean {
  const widthPattern = /w-\[1280px\]|width\s*:\s*["'`]?(?:1280px|1280)["'`]?/;
  const heightPattern = /h-\[720px\]|height\s*:\s*["'`]?(?:720px|720)["'`]?/;
  return widthPattern.test(sourceText) && heightPattern.test(sourceText);
}

function collectDisallowedBareImports(sourceFile: ts.SourceFile): string[] {
  const specifiers = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }

    const specifier = statement.moduleSpecifier.text;
    if (
      specifier.startsWith(".") ||
      specifier.startsWith("/") ||
      ALLOWED_BARE_IMPORTS.has(specifier)
    ) {
      continue;
    }

    specifiers.add(specifier);
  }

  return Array.from(specifiers).sort((left, right) => left.localeCompare(right));
}

function collectRuntimeNetworkSymbols(sourceFile: ts.SourceFile): string[] {
  const symbols = new Set<string>();

  walk(sourceFile, (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === "fetch") {
        symbols.add("fetch");
      }
      return;
    }

    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
      if (
        node.expression.text === "XMLHttpRequest" ||
        node.expression.text === "WebSocket" ||
        node.expression.text === "EventSource"
      ) {
        symbols.add(node.expression.text);
      }
    }
  });

  return Array.from(symbols).sort((left, right) => left.localeCompare(right));
}

export const ZOD_SCHEMA_RULE: StabilityRule = {
  id: "STATIC-005",
  title: "Local slide Schema must be defined with zod",
  phase: "static",
  severity: "error",
  docs: [
    ".docs/manifest-tsx-guide/tsx-authoring.md",
  ],
  appliesTo: ["tsx"],
  async run(context) {
    const state = await loadManifestState(context);
    if (!state.manifest) {
      return [];
    }

    const diagnostics: StabilityDiagnostic[] = [];
    for (const slideRef of collectLocalManifestSlides(state.manifest)) {
      const resolution = await validateLocalSourcePath(slideRef, state.manifestDir);
      if ("error" in resolution || slideRef.sourcePath.includes("/shared/")) {
        continue;
      }

      const parsedSource = await loadParsedSourceFile(resolution.absolutePath);
      const zodImports = collectZodImportNames(parsedSource.sourceFile);
      const schemaInitializer = findExportedSchemaInitializer(parsedSource.sourceFile);

      if (!schemaUsesZod(schemaInitializer, zodImports)) {
        diagnostics.push(createRuleDiagnostic(this, {
          message: `Local slide "${slideRef.slideId}" must export Schema using zod in ${resolution.absolutePath}`,
          suggestion: 'Import zod and define `export const Schema = z.object({...})` in the local slide module.',
          locations: [{
            filePath: resolution.absolutePath,
            slideId: slideRef.slideId,
            jsonPath: slideRef.jsonPath,
          }],
        }));
      }
    }

    return diagnostics;
  },
};

export const SCHEMA_PARSE_RULE: StabilityRule = {
  id: "STATIC-006",
  title: "Local slide components must call Schema.parse(data ?? {})",
  phase: "static",
  severity: "error",
  docs: [
    ".docs/manifest-tsx-guide/tsx-authoring.md",
  ],
  appliesTo: ["tsx"],
  async run(context) {
    const state = await loadManifestState(context);
    if (!state.manifest) {
      return [];
    }

    const diagnostics: StabilityDiagnostic[] = [];
    for (const slideRef of collectLocalManifestSlides(state.manifest)) {
      const resolution = await validateLocalSourcePath(slideRef, state.manifestDir);
      if ("error" in resolution) {
        continue;
      }

      const parsedSource = await loadParsedSourceFile(resolution.absolutePath);
      if (!hasSchemaParseOnData(parsedSource.sourceFile)) {
        diagnostics.push(createRuleDiagnostic(this, {
          message: `Local slide "${slideRef.slideId}" does not call Schema.parse on data input`,
          suggestion: "Parse incoming data with Schema.parse(data ?? {}) before reading slide fields.",
          locations: [{
            filePath: resolution.absolutePath,
            slideId: slideRef.slideId,
            jsonPath: slideRef.jsonPath,
          }],
        }));
      }
    }

    return diagnostics;
  },
};

export const SCHEMA_FIELD_COVERAGE_RULE: StabilityRule = {
  id: "STATIC-007",
  title: "Schema must cover fields that the slide reads from data",
  phase: "static",
  severity: "error",
  docs: [
    ".docs/manifest-tsx-guide/tsx-authoring.md",
  ],
  appliesTo: ["tsx"],
  async run(context) {
    const state = await loadManifestState(context);
    if (!state.manifest) {
      return [];
    }

    const diagnostics: StabilityDiagnostic[] = [];
    for (const slideRef of collectLocalManifestSlides(state.manifest)) {
      const resolution = await validateLocalSourcePath(slideRef, state.manifestDir);
      if ("error" in resolution) {
        continue;
      }

      const parsedSource = await loadParsedSourceFile(resolution.absolutePath);
      const zodImports = collectZodImportNames(parsedSource.sourceFile);
      const schemaInitializer = findExportedSchemaInitializer(parsedSource.sourceFile);
      const schemaKeys = extractTopLevelSchemaKeys(schemaInitializer, zodImports);
      if (!schemaKeys) {
        continue;
      }

      const usedFields = collectUsedFieldNames(parsedSource.sourceFile);
      for (const fieldName of usedFields) {
        if (schemaKeys.has(fieldName)) {
          continue;
        }

        diagnostics.push(createRuleDiagnostic(this, {
          message: `Local slide "${slideRef.slideId}" reads "${fieldName}" but Schema does not define it`,
          suggestion: `Add "${fieldName}" to Schema or stop reading it from parsed/data values in the slide component.`,
          locations: [{
            filePath: resolution.absolutePath,
            slideId: slideRef.slideId,
            jsonPath: slideRef.jsonPath,
          }],
          evidence: {
            missingField: fieldName,
          },
        }));
      }
    }

    return diagnostics;
  },
};

export const FIXED_CANVAS_HINT_RULE: StabilityRule = {
  id: "STATIC-008",
  title: "Local slide should declare a fixed 1280x720 canvas",
  phase: "static",
  severity: "warning",
  docs: [
    ".docs/manifest-tsx-guide/tsx-authoring.md",
  ],
  appliesTo: ["tsx"],
  async run(context) {
    const state = await loadManifestState(context);
    if (!state.manifest) {
      return [];
    }

    const diagnostics: StabilityDiagnostic[] = [];
    for (const slideRef of collectLocalManifestSlides(state.manifest)) {
      const resolution = await validateLocalSourcePath(slideRef, state.manifestDir);
      if ("error" in resolution) {
        continue;
      }

      const parsedSource = await loadParsedSourceFile(resolution.absolutePath);
      if (hasFixedCanvasHints(parsedSource.sourceText)) {
        continue;
      }

      diagnostics.push(createRuleDiagnostic(this, {
        message: `Local slide "${slideRef.slideId}" does not show a clear static 1280x720 canvas hint`,
        suggestion: "Wrap the slide in a fixed single-page canvas, typically with width 1280 and height 720.",
        locations: [{
          filePath: resolution.absolutePath,
          slideId: slideRef.slideId,
          jsonPath: slideRef.jsonPath,
        }],
      }));
    }

    return diagnostics;
  },
};

export const RUNTIME_DEPENDENCY_RULE: StabilityRule = {
  id: "STATIC-009",
  title: "Local slides should avoid extra runtime dependencies and network requests",
  phase: "static",
  severity: "error",
  docs: [
    ".docs/manifest-tsx-guide/tsx-authoring.md",
    ".docs/manifest-tsx-guide/tsx-export-rules.md",
  ],
  appliesTo: ["tsx"],
  async run(context) {
    const state = await loadManifestState(context);
    if (!state.manifest) {
      return [];
    }

    const diagnostics: StabilityDiagnostic[] = [];
    for (const slideRef of collectLocalManifestSlides(state.manifest)) {
      const resolution = await validateLocalSourcePath(slideRef, state.manifestDir);
      if ("error" in resolution) {
        continue;
      }

      const parsedSource = await loadParsedSourceFile(resolution.absolutePath);
      const disallowedImports = collectDisallowedBareImports(parsedSource.sourceFile);
      if (disallowedImports.length > 0) {
        diagnostics.push(createRuleDiagnostic(this, {
          message: `Local slide "${slideRef.slideId}" imports unsupported third-party modules: ${disallowedImports.join(", ")}`,
          suggestion: "Keep local slides lightweight; prefer react, zod, and local relative imports only.",
          locations: [{
            filePath: resolution.absolutePath,
            slideId: slideRef.slideId,
            jsonPath: slideRef.jsonPath,
          }],
          evidence: {
            imports: disallowedImports,
          },
        }));
      }

      const runtimeNetworkSymbols = collectRuntimeNetworkSymbols(parsedSource.sourceFile);
      if (runtimeNetworkSymbols.length > 0) {
        diagnostics.push(createRuleDiagnostic(this, {
          message: `Local slide "${slideRef.slideId}" uses runtime network APIs: ${runtimeNetworkSymbols.join(", ")}`,
          suggestion: "Do not rely on runtime network requests inside local slides; pass required content through manifest data instead.",
          locations: [{
            filePath: resolution.absolutePath,
            slideId: slideRef.slideId,
            jsonPath: slideRef.jsonPath,
          }],
          evidence: {
            apis: runtimeNetworkSymbols,
          },
        }));
      }
    }

    return diagnostics;
  },
};
