import type {
  PagePlanItem,
  ResearchEvidenceFact,
  ResearchEvidenceIndex,
  ResearchEvidencePage,
  ResearchRequirement,
  VisualResearchCurationDraft,
  VisualResearchEvidence,
  WebResearchCurationDraft,
} from "../../api/types";

type RecordValue = Record<string, unknown>;

export interface DraftValidationResult<T> {
  draft: T | null;
  gaps: string[];
}

export interface DraftValidationOptions {
  curationRunId?: string;
  draftType?: "web" | "visual";
}

export interface MergeResearchCurationDraftsInput {
  currentEvidence: ResearchEvidenceIndex;
  page: PagePlanItem;
  requirement: ResearchRequirement;
  evidenceMarkdownPath: string;
  webDraft?: WebResearchCurationDraft | null;
  visualDraft?: VisualResearchCurationDraft | null;
  gaps?: string[];
  now?: string;
}

export interface MergeResearchCurationDraftsResult {
  evidence: ResearchEvidenceIndex;
  pageEvidence: ResearchEvidencePage;
  markdown: string;
}

const VALID_DRAFT_STATUSES = new Set(["curated", "gap", "error", "skipped"]);
const VALID_SOURCE_TYPES = new Set(["user_provided", "web_source", "image_source"]);
const VALID_CONFIDENCE = new Set(["low", "medium", "high"]);

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(record: RecordValue, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function readOptionalString(record: RecordValue, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readRecordArray(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function normalizeGaps(value: unknown): string[] {
  return readStringArray(value).filter((item) => item.trim().length > 0);
}

function normalizeRejectedMaterial(value: unknown): Array<{ source?: string; reason: string }> {
  return readRecordArray(value)
    .map((item) => ({
      ...(readOptionalString(item, "source") ? { source: readOptionalString(item, "source") } : {}),
      reason: readString(item, "reason"),
    }))
    .filter((item) => item.reason.trim().length > 0);
}

function normalizeFacts(value: unknown): ResearchEvidenceFact[] {
  return readRecordArray(value)
    .map((item) => {
      const sourceType = readString(item, "source_type");
      const confidence = readOptionalString(item, "confidence");
      return {
        id: readString(item, "id"),
        claim: readString(item, "claim"),
        source_type: VALID_SOURCE_TYPES.has(sourceType)
          ? (sourceType as ResearchEvidenceFact["source_type"])
          : "web_source",
        ...(readOptionalString(item, "source_title") ? { source_title: readOptionalString(item, "source_title") } : {}),
        ...(readOptionalString(item, "source_url") ? { source_url: readOptionalString(item, "source_url") } : {}),
        ...(readOptionalString(item, "source_file") ? { source_file: readOptionalString(item, "source_file") } : {}),
        ...(readOptionalString(item, "retrieved_at") ? { retrieved_at: readOptionalString(item, "retrieved_at") } : {}),
        ...(readOptionalString(item, "excerpt") ? { excerpt: readOptionalString(item, "excerpt") } : {}),
        ...(readOptionalString(item, "source_note") ? { source_note: readOptionalString(item, "source_note") } : {}),
        ...(confidence && VALID_CONFIDENCE.has(confidence)
          ? { confidence: confidence as ResearchEvidenceFact["confidence"] }
          : {}),
      };
    })
    .filter((item) => item.id.trim().length > 0 && item.claim.trim().length > 0);
}

function normalizeDerivedInsights(value: unknown): ResearchEvidencePage["derived_insights"] {
  return readRecordArray(value)
    .map((item) => ({
      id: readString(item, "id"),
      insight: readString(item, "insight"),
      supporting_fact_ids: readStringArray(item.supporting_fact_ids),
    }))
    .filter((item) => item.id.trim().length > 0 && item.insight.trim().length > 0);
}

function normalizeVisualAssets(value: unknown): VisualResearchEvidence[] {
  return readRecordArray(value)
    .map((item) => ({
      id: readString(item, "id"),
      file_path: readString(item, "file_path"),
      ...(readOptionalString(item, "original_raw_path") ? { original_raw_path: readOptionalString(item, "original_raw_path") } : {}),
      ...(readOptionalString(item, "image_url") ? { image_url: readOptionalString(item, "image_url") } : {}),
      ...(readOptionalString(item, "page_url") ? { page_url: readOptionalString(item, "page_url") } : {}),
      ...(readOptionalString(item, "sha256") ? { sha256: readOptionalString(item, "sha256") } : {}),
      reason: readString(item, "reason"),
      visual_summary: readString(item, "visual_summary"),
    }))
    .filter((item) =>
      item.id.trim().length > 0 &&
      item.file_path.trim().length > 0 &&
      item.reason.trim().length > 0 &&
      item.visual_summary.trim().length > 0,
    );
}

function validateDraftBase(
  value: unknown,
  pageId: string,
  label: string,
  options: DraftValidationOptions = {},
): {
  record: RecordValue | null;
  gaps: string[];
} {
  if (!isRecord(value)) {
    return { record: null, gaps: [`${label} draft was not a JSON object.`] };
  }

  const gaps: string[] = [];
  if (value.version !== 1) {
    gaps.push(`${label} draft version must be 1.`);
  }
  if (readString(value, "page_id") !== pageId) {
    gaps.push(`${label} draft page_id does not match current page.`);
  }
  const status = readString(value, "status");
  if (!VALID_DRAFT_STATUSES.has(status)) {
    gaps.push(`${label} draft status is invalid.`);
  }
  if (options.draftType && readString(value, "draft_type") !== options.draftType) {
    gaps.push(`${label} draft_type does not match current curation path.`);
  }
  if (options.curationRunId && readString(value, "curation_run_id") !== options.curationRunId) {
    gaps.push(`${label} draft curation_run_id does not match current curation run.`);
  }

  return { record: value, gaps };
}

export function validateWebResearchCurationDraft(
  value: unknown,
  pageId: string,
  options: DraftValidationOptions = {},
): DraftValidationResult<WebResearchCurationDraft> {
  const base = validateDraftBase(
    value,
    pageId,
    "Web Research Curation",
    options.curationRunId || options.draftType
      ? { ...options, draftType: options.draftType ?? "web" }
      : options,
  );
  if (!base.record) return { draft: null, gaps: base.gaps };

  const draft: WebResearchCurationDraft = {
    version: 1,
    page_id: pageId,
    ...(readOptionalString(base.record, "curation_run_id")
      ? { curation_run_id: readOptionalString(base.record, "curation_run_id") }
      : {}),
    draft_type: "web",
    status: readString(base.record, "status") as WebResearchCurationDraft["status"],
    facts: normalizeFacts(base.record.facts),
    derived_insights: normalizeDerivedInsights(base.record.derived_insights),
    gaps: normalizeGaps(base.record.gaps),
    rejected_material: normalizeRejectedMaterial(base.record.rejected_material),
    ...(readOptionalString(base.record, "source_summary")
      ? { source_summary: readOptionalString(base.record, "source_summary") }
      : {}),
    updated_at: readOptionalString(base.record, "updated_at") ?? new Date().toISOString(),
  };

  const gaps = [...base.gaps];
  if (draft.status === "curated" && draft.facts.length === 0 && draft.derived_insights.length === 0) {
    gaps.push("Web Research Curation draft was curated but contained no usable factual evidence.");
  }

  return { draft: gaps.length > 0 ? null : draft, gaps };
}

export function validateVisualResearchCurationDraft(
  value: unknown,
  pageId: string,
  options: DraftValidationOptions = {},
): DraftValidationResult<VisualResearchCurationDraft> {
  const base = validateDraftBase(
    value,
    pageId,
    "Visual Research Curation",
    options.curationRunId || options.draftType
      ? { ...options, draftType: options.draftType ?? "visual" }
      : options,
  );
  if (!base.record) return { draft: null, gaps: base.gaps };

  const gaps = [...base.gaps];
  if ("facts" in base.record || "derived_insights" in base.record) {
    gaps.push("Visual Research Curation draft must not contain factual evidence.");
  }

  const draft: VisualResearchCurationDraft = {
    version: 1,
    page_id: pageId,
    ...(readOptionalString(base.record, "curation_run_id")
      ? { curation_run_id: readOptionalString(base.record, "curation_run_id") }
      : {}),
    draft_type: "visual",
    status: readString(base.record, "status") as VisualResearchCurationDraft["status"],
    visual_assets: normalizeVisualAssets(base.record.visual_assets),
    gaps: normalizeGaps(base.record.gaps),
    rejected_material: normalizeRejectedMaterial(base.record.rejected_material),
    ...(readOptionalString(base.record, "visual_summary")
      ? { visual_summary: readOptionalString(base.record, "visual_summary") }
      : {}),
    updated_at: readOptionalString(base.record, "updated_at") ?? new Date().toISOString(),
  };

  if (draft.status === "curated" && draft.visual_assets.length === 0) {
    gaps.push("Visual Research Curation draft was curated but contained no usable visual assets.");
  }

  return { draft: gaps.length > 0 ? null : draft, gaps };
}

export function createWebResearchCurationGapDraft(input: {
  pageId: string;
  gaps: string[];
  curationRunId?: string;
  now?: string;
}): WebResearchCurationDraft {
  return {
    version: 1,
    page_id: input.pageId,
    ...(input.curationRunId ? { curation_run_id: input.curationRunId } : {}),
    draft_type: "web",
    status: "gap",
    facts: [],
    derived_insights: [],
    gaps: input.gaps,
    rejected_material: [],
    updated_at: input.now ?? new Date().toISOString(),
  };
}

export function createVisualResearchCurationGapDraft(input: {
  pageId: string;
  gaps: string[];
  curationRunId?: string;
  now?: string;
}): VisualResearchCurationDraft {
  return {
    version: 1,
    page_id: input.pageId,
    ...(input.curationRunId ? { curation_run_id: input.curationRunId } : {}),
    draft_type: "visual",
    status: "gap",
    visual_assets: [],
    gaps: input.gaps,
    rejected_material: [],
    updated_at: input.now ?? new Date().toISOString(),
  };
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function buildPageEvidenceMarkdown(pageEvidence: ResearchEvidencePage, page: PagePlanItem): string {
  const lines: string[] = [
    `# Research Evidence: ${page.title}`,
    "",
    `Page: ${page.page_id}`,
    `Status: ${pageEvidence.status}`,
    "",
    "## Facts",
  ];

  if (pageEvidence.facts.length === 0) {
    lines.push("- None");
  } else {
    pageEvidence.facts.forEach((fact) => {
      const source = fact.source_title || fact.source_url || fact.source_file || fact.source_type;
      lines.push(`- ${fact.id}: ${fact.claim}${source ? ` (Source: ${source})` : ""}`);
      if (fact.excerpt) lines.push(`  Excerpt: ${fact.excerpt}`);
    });
  }

  lines.push("", "## Derived Insights");
  if (pageEvidence.derived_insights.length === 0) {
    lines.push("- None");
  } else {
    pageEvidence.derived_insights.forEach((insight) => {
      lines.push(`- ${insight.id}: ${insight.insight} (Supports: ${insight.supporting_fact_ids.join(", ") || "none"})`);
    });
  }

  lines.push("", "## Visual Assets");
  if (pageEvidence.visual_assets.length === 0) {
    lines.push("- None");
  } else {
    pageEvidence.visual_assets.forEach((asset) => {
      lines.push(`- ${asset.id}: ${asset.file_path}`);
      lines.push(`  Reason: ${asset.reason}`);
      lines.push(`  Visual summary: ${asset.visual_summary}`);
    });
  }

  lines.push("", "## Gaps");
  if (pageEvidence.gaps.length === 0) {
    lines.push("- None");
  } else {
    pageEvidence.gaps.forEach((gap) => lines.push(`- ${gap}`));
  }

  lines.push("", "## Rejected Material");
  if (pageEvidence.rejected_material.length === 0) {
    lines.push("- None");
  } else {
    pageEvidence.rejected_material.forEach((item) => {
      lines.push(`- ${item.source ? `${item.source}: ` : ""}${item.reason}`);
    });
  }

  return `${lines.join("\n")}\n`;
}

function computeIndexStatus(pages: ResearchEvidencePage[]): ResearchEvidenceIndex["status"] {
  if (pages.length === 0) return "empty";
  if (pages.every((page) => page.status === "curated" || page.status === "skipped")) {
    return "curated";
  }
  return "partial";
}

function normalizeTextKey(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
}

function dedupeFacts(
  facts: ResearchEvidencePage["facts"],
): ResearchEvidencePage["facts"] {
  const seen = new Set<string>();
  const result: ResearchEvidencePage["facts"] = [];
  for (const fact of facts) {
    const key =
      normalizeTextKey(fact.source_url) ||
      normalizeTextKey(fact.source_file) ||
      normalizeTextKey(fact.claim) ||
      fact.id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(fact);
  }
  return result;
}

function dedupeVisualAssets(
  assets: ResearchEvidencePage["visual_assets"],
): ResearchEvidencePage["visual_assets"] {
  const seen = new Set<string>();
  const result: ResearchEvidencePage["visual_assets"] = [];
  for (const asset of assets) {
    const key =
      normalizeTextKey(asset.sha256) ||
      normalizeTextKey(asset.file_path) ||
      normalizeTextKey(asset.image_url) ||
      normalizeTextKey(asset.page_url) ||
      asset.id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(asset);
  }
  return result;
}

function dedupeInsights(
  insights: ResearchEvidencePage["derived_insights"],
): ResearchEvidencePage["derived_insights"] {
  const seen = new Set<string>();
  const result: ResearchEvidencePage["derived_insights"] = [];
  for (const insight of insights) {
    const key = normalizeTextKey(insight.insight) || insight.id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(insight);
  }
  return result;
}

function dedupeRejectedMaterial(
  rejected: ResearchEvidencePage["rejected_material"],
): ResearchEvidencePage["rejected_material"] {
  const seen = new Set<string>();
  const result: ResearchEvidencePage["rejected_material"] = [];
  for (const item of rejected) {
    const key = `${normalizeTextKey(item.source)}:${normalizeTextKey(item.reason)}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function mergeResearchCurationDrafts(
  input: MergeResearchCurationDraftsInput,
): MergeResearchCurationDraftsResult {
  const now = input.now ?? new Date().toISOString();
  const existingPage = input.currentEvidence.pages.find((page) => page.page_id === input.page.page_id) ?? null;
  const gaps = dedupeStrings([
    ...(existingPage?.gaps ?? []),
    ...(input.gaps ?? []),
    ...(input.webDraft?.gaps ?? []),
    ...(input.visualDraft?.gaps ?? []),
  ]);
  const facts = dedupeFacts([
    ...(existingPage?.facts ?? []),
    ...(input.webDraft?.facts ?? []),
  ]);
  const derivedInsights = dedupeInsights([
    ...(existingPage?.derived_insights ?? []),
    ...(input.webDraft?.derived_insights ?? []),
  ]);
  const visualAssets = dedupeVisualAssets([
    ...(existingPage?.visual_assets ?? []),
    ...(input.visualDraft?.visual_assets ?? []),
  ]);
  const rejectedMaterial = dedupeRejectedMaterial([
    ...(existingPage?.rejected_material ?? []),
    ...(input.webDraft?.rejected_material ?? []),
    ...(input.visualDraft?.rejected_material ?? []),
  ]);
  const hasUsableEvidence =
    facts.length > 0 || derivedInsights.length > 0 || visualAssets.length > 0;

  const pageEvidence: ResearchEvidencePage = {
    page_id: input.page.page_id,
    status: hasUsableEvidence ? "curated" : "gap",
    facts,
    visual_assets: visualAssets,
    derived_insights: derivedInsights,
    gaps,
    rejected_material: rejectedMaterial,
    markdown_path: input.evidenceMarkdownPath,
    updated_at: now,
  };

  const existingIndex = input.currentEvidence.pages.findIndex((page) => page.page_id === input.page.page_id);
  const pages =
    existingIndex >= 0
      ? input.currentEvidence.pages.map((page, index) => index === existingIndex ? pageEvidence : page)
      : [...input.currentEvidence.pages, pageEvidence];

  const evidence: ResearchEvidenceIndex = {
    version: 1,
    status: computeIndexStatus(pages),
    pages,
    shared: {
      facts: Array.isArray(input.currentEvidence.shared?.facts) ? input.currentEvidence.shared.facts : [],
      visual_assets: Array.isArray(input.currentEvidence.shared?.visual_assets)
        ? input.currentEvidence.shared.visual_assets
        : [],
      gaps: Array.isArray(input.currentEvidence.shared?.gaps) ? input.currentEvidence.shared.gaps : [],
    },
    updated_at: now,
  };

  return {
    evidence,
    pageEvidence,
    markdown: buildPageEvidenceMarkdown(pageEvidence, input.page),
  };
}
