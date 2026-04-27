import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { templates } from "../app/presentation-templates/index.js";
import {
  getSchemaDefaults,
  getSchemaJSON,
  type TemplateLayoutsWithSettings,
  type TemplateWithData,
} from "../app/presentation-templates/utils.js";
import {
  ALLOWED_LOCAL_EXTENSIONS,
  assertLocalTemplateModule,
  importLocalTemplateModule,
  resolveLocalModulePath,
} from "../local-template/loader.js";

export type TemplateDiscoverySourceType = "builtin" | "local";

export interface LocalTemplateGroupMetadata {
  group_id: string;
  group_name: string;
  group_description: string;
  ordered: boolean;
  default: boolean;
  layouts?: string[];
  group_brief?: string;
  style_tags?: string[];
  industry_tags?: string[];
  use_cases?: string[];
  audience_tags?: string[];
  tone_tags?: string[];
  cover_layout_id?: string;
  agenda_layout_id?: string;
  closing_layout_id?: string;
}

export interface DiscoveredTemplateLayoutInfo {
  layout_id: string;
  layout_name: string;
  layout_description: string;
  json_schema: Record<string, unknown>;
  sample_data?: Record<string, unknown>;
  tags?: string[];
  layout_role?: string;
  content_elements?: string[];
  use_cases?: string[];
  suitable_for?: string;
  avoid_for?: string;
  density?: "low" | "medium" | "high";
  visual_weight?: "text-heavy" | "balanced" | "visual-heavy";
  editable_text_priority?: "high" | "medium" | "low";
  source: {
    type: TemplateDiscoverySourceType;
    path?: string;
  };
}

export interface DiscoveredTemplateGroupInfo {
  group_id: string;
  group_name: string;
  group_description: string;
  ordered: boolean;
  default: boolean;
  group_brief?: string;
  style_tags?: string[];
  industry_tags?: string[];
  use_cases?: string[];
  audience_tags?: string[];
  tone_tags?: string[];
  cover_layout_id?: string;
  agenda_layout_id?: string;
  closing_layout_id?: string;
  layout_roles_summary?: string[];
  content_elements_summary?: string[];
  source: {
    type: TemplateDiscoverySourceType;
    root_dir?: string;
  };
  layouts: DiscoveredTemplateLayoutInfo[];
}

export interface DiscoveredTemplateGroupSummaryInfo {
  group_id: string;
  group_name: string;
  group_description: string;
  ordered: boolean;
  default: boolean;
  group_brief?: string;
  style_tags?: string[];
  industry_tags?: string[];
  use_cases?: string[];
  audience_tags?: string[];
  tone_tags?: string[];
  cover_layout_id?: string;
  agenda_layout_id?: string;
  closing_layout_id?: string;
  layout_roles_summary?: string[];
  content_elements_summary?: string[];
  source: {
    type: TemplateDiscoverySourceType;
    root_dir?: string;
  };
  layout_count: number;
}

export interface DiscoverTemplateGroupsInput {
  include_builtin?: boolean;
  local_roots?: string[];
  cwd?: string | null;
}

export interface GetDiscoveredTemplateGroupInput extends DiscoverTemplateGroupsInput {
  group_id: string;
}

function normalizePathForJson(value: string): string {
  return value.replace(/\\/g, "/");
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

function toPortablePath(baseDir: string, targetPath: string): string {
  const relativePath = path.relative(baseDir, targetPath);
  if (
    relativePath.length === 0 ||
    (!relativePath.startsWith(`..${path.sep}`) &&
      relativePath !== ".." &&
      !path.isAbsolute(relativePath))
  ) {
    if (relativePath.length === 0) {
      return ".";
    }

    const normalizedRelativePath = normalizePathForJson(relativePath);
    return normalizedRelativePath.startsWith(".")
      ? normalizedRelativePath
      : `./${normalizedRelativePath}`;
  }

  return normalizePathForJson(targetPath);
}

function normalizeGroupLocalPath(relativePath: string): string {
  const normalizedRelativePath = normalizePathForJson(relativePath);
  return normalizedRelativePath.startsWith(".")
    ? normalizedRelativePath
    : `./${normalizedRelativePath}`;
}

function assertAbsolutePath(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Field "${fieldName}" must be a non-empty string`);
  }

  if (!path.isAbsolute(value)) {
    throw new Error(`Field "${fieldName}" must be an absolute path`);
  }
}

function stripKnownLocalExtension(value: string): string {
  const extension = path.extname(value);
  if (!ALLOWED_LOCAL_EXTENSIONS.has(extension.toLowerCase())) {
    return value;
  }
  return value.slice(0, -extension.length);
}

function normalizeLayoutOrderEntry(value: string): string {
  const normalizedValue = normalizePathForJson(value).replace(/^\.\//, "");
  return stripKnownLocalExtension(normalizedValue);
}

function createLayoutOrderMap(layouts: string[] | undefined): Map<string, number> {
  const orderMap = new Map<string, number>();
  if (!layouts) {
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

function normalizeSampleData(sampleData: unknown): Record<string, unknown> | undefined {
  return isPlainRecord(sampleData) ? sampleData : undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const result = value.filter((item): item is string => typeof item === "string");
  return result.length > 0 ? result : undefined;
}

function collectUniqueStrings(
  values: Array<string | string[] | undefined>,
): string[] | undefined {
  const collected = new Set<string>();

  values.forEach((value) => {
    if (typeof value === "string" && value.length > 0) {
      collected.add(value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === "string" && item.length > 0) {
          collected.add(item);
        }
      });
    }
  });

  if (collected.size === 0) {
    return undefined;
  }

  return Array.from(collected).sort((left, right) => left.localeCompare(right));
}

function buildGroupSummary(
  group: DiscoveredTemplateGroupInfo,
): DiscoveredTemplateGroupSummaryInfo {
  const layoutRolesSummary = collectUniqueStrings(
    group.layouts.map((layout) => layout.layout_role),
  );
  const contentElementsSummary = collectUniqueStrings(
    group.layouts.map((layout) => layout.content_elements),
  );

  return {
    group_id: group.group_id,
    group_name: group.group_name,
    group_description: group.group_description,
    ordered: group.ordered,
    default: group.default,
    group_brief: group.group_brief,
    style_tags: group.style_tags,
    industry_tags: group.industry_tags,
    use_cases: group.use_cases,
    audience_tags: group.audience_tags,
    tone_tags: group.tone_tags,
    cover_layout_id: group.cover_layout_id,
    agenda_layout_id: group.agenda_layout_id,
    closing_layout_id: group.closing_layout_id,
    layout_roles_summary: layoutRolesSummary,
    content_elements_summary: contentElementsSummary,
    source: { ...group.source },
    layout_count: group.layouts.length,
  };
}

function mapBuiltinGroup(group: TemplateLayoutsWithSettings): DiscoveredTemplateGroupInfo {
  const layouts = group.layouts.map((layout: TemplateWithData) => ({
    layout_id: layout.layoutId,
    layout_name: layout.layoutName,
    layout_description: layout.layoutDescription,
    json_schema: layout.schemaJSON as Record<string, unknown>,
    sample_data: normalizeSampleData(layout.sampleData),
    tags: normalizeStringArray(layout.layoutTags),
    layout_role: layout.layoutRole,
    content_elements: normalizeStringArray(layout.contentElements),
    use_cases: normalizeStringArray(layout.useCases),
    suitable_for: layout.suitableFor,
    avoid_for: layout.avoidFor,
    density: layout.density,
    visual_weight: layout.visualWeight,
    editable_text_priority: layout.editableTextPriority,
    source: {
      type: "builtin" as const,
    },
  }));

  return {
    group_id: group.id,
    group_name: group.name,
    group_description: group.description,
    ordered: group.settings.ordered,
    default: group.settings.default,
    group_brief: group.settings.groupBrief,
    style_tags: group.settings.styleTags,
    industry_tags: group.settings.industryTags,
    use_cases: group.settings.useCases,
    audience_tags: group.settings.audienceTags,
    tone_tags: group.settings.toneTags,
    cover_layout_id: group.settings.coverLayoutId,
    agenda_layout_id: group.settings.agendaLayoutId,
    closing_layout_id: group.settings.closingLayoutId,
    source: {
      type: "builtin",
    },
    layout_roles_summary: collectUniqueStrings(layouts.map((layout) => layout.layout_role)),
    content_elements_summary: collectUniqueStrings(
      layouts.map((layout) => layout.content_elements),
    ),
    layouts,
  };
}

async function assertDirectoryExists(directoryPath: string, label: string): Promise<void> {
  let directoryStat;
  try {
    directoryStat = await stat(directoryPath);
  } catch {
    throw new Error(`${label} not found: ${directoryPath}`);
  }

  if (!directoryStat.isDirectory()) {
    throw new Error(`${label} must be a directory: ${directoryPath}`);
  }
}

async function readLocalTemplateGroupMetadata(
  groupRoot: string,
): Promise<LocalTemplateGroupMetadata> {
  const groupJsonPath = path.join(groupRoot, "group.json");
  if (!(await pathExists(groupJsonPath))) {
    throw new Error(`Local template group is missing group.json: ${groupRoot}`);
  }

  let rawValue: unknown;
  try {
    rawValue = JSON.parse(await readFile(groupJsonPath, "utf8"));
  } catch (error) {
    throw new Error(
      `Failed to parse group.json for local template group "${groupRoot}": ${
        error instanceof Error ? error.message : "Unknown parse error"
      }`,
    );
  }

  if (!isPlainRecord(rawValue)) {
    throw new Error(`group.json must contain an object: ${groupJsonPath}`);
  }

  const metadata = rawValue as Record<string, unknown>;
  if (!metadata.group_id || typeof metadata.group_id !== "string") {
    throw new Error(`group.json must contain string field "group_id": ${groupJsonPath}`);
  }
  if (!metadata.group_name || typeof metadata.group_name !== "string") {
    throw new Error(`group.json must contain string field "group_name": ${groupJsonPath}`);
  }
  if (
    !metadata.group_description ||
    typeof metadata.group_description !== "string"
  ) {
    throw new Error(
      `group.json must contain string field "group_description": ${groupJsonPath}`,
    );
  }
  if (typeof metadata.ordered !== "boolean") {
    throw new Error(`group.json must contain boolean field "ordered": ${groupJsonPath}`);
  }
  if (typeof metadata.default !== "boolean") {
    throw new Error(`group.json must contain boolean field "default": ${groupJsonPath}`);
  }
  if (
    metadata.layouts !== undefined &&
    (!Array.isArray(metadata.layouts) ||
      metadata.layouts.some((layout) => typeof layout !== "string" || layout.length === 0))
  ) {
    throw new Error(
      `group.json field "layouts" must be a string array when provided: ${groupJsonPath}`,
    );
  }
  for (const [fieldName, fieldValue] of [
    ["style_tags", metadata.style_tags],
    ["industry_tags", metadata.industry_tags],
    ["use_cases", metadata.use_cases],
    ["audience_tags", metadata.audience_tags],
    ["tone_tags", metadata.tone_tags],
  ]) {
    if (
      fieldValue !== undefined &&
      (!Array.isArray(fieldValue) ||
        fieldValue.some((item) => typeof item !== "string" || item.length === 0))
    ) {
      throw new Error(`group.json field "${fieldName}" must be a string array: ${groupJsonPath}`);
    }
  }
  for (const [fieldName, fieldValue] of [
    ["group_brief", metadata.group_brief],
    ["cover_layout_id", metadata.cover_layout_id],
    ["agenda_layout_id", metadata.agenda_layout_id],
    ["closing_layout_id", metadata.closing_layout_id],
  ]) {
    if (fieldValue !== undefined && typeof fieldValue !== "string") {
      throw new Error(`group.json field "${fieldName}" must be a string: ${groupJsonPath}`);
    }
  }

  return {
    group_id: metadata.group_id,
    group_name: metadata.group_name,
    group_description: metadata.group_description,
    ordered: metadata.ordered,
    default: metadata.default,
    layouts: metadata.layouts as string[] | undefined,
    group_brief: metadata.group_brief as string | undefined,
    style_tags: metadata.style_tags as string[] | undefined,
    industry_tags: metadata.industry_tags as string[] | undefined,
    use_cases: metadata.use_cases as string[] | undefined,
    audience_tags: metadata.audience_tags as string[] | undefined,
    tone_tags: metadata.tone_tags as string[] | undefined,
    cover_layout_id: metadata.cover_layout_id as string | undefined,
    agenda_layout_id: metadata.agenda_layout_id as string | undefined,
    closing_layout_id: metadata.closing_layout_id as string | undefined,
  };
}

async function collectSlideRelativePaths(
  groupRoot: string,
  groupLayouts: string[] | undefined,
): Promise<string[]> {
  const slidesRoot = path.join(groupRoot, "slides");
  await assertDirectoryExists(slidesRoot, "Local template slides directory");

  const groupJsonOrder = createLayoutOrderMap(groupLayouts);
  const manifestOrder = await loadManifestLocalSlideOrder(groupRoot);
  const collectedPaths: string[] = [];

  const walk = async (currentDirectory: string): Promise<void> => {
    const entries = await readdir(currentDirectory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }

      const absoluteEntryPath = path.join(currentDirectory, entry.name);
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

      if (!ALLOWED_LOCAL_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        continue;
      }

      if (/^index\./i.test(entry.name)) {
        continue;
      }

      collectedPaths.push(
        normalizeGroupLocalPath(path.relative(groupRoot, absoluteEntryPath)),
      );
    }
  };

  await walk(slidesRoot);

  const availablePaths = new Set(
    collectedPaths.map((relativePath) => normalizeLayoutOrderEntry(relativePath)),
  );

  for (const layoutValue of groupLayouts ?? []) {
    const normalizedLayout = normalizeLayoutOrderEntry(layoutValue);
    if (!availablePaths.has(normalizedLayout)) {
      throw new Error(
        `group.json layout "${layoutValue}" does not match any slide source in ${groupRoot}`,
      );
    }
  }

  collectedPaths.sort((left, right) => {
    const leftGroupOrder =
      groupJsonOrder.get(normalizeLayoutOrderEntry(left)) ?? Number.MAX_SAFE_INTEGER;
    const rightGroupOrder =
      groupJsonOrder.get(normalizeLayoutOrderEntry(right)) ?? Number.MAX_SAFE_INTEGER;
    if (leftGroupOrder !== rightGroupOrder) {
      return leftGroupOrder - rightGroupOrder;
    }

    const leftOrder = manifestOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = manifestOrder.get(right) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.localeCompare(right);
  });

  return collectedPaths;
}

async function loadManifestLocalSlideOrder(groupRoot: string): Promise<Map<string, number>> {
  const manifestPath = path.join(groupRoot, "manifest.json");
  if (!(await pathExists(manifestPath))) {
    return new Map();
  }

  let rawValue: unknown;
  try {
    rawValue = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    return new Map();
  }

  if (!isPlainRecord(rawValue) || !Array.isArray(rawValue.slides)) {
    return new Map();
  }

  const orderMap = new Map<string, number>();
  rawValue.slides.forEach((slideValue, index) => {
    if (!isPlainRecord(slideValue) || !isPlainRecord(slideValue.source)) {
      return;
    }

    if (slideValue.source.type !== "local" || typeof slideValue.source.path !== "string") {
      return;
    }

    const normalizedPath = normalizeGroupLocalPath(slideValue.source.path);
    if (!orderMap.has(normalizedPath)) {
      orderMap.set(normalizedPath, index);
    }
  });

  return orderMap;
}

async function collectLocalGroupDirs(localRoots: string[], cwd: string): Promise<string[]> {
  const resolvedGroupDirs: string[] = [];
  const seenGroupDirs = new Set<string>();

  for (const rootValue of localRoots) {
    if (!rootValue || typeof rootValue !== "string") {
      throw new Error(`Local template root must be a non-empty string: ${String(rootValue)}`);
    }

    const absoluteRoot = path.resolve(cwd, rootValue);
    await assertDirectoryExists(absoluteRoot, "Local template root");

    const rootGroupJsonPath = path.join(absoluteRoot, "group.json");
    if (await pathExists(rootGroupJsonPath)) {
      if (!seenGroupDirs.has(absoluteRoot)) {
        resolvedGroupDirs.push(absoluteRoot);
        seenGroupDirs.add(absoluteRoot);
      }
      continue;
    }

    const entries = await readdir(absoluteRoot, { withFileTypes: true });
    const nestedGroupDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(absoluteRoot, entry.name))
      .sort((left, right) => left.localeCompare(right));

    let discoveredCount = 0;
    for (const candidateDir of nestedGroupDirs) {
      if (!(await pathExists(path.join(candidateDir, "group.json")))) {
        continue;
      }

      if (!seenGroupDirs.has(candidateDir)) {
        resolvedGroupDirs.push(candidateDir);
        seenGroupDirs.add(candidateDir);
      }
      discoveredCount += 1;
    }

    if (discoveredCount === 0) {
      throw new Error(`No local template groups found under root: ${absoluteRoot}`);
    }
  }

  return resolvedGroupDirs;
}

async function loadLocalGroup(
  groupRoot: string,
  cwd: string,
): Promise<DiscoveredTemplateGroupInfo> {
  const metadata = await readLocalTemplateGroupMetadata(groupRoot);
  const slidePaths = await collectSlideRelativePaths(groupRoot, metadata.layouts);
  const seenLayoutIds = new Set<string>();

  const layouts: DiscoveredTemplateLayoutInfo[] = [];
  for (const slidePath of slidePaths) {
    const absolutePath = await resolveLocalModulePath(
      slidePath,
      groupRoot,
      `Template group "${metadata.group_id}"`,
    );
    const moduleValue = await importLocalTemplateModule(absolutePath, groupRoot);
    assertLocalTemplateModule(moduleValue, absolutePath);

    if (seenLayoutIds.has(moduleValue.layoutId)) {
      throw new Error(
        `Duplicate local layoutId "${moduleValue.layoutId}" in template group "${metadata.group_id}"`,
      );
    }
    seenLayoutIds.add(moduleValue.layoutId);

    layouts.push({
      layout_id: moduleValue.layoutId,
      layout_name: moduleValue.layoutName,
      layout_description: moduleValue.layoutDescription,
      json_schema: getSchemaJSON(moduleValue.Schema) as Record<string, unknown>,
      sample_data: normalizeSampleData(
        moduleValue.sampleData ?? getSchemaDefaults(moduleValue.Schema),
      ),
      tags: moduleValue.layoutTags ? [...moduleValue.layoutTags] : undefined,
      layout_role: moduleValue.layoutRole,
      content_elements: moduleValue.contentElements
        ? [...moduleValue.contentElements]
        : undefined,
      use_cases: moduleValue.useCases ? [...moduleValue.useCases] : undefined,
      suitable_for: moduleValue.suitableFor,
      avoid_for: moduleValue.avoidFor,
      density: moduleValue.density,
      visual_weight: moduleValue.visualWeight,
      editable_text_priority: moduleValue.editableTextPriority,
      source: {
        type: "local",
        path: slidePath,
      },
    });
  }

  return {
    group_id: metadata.group_id,
    group_name: metadata.group_name,
    group_description: metadata.group_description,
    ordered: metadata.ordered,
    default: metadata.default,
    group_brief: metadata.group_brief,
    style_tags: metadata.style_tags,
    industry_tags: metadata.industry_tags,
    use_cases: metadata.use_cases,
    audience_tags: metadata.audience_tags,
    tone_tags: metadata.tone_tags,
    cover_layout_id: metadata.cover_layout_id,
    agenda_layout_id: metadata.agenda_layout_id,
    closing_layout_id: metadata.closing_layout_id,
    source: {
      type: "local",
      root_dir: toPortablePath(cwd, groupRoot),
    },
    layout_roles_summary: collectUniqueStrings(layouts.map((layout) => layout.layout_role)),
    content_elements_summary: collectUniqueStrings(
      layouts.map((layout) => layout.content_elements),
    ),
    layouts,
  };
}

function mergeDiscoveredGroups(
  groups: DiscoveredTemplateGroupInfo[],
): DiscoveredTemplateGroupInfo[] {
  const mergedGroups = new Map<string, DiscoveredTemplateGroupInfo>();

  groups.forEach((group) => {
    const existingGroup = mergedGroups.get(group.group_id);
    if (existingGroup) {
      throw new Error(
        `Duplicate template group id "${group.group_id}" from ${existingGroup.source.type} and ${group.source.type}`,
      );
    }
    mergedGroups.set(group.group_id, group);
  });

  return Array.from(mergedGroups.values()).sort((left, right) =>
    left.group_id.localeCompare(right.group_id),
  );
}

async function loadLocalGroups(
  localRoots: string[],
  cwd: string,
): Promise<DiscoveredTemplateGroupInfo[]> {
  if (localRoots.length === 0) {
    return [];
  }

  const groupDirs = await collectLocalGroupDirs(localRoots, cwd);
  const groups: DiscoveredTemplateGroupInfo[] = [];
  for (const groupDir of groupDirs) {
    groups.push(await loadLocalGroup(groupDir, cwd));
  }

  return groups;
}

function loadBuiltinGroups(includeBuiltin: boolean): DiscoveredTemplateGroupInfo[] {
  if (!includeBuiltin) {
    return [];
  }

  return templates.map(mapBuiltinGroup);
}

export async function getAllDiscoveredTemplateGroups(
  input: DiscoverTemplateGroupsInput = {},
): Promise<DiscoveredTemplateGroupInfo[]> {
  if (input.cwd !== undefined && input.cwd !== null) {
    assertAbsolutePath(input.cwd, "cwd");
  }

  input.local_roots?.forEach((root, index) => {
    assertAbsolutePath(root, `local_roots[${index}]`);
  });

  const cwd = path.resolve(input.cwd ?? process.cwd());
  const includeBuiltin = input.include_builtin !== false;
  const localRoots = input.local_roots ?? [];

  const builtinGroups = loadBuiltinGroups(includeBuiltin);
  const localGroups = await loadLocalGroups(localRoots, cwd);

  return mergeDiscoveredGroups([...builtinGroups, ...localGroups]);
}

export async function listDiscoveredTemplateGroupSummaries(
  input: DiscoverTemplateGroupsInput = {},
): Promise<DiscoveredTemplateGroupSummaryInfo[]> {
  const groups = await getAllDiscoveredTemplateGroups(input);
  return groups.map(buildGroupSummary);
}

export async function getDiscoveredTemplateGroup(
  input: GetDiscoveredTemplateGroupInput,
): Promise<DiscoveredTemplateGroupInfo | null> {
  if (!input || typeof input !== "object") {
    throw new Error("Discovery group input must be an object");
  }

  if (!input.group_id || typeof input.group_id !== "string") {
    throw new Error('Field "group_id" is required');
  }

  const groups = await getAllDiscoveredTemplateGroups(input);
  return groups.find((group) => group.group_id === input.group_id) ?? null;
}
