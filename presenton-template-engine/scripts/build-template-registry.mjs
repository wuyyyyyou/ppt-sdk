import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import * as z from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, "..");
const templateSourceRoot = path.join(projectDir, "src", "app", "presentation-templates");
const generatedRegistryPath = path.join(templateSourceRoot, "generated-registry.ts");
const generatedRegistryManifestPath = path.join(
  templateSourceRoot,
  "generated-registry-manifest.json",
);
const knownTemplateExtensions = new Set([".tsx", ".ts", ".jsx", ".js", ".mts", ".cts"]);

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function stripKnownExtension(value) {
  const extension = path.extname(value);
  if (!knownTemplateExtensions.has(extension)) {
    return value;
  }
  return value.slice(0, -extension.length);
}

function toImportSpecifier(absolutePath) {
  const relativePath = normalizePath(path.relative(templateSourceRoot, absolutePath));
  const noExtensionPath = stripKnownExtension(relativePath);
  return `./${noExtensionPath}`;
}

function sanitizeIdentifier(value) {
  const normalized = value.replace(/[^a-zA-Z0-9_$]+/g, "_");
  const prefixed = /^[0-9]/.test(normalized) ? `_${normalized}` : normalized;
  return prefixed.replace(/_+/g, "_");
}

function toTitleCaseFromSlug(value) {
  return value
    .split("-")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function normalizeStringArray(value) {
  return isStringArray(value) && value.length > 0 ? value : undefined;
}

async function importTypeScriptModule(absolutePath) {
  const { tsImport } = await import("tsx/esm/api");
  return tsImport(pathToFileURL(absolutePath).href, {
    parentURL: pathToFileURL(path.join(projectDir, "scripts", "__registry_loader__.ts")).href,
    tsconfig: path.join(projectDir, "tsconfig.json"),
  });
}

function assertTemplateModule(moduleValue, absolutePath) {
  if (!moduleValue || typeof moduleValue !== "object") {
    throw new Error(`Template module did not export an object: ${absolutePath}`);
  }

  if (typeof moduleValue.default !== "function") {
    throw new Error(`Template module must default export a React component: ${absolutePath}`);
  }

  if (!moduleValue.layoutId || typeof moduleValue.layoutId !== "string") {
    throw new Error(`Template module must export "layoutId": ${absolutePath}`);
  }

  if (!moduleValue.layoutName || typeof moduleValue.layoutName !== "string") {
    throw new Error(`Template module must export "layoutName": ${absolutePath}`);
  }

  if (
    !moduleValue.layoutDescription ||
    typeof moduleValue.layoutDescription !== "string"
  ) {
    throw new Error(`Template module must export "layoutDescription": ${absolutePath}`);
  }

  if (
    !moduleValue.Schema ||
    typeof moduleValue.Schema !== "object" ||
    typeof moduleValue.Schema.parse !== "function"
  ) {
    throw new Error(`Template module must export "Schema": ${absolutePath}`);
  }

  if (
    moduleValue.sampleData !== undefined &&
    (!isPlainRecord(moduleValue.sampleData))
  ) {
    throw new Error(`Template module "sampleData" must be an object: ${absolutePath}`);
  }

  for (const [fieldName, fieldValue] of [
    ["layoutTags", moduleValue.layoutTags],
    ["contentElements", moduleValue.contentElements],
    ["useCases", moduleValue.useCases],
  ]) {
    if (fieldValue !== undefined && !isStringArray(fieldValue)) {
      throw new Error(`Template module "${fieldName}" must be a string array: ${absolutePath}`);
    }
  }

  for (const [fieldName, fieldValue] of [
    ["layoutRole", moduleValue.layoutRole],
    ["suitableFor", moduleValue.suitableFor],
    ["avoidFor", moduleValue.avoidFor],
  ]) {
    if (fieldValue !== undefined && typeof fieldValue !== "string") {
      throw new Error(`Template module "${fieldName}" must be a string: ${absolutePath}`);
    }
  }

  if (
    moduleValue.density !== undefined &&
    !["low", "medium", "high"].includes(moduleValue.density)
  ) {
    throw new Error(
      `Template module "density" must be one of "low", "medium", "high": ${absolutePath}`,
    );
  }

  if (
    moduleValue.visualWeight !== undefined &&
    !["text-heavy", "balanced", "visual-heavy"].includes(moduleValue.visualWeight)
  ) {
    throw new Error(
      `Template module "visualWeight" must be one of "text-heavy", "balanced", "visual-heavy": ${absolutePath}`,
    );
  }

  if (
    moduleValue.editableTextPriority !== undefined &&
    !["high", "medium", "low"].includes(moduleValue.editableTextPriority)
  ) {
    throw new Error(
      `Template module "editableTextPriority" must be one of "high", "medium", "low": ${absolutePath}`,
    );
  }
}

function getSchemaDefaults(schema) {
  try {
    return schema.parse({});
  } catch {
    try {
      return schema.parse(undefined);
    } catch {
      return {};
    }
  }
}

async function readBuiltinGroupJson(groupDirPath) {
  const groupJsonPath = path.join(groupDirPath, "group.json");
  const rawValue = JSON.parse(await readFile(groupJsonPath, "utf8"));

  if (!isPlainRecord(rawValue)) {
    throw new Error(`group.json must contain an object: ${groupJsonPath}`);
  }

  if (!rawValue.group_id || typeof rawValue.group_id !== "string") {
    throw new Error(`group.json must contain string field "group_id": ${groupJsonPath}`);
  }

  if (!rawValue.group_name || typeof rawValue.group_name !== "string") {
    throw new Error(`group.json must contain string field "group_name": ${groupJsonPath}`);
  }

  if (
    !rawValue.group_description ||
    typeof rawValue.group_description !== "string"
  ) {
    throw new Error(
      `group.json must contain string field "group_description": ${groupJsonPath}`,
    );
  }

  if (typeof rawValue.ordered !== "boolean") {
    throw new Error(`group.json must contain boolean field "ordered": ${groupJsonPath}`);
  }

  if (typeof rawValue.default !== "boolean") {
    throw new Error(`group.json must contain boolean field "default": ${groupJsonPath}`);
  }

  if (
    rawValue.registry_order !== undefined &&
    typeof rawValue.registry_order !== "number"
  ) {
    throw new Error(`group.json field "registry_order" must be a number: ${groupJsonPath}`);
  }

  if (
    rawValue.layouts !== undefined &&
    (!Array.isArray(rawValue.layouts) ||
      rawValue.layouts.some((layout) => typeof layout !== "string" || layout.length === 0))
  ) {
    throw new Error(`group.json field "layouts" must be a string array: ${groupJsonPath}`);
  }
  for (const [fieldName, fieldValue] of [
    ["style_tags", rawValue.style_tags],
    ["industry_tags", rawValue.industry_tags],
    ["use_cases", rawValue.use_cases],
    ["audience_tags", rawValue.audience_tags],
    ["tone_tags", rawValue.tone_tags],
  ]) {
    if (fieldValue !== undefined && !isStringArray(fieldValue)) {
      throw new Error(`group.json field "${fieldName}" must be a string array: ${groupJsonPath}`);
    }
  }
  for (const [fieldName, fieldValue] of [
    ["group_brief", rawValue.group_brief],
    ["cover_layout_id", rawValue.cover_layout_id],
    ["agenda_layout_id", rawValue.agenda_layout_id],
    ["closing_layout_id", rawValue.closing_layout_id],
  ]) {
    if (fieldValue !== undefined && typeof fieldValue !== "string") {
      throw new Error(`group.json field "${fieldName}" must be a string: ${groupJsonPath}`);
    }
  }

  return {
    group_id: rawValue.group_id,
    group_name: rawValue.group_name,
    group_description: rawValue.group_description,
    ordered: rawValue.ordered,
    default: rawValue.default,
    registry_order: rawValue.registry_order,
    layouts: rawValue.layouts,
    group_brief: rawValue.group_brief,
    style_tags: rawValue.style_tags,
    industry_tags: rawValue.industry_tags,
    use_cases: rawValue.use_cases,
    audience_tags: rawValue.audience_tags,
    tone_tags: rawValue.tone_tags,
    cover_layout_id: rawValue.cover_layout_id,
    agenda_layout_id: rawValue.agenda_layout_id,
    closing_layout_id: rawValue.closing_layout_id,
  };
}

function normalizeLayoutOrderEntry(value) {
  return stripKnownExtension(normalizePath(value).replace(/^\.\//, ""));
}

function createLayoutOrderMap(layouts) {
  const orderMap = new Map();
  if (!Array.isArray(layouts)) {
    return orderMap;
  }

  layouts.forEach((layoutValue, index) => {
    const normalizedValue = normalizeLayoutOrderEntry(layoutValue);
    if (!orderMap.has(normalizedValue)) {
      orderMap.set(normalizedValue, index);
    }
  });

  return orderMap;
}

function sortTemplateFilesByGroupOrder(groupDirPath, templateFiles, groupLayouts) {
  const layoutOrder = createLayoutOrderMap(groupLayouts);
  if (layoutOrder.size === 0) {
    return [...templateFiles];
  }

  const availableLayouts = new Set(
    templateFiles.map((absoluteTemplatePath) =>
      normalizeLayoutOrderEntry(path.relative(groupDirPath, absoluteTemplatePath)),
    ),
  );

  for (const layoutValue of groupLayouts) {
    const normalizedLayout = normalizeLayoutOrderEntry(layoutValue);
    if (!availableLayouts.has(normalizedLayout)) {
      throw new Error(
        `group.json layout "${layoutValue}" does not match any template source in ${groupDirPath}`,
      );
    }
  }

  return [...templateFiles].sort((left, right) => {
    const leftRelativePath = normalizeLayoutOrderEntry(path.relative(groupDirPath, left));
    const rightRelativePath = normalizeLayoutOrderEntry(path.relative(groupDirPath, right));
    const leftOrder = layoutOrder.get(leftRelativePath) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = layoutOrder.get(rightRelativePath) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return leftRelativePath.localeCompare(rightRelativePath);
  });
}

async function collectTemplateFiles(groupDirPath) {
  const collected = [];
  const slidesDirPath = path.join(groupDirPath, "slides");
  let searchRoot = groupDirPath;

  try {
    const slidesDirEntries = await readdir(slidesDirPath, { withFileTypes: true });
    if (Array.isArray(slidesDirEntries)) {
      searchRoot = slidesDirPath;
    }
  } catch {
    searchRoot = groupDirPath;
  }

  const walk = async (currentDir) => {
    const entries = await readdir(currentDir, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const absoluteEntryPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === "shared") {
          continue;
        }
        await walk(absoluteEntryPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!knownTemplateExtensions.has(path.extname(entry.name))) {
        continue;
      }

      if (/^index\./i.test(entry.name)) {
        continue;
      }

      collected.push(absoluteEntryPath);
    }
  };

  await walk(searchRoot);
  return collected;
}

async function collectBuiltinGroups() {
  const entries = await readdir(templateSourceRoot, { withFileTypes: true });
  const groupDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(templateSourceRoot, entry.name))
    .sort((left, right) => left.localeCompare(right));

  const groups = [];
  const seenGroupIds = new Set();
  const seenLayoutIds = new Set();

  for (const groupDirPath of groupDirs) {
    const groupJsonPath = path.join(groupDirPath, "group.json");
    try {
      await readFile(groupJsonPath, "utf8");
    } catch {
      continue;
    }

    const groupMeta = await readBuiltinGroupJson(groupDirPath);
    if (seenGroupIds.has(groupMeta.group_id)) {
      throw new Error(`Duplicate builtin group_id "${groupMeta.group_id}"`);
    }
    seenGroupIds.add(groupMeta.group_id);

    const templateFiles = sortTemplateFilesByGroupOrder(
      groupDirPath,
      await collectTemplateFiles(groupDirPath),
      groupMeta.layouts,
    );
    const layouts = [];

    for (const absoluteTemplatePath of templateFiles) {
      const moduleValue = await importTypeScriptModule(absoluteTemplatePath);
      assertTemplateModule(moduleValue, absoluteTemplatePath);

      const finalLayoutId = `${groupMeta.group_id}:${moduleValue.layoutId}`;
      if (seenLayoutIds.has(finalLayoutId)) {
        throw new Error(`Duplicate builtin layout id "${finalLayoutId}"`);
      }
      seenLayoutIds.add(finalLayoutId);

      const sourceRelativePath = normalizePath(
        path.relative(templateSourceRoot, absoluteTemplatePath),
      );
      layouts.push({
        layoutId: finalLayoutId,
        localLayoutId: moduleValue.layoutId,
        layoutName: moduleValue.layoutName,
        layoutDescription: moduleValue.layoutDescription,
        sampleData:
          isPlainRecord(moduleValue.sampleData)
            ? moduleValue.sampleData
            : getSchemaDefaults(moduleValue.Schema),
        schemaJson: z.toJSONSchema(moduleValue.Schema),
        sourcePath: sourceRelativePath,
        groupRelativePath: normalizePath(path.relative(groupDirPath, absoluteTemplatePath)),
        importSpecifier: toImportSpecifier(absoluteTemplatePath),
        fileName: path.basename(absoluteTemplatePath, path.extname(absoluteTemplatePath)),
        layoutTags: normalizeStringArray(moduleValue.layoutTags),
        layoutRole: moduleValue.layoutRole,
        contentElements: normalizeStringArray(moduleValue.contentElements),
        useCases: normalizeStringArray(moduleValue.useCases),
        suitableFor: moduleValue.suitableFor,
        avoidFor: moduleValue.avoidFor,
        density: moduleValue.density,
        visualWeight: moduleValue.visualWeight,
        editableTextPriority: moduleValue.editableTextPriority,
      });
    }

    groups.push({
      ...groupMeta,
      groupDirName: path.basename(groupDirPath),
      layouts,
    });
  }

  groups.sort((left, right) => {
    const leftOrder = left.registry_order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.registry_order ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.group_id.localeCompare(right.group_id);
  });

  return groups;
}

function buildGeneratedRegistrySource(groups) {
  const lines = [
    "/* eslint-disable */",
    "// This file is auto-generated by scripts/build-template-registry.mjs.",
    "// Do not edit manually.",
    "",
    'import { createTemplateEntry, type TemplateGroupSettings, type TemplateLayoutsWithSettings, type TemplateWithData } from "./utils.js";',
    "",
  ];

  const groupVariableNames = new Map();

  for (const group of groups) {
    for (const layout of group.layouts) {
      const identifierBase = sanitizeIdentifier(`${group.group_id}_${layout.fileName}`);
      lines.push(
        `import ${identifierBase}Component, * as ${identifierBase}Module from ${JSON.stringify(layout.importSpecifier)};`,
      );
    }
  }

  if (groups.length > 0) {
    lines.push("");
  }

  for (const group of groups) {
    const groupMetaVariable = `${sanitizeIdentifier(group.group_id)}GroupMeta`;
    const groupSettingsVariable = `${sanitizeIdentifier(group.group_id)}Settings`;
    const groupLayoutsVariable = `${sanitizeIdentifier(group.group_id)}Layouts`;
    groupVariableNames.set(group.group_id, {
      groupMetaVariable,
      groupSettingsVariable,
      groupLayoutsVariable,
    });

    lines.push(
      `const ${groupMetaVariable} = ${JSON.stringify(
        {
          group_id: group.group_id,
          group_name: group.group_name,
          group_description: group.group_description,
          ordered: group.ordered,
          default: group.default,
          group_brief: group.group_brief ?? null,
          style_tags: group.style_tags ?? null,
          industry_tags: group.industry_tags ?? null,
          use_cases: group.use_cases ?? null,
          audience_tags: group.audience_tags ?? null,
          tone_tags: group.tone_tags ?? null,
          cover_layout_id: group.cover_layout_id ?? null,
          agenda_layout_id: group.agenda_layout_id ?? null,
          closing_layout_id: group.closing_layout_id ?? null,
        },
        null,
        2,
      )} as const;`,
    );
    lines.push(
      `const ${groupSettingsVariable}: TemplateGroupSettings = {`,
      `  description: ${groupMetaVariable}.group_description,`,
      `  ordered: ${groupMetaVariable}.ordered,`,
      `  default: ${groupMetaVariable}.default,`,
      `  groupBrief: ${groupMetaVariable}.group_brief ?? undefined,`,
      `  styleTags: ${groupMetaVariable}.style_tags ?? undefined,`,
      `  industryTags: ${groupMetaVariable}.industry_tags ?? undefined,`,
      `  useCases: ${groupMetaVariable}.use_cases ?? undefined,`,
      `  audienceTags: ${groupMetaVariable}.audience_tags ?? undefined,`,
      `  toneTags: ${groupMetaVariable}.tone_tags ?? undefined,`,
      `  coverLayoutId: ${groupMetaVariable}.cover_layout_id ?? undefined,`,
      `  agendaLayoutId: ${groupMetaVariable}.agenda_layout_id ?? undefined,`,
      `  closingLayoutId: ${groupMetaVariable}.closing_layout_id ?? undefined,`,
      "};",
    );
    lines.push(
      `const ${groupLayoutsVariable}: TemplateWithData[] = [`,
      ...group.layouts.map((layout) => {
        const identifierBase = sanitizeIdentifier(`${group.group_id}_${layout.fileName}`);
        return `  createTemplateEntry(${identifierBase}Component, ${identifierBase}Module.Schema, ${identifierBase}Module.layoutId, ${identifierBase}Module.layoutName, ${identifierBase}Module.layoutDescription, ${JSON.stringify(group.group_id)}, ${JSON.stringify(layout.fileName)}, ${JSON.stringify(
          {
            sampleData: layout.sampleData,
            layoutTags: layout.layoutTags,
            layoutRole: layout.layoutRole,
            contentElements: layout.contentElements,
            useCases: layout.useCases,
            suitableFor: layout.suitableFor,
            avoidFor: layout.avoidFor,
            density: layout.density,
            visualWeight: layout.visualWeight,
            editableTextPriority: layout.editableTextPriority,
          },
        )}),`;
      }),
      "];",
      "",
    );
  }

  lines.push(
    "export const templates: TemplateLayoutsWithSettings[] = [",
    ...groups.map((group) => {
      const variables = groupVariableNames.get(group.group_id);
      return [
        "  {",
        `    id: ${variables.groupMetaVariable}.group_id,`,
        `    name: ${variables.groupMetaVariable}.group_name,`,
        `    description: ${variables.groupMetaVariable}.group_description,`,
        `    settings: ${variables.groupSettingsVariable},`,
        `    layouts: ${variables.groupLayoutsVariable},`,
        "  },",
      ].join("\n");
    }),
    "];",
    "",
    "export const allLayouts: TemplateWithData[] = templates.flatMap((group) => group.layouts);",
    "",
    "export function getTemplatesByTemplateName(templateId: string): TemplateWithData[] {",
    "  const template = templates.find((item) => item.id === templateId);",
    "  return template?.layouts ?? [];",
    "}",
    "",
    "export function getSchemaByTemplateId(templateId: string): Array<{ id: string; name: string; description: string; json_schema: unknown }> {",
    "  const template = templates.find((item) => item.id === templateId);",
    "  return (template?.layouts ?? []).map((layout) => ({",
    "    id: layout.layoutId,",
    "    name: layout.layoutName,",
    "    description: layout.layoutDescription,",
    "    json_schema: layout.schemaJSON,",
    "  }));",
    "}",
    "",
    "export function getSettingsByTemplateId(templateId: string): TemplateGroupSettings | undefined {",
    "  const template = templates.find((item) => item.id === templateId);",
    "  return template?.settings;",
    "}",
    "",
    "export function getTemplateByLayoutId(layoutId: string): TemplateWithData | undefined {",
    "  return allLayouts.find((layout) => layout.layoutId === layoutId);",
    "}",
    "",
    "export function getLayoutByLayoutId(layoutId: string): TemplateWithData | undefined {",
    "  const templateName = layoutId.split(\":\")[0];",
    "  const template = templates.find((item) => item.id === templateName);",
    "  return template?.layouts.find((layout) => layout.layoutId === layoutId);",
    "}",
    "",
  );

  return `${lines.join("\n")}\n`;
}

async function main() {
  const groups = await collectBuiltinGroups();
  const registrySource = buildGeneratedRegistrySource(groups);
  const registryManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    groups: groups.map((group) => ({
      groupId: group.group_id,
      groupName: group.group_name,
      groupDescription: group.group_description,
      groupBrief: group.group_brief ?? null,
      styleTags: group.style_tags ?? null,
      industryTags: group.industry_tags ?? null,
      useCases: group.use_cases ?? null,
      audienceTags: group.audience_tags ?? null,
      toneTags: group.tone_tags ?? null,
      ordered: group.ordered,
      default: group.default,
      coverLayoutId: group.cover_layout_id ?? null,
      agendaLayoutId: group.agenda_layout_id ?? null,
      closingLayoutId: group.closing_layout_id ?? null,
      registryOrder: group.registry_order ?? null,
      groupDirName: group.groupDirName,
      layouts: group.layouts.map((layout) => ({
        layoutId: layout.layoutId,
        localLayoutId: layout.localLayoutId,
        layoutName: layout.layoutName,
        layoutDescription: layout.layoutDescription,
        sourcePath: layout.sourcePath,
        groupRelativePath: layout.groupRelativePath,
        fileName: layout.fileName,
        sampleData: layout.sampleData,
        schemaJson: layout.schemaJson,
        layoutTags: layout.layoutTags ?? null,
        layoutRole: layout.layoutRole ?? null,
        contentElements: layout.contentElements ?? null,
        useCases: layout.useCases ?? null,
        suitableFor: layout.suitableFor ?? null,
        avoidFor: layout.avoidFor ?? null,
        density: layout.density ?? null,
        visualWeight: layout.visualWeight ?? null,
        editableTextPriority: layout.editableTextPriority ?? null,
      })),
    })),
  };

  await writeFile(generatedRegistryPath, registrySource, "utf8");
  await writeFile(
    generatedRegistryManifestPath,
    `${JSON.stringify(registryManifest, null, 2)}\n`,
    "utf8",
  );
}

main()
  .then(() => {
    // `tsx/esm/api` may keep the process alive after the registry files are written.
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
