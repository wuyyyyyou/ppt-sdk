import type {
  UploadedSourceAnalysisDependency,
  UploadedSourceIndex,
  UploadedSourceMaterial,
} from "../../api/types";

type RecordValue = Record<string, unknown>;

export interface UploadedSourceContinuationDecision {
  can_continue: boolean;
  reason: string;
  blocking: boolean;
}

export interface UploadedSourceRejectedMaterial {
  uploaded_source_id?: string;
  source_path?: string;
  reason: string;
}

export interface UploadedSourceAnalysisGap {
  uploaded_source_id?: string;
  source_path?: string;
  reason: string;
}

export interface UploadedSourceSelectedFact {
  id: string;
  claim: string;
  uploaded_source_id: string;
  source_path: string;
  source_label?: string;
  excerpt?: string;
  confidence?: "low" | "medium" | "high";
}

export interface UploadedSourceVisualAssetCandidate {
  id: string;
  uploaded_source_id: string;
  source_path: string;
  use_constraint:
    | "usable_visual_asset"
    | "reference_only"
    | "must_use"
    | "do_not_use"
    | "needs_confirmation"
    | "rejected";
  reason: string;
  visual_summary: string;
}

export interface UploadedSourceFactualAnalysisDraft {
  version: 1;
  draft_type: "factual";
  status: "ready" | "gap" | "skipped";
  continuation_decision: UploadedSourceContinuationDecision;
  facts: UploadedSourceSelectedFact[];
  gaps: UploadedSourceAnalysisGap[];
  rejected_material: UploadedSourceRejectedMaterial[];
  source_summary?: string;
  updated_at: string;
}

export interface UploadedSourceVisualAnalysisDraft {
  version: 1;
  draft_type: "visual";
  status: "ready" | "gap" | "skipped";
  continuation_decision: UploadedSourceContinuationDecision;
  visual_assets: UploadedSourceVisualAssetCandidate[];
  gaps: UploadedSourceAnalysisGap[];
  rejected_material: UploadedSourceRejectedMaterial[];
  visual_summary?: string;
  updated_at: string;
}

export interface UploadedSourceAnalysis {
  version: 1;
  status: "ready" | "blocked" | "gap";
  source: {
    active_uploaded_sources: Array<{
      uploaded_source_id: string;
      sha256: string;
      size_bytes: number;
      file_path: string;
    }>;
    active_total_size_bytes: number;
  };
  continuation_decision: UploadedSourceContinuationDecision;
  facts: UploadedSourceSelectedFact[];
  visual_assets: UploadedSourceVisualAssetCandidate[];
  gaps: UploadedSourceAnalysisGap[];
  rejected_material: UploadedSourceRejectedMaterial[];
  source_summaries: string[];
  updated_at: string;
}

export interface CompactUploadedSourceAnalysisContext {
  status: UploadedSourceAnalysis["status"];
  continuation_decision: UploadedSourceContinuationDecision;
  source_count: number;
  facts: Array<{
    id: string;
    claim: string;
    uploaded_source_id: string;
    source_label?: string;
    excerpt?: string;
    confidence?: "low" | "medium" | "high";
  }>;
  visual_assets: Array<{
    id: string;
    uploaded_source_id: string;
    use_constraint: UploadedSourceVisualAssetCandidate["use_constraint"];
    reason: string;
    visual_summary: string;
  }>;
  gaps: string[];
  source_summaries: string[];
  updated_at: string;
}

export interface UploadedSourceDraftValidationResult<T> {
  draft: T | null;
  gaps: string[];
}

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(record: RecordValue, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function readOptionalString(record: RecordValue, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readRecordArray(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function readSelectedEvidenceRecordArray(input: {
  value: unknown;
  fieldName: string;
  itemLabel: string;
}): { records: RecordValue[]; gaps: string[] } {
  if (input.value === undefined || input.value === null) {
    return { records: [], gaps: [] };
  }
  if (!Array.isArray(input.value)) {
    return {
      records: [],
      gaps: [`Uploaded Source ${input.fieldName} must be an array when provided.`],
    };
  }

  const records: RecordValue[] = [];
  const gaps: string[] = [];
  input.value.forEach((item, index) => {
    if (isRecord(item)) {
      records.push(item);
      return;
    }
    gaps.push(`Uploaded Source ${input.itemLabel} at index ${index} is invalid: item must be a JSON object.`);
  });
  return { records, gaps };
}

function normalizeContinuationDecision(value: unknown): UploadedSourceContinuationDecision | null {
  if (!isRecord(value) || typeof value.can_continue !== "boolean") return null;
  const reason = readString(value, "reason");
  return {
    can_continue: value.can_continue,
    reason: reason || (value.can_continue ? "Analysis may continue." : "Analysis cannot continue."),
    blocking: typeof value.blocking === "boolean" ? value.blocking : !value.can_continue,
  };
}

function normalizeGaps(value: unknown): UploadedSourceAnalysisGap[] {
  return readRecordArray(value)
    .map((record) => ({
      ...(readOptionalString(record, "uploaded_source_id") ? { uploaded_source_id: readOptionalString(record, "uploaded_source_id") } : {}),
      ...(readOptionalString(record, "source_path") ? { source_path: readOptionalString(record, "source_path") } : {}),
      reason: readString(record, "reason"),
    }))
    .filter((item) => item.reason.trim().length > 0);
}

function normalizeRejectedMaterial(value: unknown): UploadedSourceRejectedMaterial[] {
  return readRecordArray(value)
    .map((record) => ({
      ...(readOptionalString(record, "uploaded_source_id") ? { uploaded_source_id: readOptionalString(record, "uploaded_source_id") } : {}),
      ...(readOptionalString(record, "source_path") ? { source_path: readOptionalString(record, "source_path") } : {}),
      reason: readString(record, "reason"),
    }))
    .filter((item) => item.reason.trim().length > 0);
}

function normalizeFactRecord(record: RecordValue): UploadedSourceSelectedFact {
  const confidence = readOptionalString(record, "confidence");
  const normalizedConfidence: UploadedSourceSelectedFact["confidence"] =
    confidence === "low" || confidence === "medium" || confidence === "high"
      ? confidence
      : undefined;
  return {
    id: readString(record, "id"),
    claim: readString(record, "claim"),
    uploaded_source_id: readString(record, "uploaded_source_id"),
    source_path: readString(record, "source_path"),
    ...(readOptionalString(record, "source_label") ? { source_label: readOptionalString(record, "source_label") } : {}),
    ...(readOptionalString(record, "excerpt") ? { excerpt: readOptionalString(record, "excerpt") } : {}),
    ...(normalizedConfidence ? { confidence: normalizedConfidence } : {}),
  };
}

function normalizeFactsWithGaps(value: unknown): {
  facts: UploadedSourceSelectedFact[];
  gaps: string[];
} {
  const input = readSelectedEvidenceRecordArray({
    value,
    fieldName: "facts",
    itemLabel: "factual analysis fact",
  });
  const facts: UploadedSourceSelectedFact[] = [];
  const gaps = [...input.gaps];

  input.records.forEach((record, index) => {
    const fact = normalizeFactRecord(record);
    const missingFields = [
      ["id", fact.id],
      ["claim", fact.claim],
      ["uploaded_source_id", fact.uploaded_source_id],
      ["source_path", fact.source_path],
    ].flatMap(([field, fieldValue]) => fieldValue.trim().length === 0 ? [field] : []);

    if (missingFields.length > 0) {
      gaps.push(`Uploaded Source fact at index ${index} is invalid: missing ${missingFields.join(", ")}.`);
      return;
    }
    facts.push(fact);
  });

  return { facts, gaps };
}

const VALID_VISUAL_USE_CONSTRAINTS = new Set([
  "usable_visual_asset",
  "reference_only",
  "must_use",
  "do_not_use",
  "needs_confirmation",
  "rejected",
]);

function normalizeVisualAssetRecord(record: RecordValue): UploadedSourceVisualAssetCandidate {
  const useConstraint = readString(record, "use_constraint");
  return {
    id: readString(record, "id"),
    uploaded_source_id: readString(record, "uploaded_source_id"),
    source_path: readString(record, "source_path"),
    use_constraint: VALID_VISUAL_USE_CONSTRAINTS.has(useConstraint)
      ? useConstraint as UploadedSourceVisualAssetCandidate["use_constraint"]
      : "needs_confirmation",
    reason: readString(record, "reason"),
    visual_summary: readString(record, "visual_summary"),
  };
}

function normalizeVisualAssetsWithGaps(value: unknown): {
  visualAssets: UploadedSourceVisualAssetCandidate[];
  gaps: string[];
} {
  const input = readSelectedEvidenceRecordArray({
    value,
    fieldName: "visual_assets",
    itemLabel: "visual asset",
  });
  const visualAssets: UploadedSourceVisualAssetCandidate[] = [];
  const gaps = [...input.gaps];

  input.records.forEach((record, index) => {
    const asset = normalizeVisualAssetRecord(record);
    const rawUseConstraint = readString(record, "use_constraint");
    const missingFields = [
      ["id", asset.id],
      ["uploaded_source_id", asset.uploaded_source_id],
      ["source_path", asset.source_path],
      ["reason", asset.reason],
      ["visual_summary", asset.visual_summary],
    ].flatMap(([field, fieldValue]) => fieldValue.trim().length === 0 ? [field] : []);
    if (!VALID_VISUAL_USE_CONSTRAINTS.has(rawUseConstraint)) {
      missingFields.push("use_constraint");
    }

    if (missingFields.length > 0) {
      gaps.push(`Uploaded Source visual asset at index ${index} is invalid: missing or invalid ${missingFields.join(", ")}.`);
      return;
    }
    visualAssets.push(asset);
  });

  return { visualAssets, gaps };
}

function validateBase(value: unknown, draftType: "factual" | "visual") {
  if (!isRecord(value)) {
    return { record: null, gaps: [`Uploaded Source ${draftType} draft was not a JSON object.`] };
  }
  const gaps: string[] = [];
  if (value.version !== 1) gaps.push(`Uploaded Source ${draftType} draft version must be 1.`);
  if (readString(value, "draft_type") !== draftType) {
    gaps.push(`Uploaded Source ${draftType} draft_type is invalid.`);
  }
  const status = readString(value, "status");
  if (status !== "ready" && status !== "gap" && status !== "skipped") {
    gaps.push(`Uploaded Source ${draftType} draft status is invalid.`);
  }
  if (!normalizeContinuationDecision(value.continuation_decision)) {
    gaps.push(`Uploaded Source ${draftType} draft continuation_decision is missing or invalid.`);
  }
  return { record: value, gaps };
}

export function validateUploadedSourceFactualAnalysisDraft(
  value: unknown,
): UploadedSourceDraftValidationResult<UploadedSourceFactualAnalysisDraft> {
  const base = validateBase(value, "factual");
  if (!base.record) return { draft: null, gaps: base.gaps };
  const gaps = [...base.gaps];
  if ("visual_assets" in base.record) {
    gaps.push("Uploaded Source Factual Analysis Draft must not contain visual_assets.");
  }
  const normalizedFacts = normalizeFactsWithGaps(base.record.facts);
  gaps.push(...normalizedFacts.gaps);
  const draft: UploadedSourceFactualAnalysisDraft = {
    version: 1,
    draft_type: "factual",
    status: readString(base.record, "status") as UploadedSourceFactualAnalysisDraft["status"],
    continuation_decision: normalizeContinuationDecision(base.record.continuation_decision) ?? {
      can_continue: false,
      reason: "Missing continuation decision.",
      blocking: true,
    },
    facts: normalizedFacts.facts,
    gaps: normalizeGaps(base.record.gaps),
    rejected_material: normalizeRejectedMaterial(base.record.rejected_material),
    ...(readOptionalString(base.record, "source_summary") ? { source_summary: readOptionalString(base.record, "source_summary") } : {}),
    updated_at: readOptionalString(base.record, "updated_at") ?? new Date().toISOString(),
  };
  return { draft: gaps.length > 0 ? null : draft, gaps };
}

export function validateUploadedSourceVisualAnalysisDraft(
  value: unknown,
): UploadedSourceDraftValidationResult<UploadedSourceVisualAnalysisDraft> {
  const base = validateBase(value, "visual");
  if (!base.record) return { draft: null, gaps: base.gaps };
  const gaps = [...base.gaps];
  if ("facts" in base.record || "derived_insights" in base.record) {
    gaps.push("Uploaded Source Visual Analysis Draft must not contain factual evidence.");
  }
  const normalizedVisualAssets = normalizeVisualAssetsWithGaps(base.record.visual_assets);
  gaps.push(...normalizedVisualAssets.gaps);
  const draft: UploadedSourceVisualAnalysisDraft = {
    version: 1,
    draft_type: "visual",
    status: readString(base.record, "status") as UploadedSourceVisualAnalysisDraft["status"],
    continuation_decision: normalizeContinuationDecision(base.record.continuation_decision) ?? {
      can_continue: false,
      reason: "Missing continuation decision.",
      blocking: true,
    },
    visual_assets: normalizedVisualAssets.visualAssets,
    gaps: normalizeGaps(base.record.gaps),
    rejected_material: normalizeRejectedMaterial(base.record.rejected_material),
    ...(readOptionalString(base.record, "visual_summary") ? { visual_summary: readOptionalString(base.record, "visual_summary") } : {}),
    updated_at: readOptionalString(base.record, "updated_at") ?? new Date().toISOString(),
  };
  return { draft: gaps.length > 0 ? null : draft, gaps };
}

export function createSkippedUploadedSourceVisualAnalysisDraft(reason: string): UploadedSourceVisualAnalysisDraft {
  return {
    version: 1,
    draft_type: "visual",
    status: "skipped",
    continuation_decision: {
      can_continue: true,
      reason,
      blocking: false,
    },
    visual_assets: [],
    gaps: [],
    rejected_material: [],
    visual_summary: reason,
    updated_at: new Date().toISOString(),
  };
}

export function mergeUploadedSourceAnalysis(input: {
  uploadedSourceIndex: UploadedSourceIndex;
  factualDraft: UploadedSourceFactualAnalysisDraft;
  visualDraft: UploadedSourceVisualAnalysisDraft;
  now?: string;
}): UploadedSourceAnalysis {
  const now = input.now ?? new Date().toISOString();
  const sourceMaterials = input.uploadedSourceIndex.materials
    .filter((material): material is UploadedSourceMaterial => material.status === "active")
    .map((material) => ({
      uploaded_source_id: material.uploaded_source_id,
      sha256: material.sha256,
      size_bytes: material.size_bytes,
      file_path: material.file_path,
    }));
  const canContinue =
    input.factualDraft.continuation_decision.can_continue &&
    input.visualDraft.continuation_decision.can_continue;
  const blocking =
    input.factualDraft.continuation_decision.blocking ||
    input.visualDraft.continuation_decision.blocking ||
    !canContinue;
  const gaps = [
    ...input.factualDraft.gaps,
    ...input.visualDraft.gaps,
  ];
  const facts = input.factualDraft.facts;
  const visualAssets = input.visualDraft.visual_assets;
  return {
    version: 1,
    status: !canContinue || blocking
      ? "blocked"
      : facts.length > 0 || visualAssets.length > 0
        ? "ready"
        : "gap",
    source: {
      active_uploaded_sources: sourceMaterials,
      active_total_size_bytes: input.uploadedSourceIndex.active_total_size_bytes,
    },
    continuation_decision: {
      can_continue: canContinue,
      blocking,
      reason: [
        input.factualDraft.continuation_decision.reason,
        input.visualDraft.continuation_decision.reason,
      ].filter(Boolean).join("\n"),
    },
    facts,
    visual_assets: visualAssets,
    gaps,
    rejected_material: [
      ...input.factualDraft.rejected_material,
      ...input.visualDraft.rejected_material,
    ],
    source_summaries: [
      input.factualDraft.source_summary,
      input.visualDraft.visual_summary,
    ].filter((item): item is string => typeof item === "string" && item.length > 0),
    updated_at: now,
  };
}

export function uploadedSourceAnalysisMatchesActiveSet(input: {
  analysis: unknown;
  uploadedSourceIndex: UploadedSourceIndex;
}): boolean {
  if (!isRecord(input.analysis)) return false;
  const source = isRecord(input.analysis.source) ? input.analysis.source : null;
  const activeSources = Array.isArray(source?.active_uploaded_sources)
    ? source.active_uploaded_sources.filter(isRecord)
    : [];
  const activeMaterials = input.uploadedSourceIndex.materials.filter((item) => item.status === "active");
  if (activeSources.length !== activeMaterials.length) return false;
  const sourceById = new Map(activeSources.map((item) => [readString(item, "uploaded_source_id"), item]));
  return activeMaterials.every((material) => {
    const sourceMaterial = sourceById.get(material.uploaded_source_id);
    return sourceMaterial !== undefined &&
      readString(sourceMaterial, "sha256") === material.sha256 &&
      sourceMaterial.size_bytes === material.size_bytes;
  });
}

export function createUploadedSourceAnalysisDependency(
  analysis: UploadedSourceAnalysis,
): UploadedSourceAnalysisDependency {
  return {
    status: analysis.status,
    updated_at: analysis.updated_at,
    active_uploaded_sources: analysis.source.active_uploaded_sources.map((source) => ({
      uploaded_source_id: source.uploaded_source_id,
      sha256: source.sha256,
      size_bytes: source.size_bytes,
      file_path: source.file_path,
    })),
  };
}

export function compactUploadedSourceAnalysisForPrompt(
  analysis: UploadedSourceAnalysis | null,
): CompactUploadedSourceAnalysisContext | null {
  if (!analysis) return null;
  return {
    status: analysis.status,
    continuation_decision: analysis.continuation_decision,
    source_count: analysis.source.active_uploaded_sources.length,
    facts: analysis.facts.slice(0, 40).map((fact) => ({
      id: fact.id,
      claim: fact.claim,
      uploaded_source_id: fact.uploaded_source_id,
      ...(fact.source_label ? { source_label: fact.source_label } : {}),
      ...(fact.excerpt ? { excerpt: fact.excerpt } : {}),
      ...(fact.confidence ? { confidence: fact.confidence } : {}),
    })),
    visual_assets: analysis.visual_assets.slice(0, 30).map((asset) => ({
      id: asset.id,
      uploaded_source_id: asset.uploaded_source_id,
      use_constraint: asset.use_constraint,
      reason: asset.reason,
      visual_summary: asset.visual_summary,
    })),
    gaps: analysis.gaps.map((gap) => gap.reason).slice(0, 30),
    source_summaries: analysis.source_summaries.slice(0, 20),
    updated_at: analysis.updated_at,
  };
}

export function uploadedSourceDependencyMatchesAnalysis(input: {
  dependency: UploadedSourceAnalysisDependency | undefined;
  analysis: UploadedSourceAnalysis | null;
}): boolean {
  const { dependency, analysis } = input;
  if (!dependency || !analysis) return false;
  if (dependency.status !== analysis.status) return false;
  if (dependency.active_uploaded_sources.length !== analysis.source.active_uploaded_sources.length) return false;
  const dependencyById = new Map(dependency.active_uploaded_sources.map((source) => [source.uploaded_source_id, source]));
  return analysis.source.active_uploaded_sources.every((source) => {
    const item = dependencyById.get(source.uploaded_source_id);
    return item !== undefined &&
      item.sha256 === source.sha256 &&
      item.size_bytes === source.size_bytes;
  });
}
