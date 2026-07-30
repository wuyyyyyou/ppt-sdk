import type {
  AppSharedResearchProgressOperation,
  AppSharedResearchStage,
  AppSharedResearchStageState,
} from "./types.js";

const STAGES: AppSharedResearchStage[] = [
  "web_decision",
  "web_research",
  "image_decision",
  "image_research",
  "image_search",
  "image_deduplication",
  "image_prefetch",
  "image_analysis",
  "image_import",
];

const TERMINAL_STATES = new Set<AppSharedResearchStageState>(["completed", "warning", "skipped"]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

const OPERATION_FIELDS: Record<string, string[]> = {
  set_stage: ["op", "stage", "state"],
  set_web_decision: ["op", "decision"],
  upsert_web_search: ["op", "query", "search"],
  set_web_fetch_result_ids: ["op", "result_ids"],
  upsert_web_fetched_page: ["op", "url", "page"],
  set_web_prepared_batch: ["op", "markdown"],
  set_web_diagnostics: ["op", "gaps", "diagnostic_errors"],
  set_image_decision: ["op", "decision"],
  upsert_image_search: ["op", "query", "search"],
  set_image_work_status: ["op", "field", "state"],
  upsert_image_deduplication_entry: ["op", "candidate_id", "group", "candidate"],
  set_image_deduplication_summary: ["op", "strategy", "statistics"],
  upsert_image_analysis_batch: ["op", "batch_id", "batch", "candidates"],
  upsert_image_candidate: ["op", "candidate_id", "candidate"],
  set_image_diagnostics: ["op", "gaps", "diagnostic_errors"],
  set_image_content_deduplication: ["op", "value"],
  finalize_image_research: ["op", "title", "status", "queries", "gaps", "statistics"],
  finalize_shared_research: ["op"],
};

function assertOperationShape(value: unknown): asserts value is AppSharedResearchProgressOperation {
  const operation = record(value);
  const op = operation.op;
  if (typeof op !== "string" || !OPERATION_FIELDS[op]) throw new Error(`Unsupported shared research progress operation: ${String(op)}`);
  const fields = new Set(OPERATION_FIELDS[op]);
  for (const key of Object.keys(operation)) if (!fields.has(key)) throw new Error(`Unknown field for ${op}: ${key}`);
  for (const key of fields) if (!(key in operation)) throw new Error(`Missing field for ${op}: ${key}`);
  if (["query", "url", "candidate_id", "batch_id", "title", "markdown"].some((key) => key in operation && typeof operation[key] !== "string")) {
    throw new Error(`Invalid string field for ${op}`);
  }
  for (const key of ["decision", "search", "page", "group", "candidate", "strategy", "statistics", "batch", "value"]) {
    if (key in operation && (operation[key] === null || typeof operation[key] !== "object" || Array.isArray(operation[key]))) throw new Error(`Invalid object field for ${op}: ${key}`);
  }
  for (const key of ["result_ids", "gaps", "diagnostic_errors", "queries"]) {
    if (key in operation && !Array.isArray(operation[key])) throw new Error(`Invalid array field for ${op}: ${key}`);
  }
  for (const key of ["result_ids", "gaps", "diagnostic_errors"]) {
    if (key in operation && (operation[key] as unknown[]).some((item) => typeof item !== "string")) throw new Error(`Invalid string array for ${op}: ${key}`);
  }
  if (op === "upsert_image_analysis_batch" && (!Array.isArray(operation.candidates) || operation.candidates.some((item) => !item || typeof item !== "object" || typeof item.candidate_id !== "string" || !item.candidate || typeof item.candidate !== "object" || Array.isArray(item.candidate)))) {
    throw new Error("Invalid analysis batch candidates");
  }
  if (op === "set_stage" && (!STAGES.includes(operation.stage as AppSharedResearchStage) || !["waiting", "running", "completed", "warning", "skipped"].includes(String(operation.state)))) throw new Error("Invalid set_stage operation");
  if (op === "set_image_work_status" && (!["search_status", "prefetch_status", "analysis_status", "import_status"].includes(String(operation.field)) || !["waiting", "running", "completed", "warning"].includes(String(operation.state)))) throw new Error("Invalid image work status operation");
  if (op === "finalize_image_research" && !["completed", "warning", "skipped"].includes(String(operation.status))) throw new Error("Invalid image research final status");
}

function upsertByKey(items: unknown, key: string, expected: string, value: Record<string, unknown>) {
  const current = Array.isArray(items) ? items.map((item) => record(item)) : [];
  const index = current.findIndex((item) => item[key] === expected);
  if (index >= 0) current[index] = value;
  else current.push(value);
  return current;
}

function assertCheckpoint(progress: Record<string, unknown>) {
  if (progress.schema_version !== 2) throw new Error("Invalid shared research progress schema_version");
  if (progress.revision !== undefined && (!Number.isInteger(progress.revision) || Number(progress.revision) < 0)) {
    throw new Error("Invalid shared research progress revision");
  }
  const stages = record(progress.stages);
  for (const stage of STAGES) {
    const state = stages[stage];
    if (stage === "image_prefetch" && state === undefined) continue;
    if (!["waiting", "running", "completed", "warning", "skipped"].includes(String(state))) {
      throw new Error(`Invalid shared research stage: ${stage}`);
    }
  }
}

function assertTransition(previous: AppSharedResearchStageState, next: AppSharedResearchStageState) {
  if (previous === next) return;
  if (previous === "waiting" && (next === "running" || next === "skipped")) return;
  if (previous === "running" && TERMINAL_STATES.has(next)) return;
  throw new Error(`Invalid shared research stage transition: ${previous} -> ${next}`);
}

function assertStageCompletion(progress: Record<string, unknown>, stage: AppSharedResearchStage, state: AppSharedResearchStageState) {
  if (!TERMINAL_STATES.has(state) || state === "skipped") return;
  const web = record(progress.web);
  const image = record(progress.image);
  if (stage === "image_search") {
    const queries = strings(record(image.decision).queries);
    const searches = Array.isArray(image.searches) ? image.searches.map(record) : [];
    if (queries.some((query) => !searches.some((search) => search.query === query && search.status !== "running"))) {
      throw new Error("Image search cannot complete before every query has a terminal search record");
    }
  }
  if (stage === "image_deduplication") {
    const deduplication = record(image.deduplication);
    const groups = Array.isArray(deduplication.groups) ? deduplication.groups.map(record) : [];
    const candidates = Array.isArray(image.candidates) ? image.candidates.map(record) : [];
    const occurrences = (Array.isArray(image.searches) ? image.searches : [])
      .flatMap((search) => Array.isArray(record(search).result) ? record(search).result as unknown[] : [])
      .map((item) => String(record(item).occurrence_id ?? ""))
      .filter(Boolean);
    const mapped = new Set(groups.flatMap((group) => strings(group.occurrence_ids)));
    if (occurrences.some((id) => !mapped.has(id))) throw new Error("Image deduplication is missing occurrences");
    if (groups.some((group) => !candidates.some((candidate) => candidate.candidate_id === group.candidate_id))) {
      throw new Error("Image deduplication group is missing its candidate");
    }
  }
  if (stage === "image_prefetch") {
    const candidates = Array.isArray(image.candidates) ? image.candidates.map(record) : [];
    if (candidates.some((candidate) => !["completed", "failed"].includes(String(candidate.prefetch_status)))) {
      throw new Error("Image prefetch has unfinished candidates");
    }
    if (state === "completed" && candidates.some((candidate) => candidate.prefetch_status === "failed")) {
      throw new Error("Completed image prefetch cannot contain failed candidates");
    }
  }
  if (stage === "image_analysis" && state === "completed") {
    const batches = Array.isArray(image.analysis_batches) ? image.analysis_batches.map(record) : [];
    if (batches.some((batch) => batch.status !== "completed")) throw new Error("Image analysis has unfinished batches");
    const candidates = Array.isArray(image.candidates) ? image.candidates.map(record) : [];
    const candidateById = new Map(candidates.map((candidate) => [candidate.candidate_id, candidate]));
    const incomplete = batches.flatMap((batch) => strings(batch.candidate_ids)).some((candidateId) => {
      const candidate = candidateById.get(candidateId);
      return !candidate || typeof candidate.use_in_ppt !== "boolean";
    });
    if (incomplete) throw new Error("Image analysis is missing candidate decisions");
  }
  if (stage === "image_import" && state === "completed") {
    const candidates = Array.isArray(image.candidates) ? image.candidates.map(record) : [];
    if (candidates.some((candidate) => candidate.use_in_ppt === true && candidate.download_status !== "imported")) {
      throw new Error("Selected image candidates have not all been imported");
    }
  }
  if (stage === "web_research" && !web.prepared_batch) throw new Error("Web research batch is not prepared");
}

function stripLifecycleTimes(value: Record<string, unknown>) {
  const copy = { ...value };
  delete copy.started_at;
  delete copy.completed_at;
  delete copy.updated_at;
  return copy;
}

export function createDefaultSharedResearchProgress(now = new Date().toISOString()) {
  return {
    schema_version: 2,
    revision: 0,
    status: "waiting",
    stages: Object.fromEntries(STAGES.map((stage) => [stage, "waiting"])),
    updated_at: now,
  };
}

export function applySharedResearchProgressOperations(
  currentValue: Record<string, unknown>,
  operations: AppSharedResearchProgressOperation[],
  now = new Date().toISOString(),
) {
  assertCheckpoint(currentValue);
  const previousRevision = typeof currentValue.revision === "number" ? currentValue.revision : 0;
  const next: Record<string, unknown> = clone({ ...currentValue, revision: previousRevision });
  const nextStages = record(next.stages);
  nextStages.image_prefetch ??= "waiting";
  next.stages = nextStages;

  for (const operation of operations) {
    assertOperationShape(operation);
    const operationName = (operation as { op?: unknown }).op;
    if (operation.op === "set_stage") {
      const stages = record(next.stages);
      const previous = String(stages[operation.stage]) as AppSharedResearchStageState;
      assertTransition(previous, operation.state);
      assertStageCompletion(next, operation.stage, operation.state);
      stages[operation.stage] = operation.state;
      next.stages = stages;
      if (operation.state === "running" && next.status === "waiting") next.status = "running";
      continue;
    }
    if (operation.op === "set_web_decision") {
      next.web = { ...record(next.web), decision: clone(operation.decision) };
      continue;
    }
    if (operation.op === "upsert_web_search") {
      next.web = { ...record(next.web), searches: upsertByKey(record(next.web).searches, "query", operation.query, { ...clone(operation.search), query: operation.query }) };
      continue;
    }
    if (operation.op === "set_web_fetch_result_ids") {
      next.web = { ...record(next.web), fetch_result_ids: [...operation.result_ids] };
      continue;
    }
    if (operation.op === "upsert_web_fetched_page") {
      next.web = { ...record(next.web), fetched_pages: upsertByKey(record(next.web).fetched_pages, "url", operation.url, { ...clone(operation.page), url: operation.url }) };
      continue;
    }
    if (operation.op === "set_web_prepared_batch") {
      const web = record(next.web);
      next.web = {
        ...web,
        prepared_batch: operation.markdown,
        written: web.prepared_batch === operation.markdown ? web.written : false,
      };
      continue;
    }
    if (operation.op === "set_web_diagnostics") {
      next.web = { ...record(next.web), gaps: [...operation.gaps], diagnostic_errors: [...operation.diagnostic_errors] };
      continue;
    }
    if (operation.op === "set_image_decision") {
      next.image = { ...record(next.image), decision: clone(operation.decision) };
      continue;
    }
    if (operation.op === "upsert_image_search") {
      next.image = { ...record(next.image), searches: upsertByKey(record(next.image).searches, "query", operation.query, { ...clone(operation.search), query: operation.query }) };
      continue;
    }
    if (operation.op === "set_image_work_status") {
      next.image = { ...record(next.image), [operation.field]: operation.state };
      continue;
    }
    if (operation.op === "upsert_image_deduplication_entry") {
      const image = record(next.image);
      const deduplication = record(image.deduplication);
      next.image = {
        ...image,
        deduplication: { ...deduplication, status: "running", groups: upsertByKey(deduplication.groups, "candidate_id", operation.candidate_id, { ...clone(operation.group), candidate_id: operation.candidate_id }) },
        candidates: upsertByKey(image.candidates, "candidate_id", operation.candidate_id, { ...clone(operation.candidate), candidate_id: operation.candidate_id }),
      };
      continue;
    }
    if (operation.op === "set_image_deduplication_summary") {
      const image = record(next.image);
      next.image = { ...image, deduplication: { ...record(image.deduplication), status: "completed", strategy: clone(operation.strategy), statistics: clone(operation.statistics), completed_at: record(image.deduplication).completed_at ?? now } };
      continue;
    }
    if (operation.op === "upsert_image_analysis_batch") {
      const image = record(next.image);
      const previous = (Array.isArray(image.analysis_batches) ? image.analysis_batches.map(record) : []).find((batch) => batch.batch_id === operation.batch_id);
      const batch = stripLifecycleTimes(clone(operation.batch));
      if (batch.status === "running") batch.started_at = previous?.started_at ?? now;
      if (batch.status === "completed" || batch.status === "failed") {
        batch.started_at = previous?.started_at ?? now;
        batch.completed_at = previous?.completed_at ?? now;
      }
      let candidates = image.candidates;
      for (const candidate of operation.candidates) {
        candidates = upsertByKey(candidates, "candidate_id", candidate.candidate_id, { ...clone(candidate.candidate), candidate_id: candidate.candidate_id });
      }
      next.image = { ...image, analysis_batches: upsertByKey(image.analysis_batches, "batch_id", operation.batch_id, { ...batch, batch_id: operation.batch_id }), candidates };
      continue;
    }
    if (operation.op === "upsert_image_candidate") {
      const image = record(next.image);
      next.image = { ...image, candidates: upsertByKey(image.candidates, "candidate_id", operation.candidate_id, { ...stripLifecycleTimes(clone(operation.candidate)), candidate_id: operation.candidate_id }) };
      continue;
    }
    if (operation.op === "set_image_diagnostics") {
      next.image = { ...record(next.image), gaps: [...operation.gaps], diagnostic_errors: [...operation.diagnostic_errors] };
      continue;
    }
    if (operation.op === "set_image_content_deduplication") {
      const image = record(next.image);
      next.image = { ...image, content_deduplication: { ...stripLifecycleTimes(clone(operation.value)), completed_at: record(image.content_deduplication).completed_at ?? now } };
      continue;
    }
    if (operation.op === "finalize_image_research") {
      const image = record(next.image);
      const candidates = Array.isArray(image.candidates) ? image.candidates.map(record) : [];
      const preparedBatch = {
        title: operation.title,
        status: operation.status,
        queries: clone(operation.queries),
        candidates: clone(candidates),
        gaps: [...operation.gaps],
        statistics: clone(operation.statistics),
      };
      next.image = {
        ...image,
        prepared_batch: preparedBatch,
        written: JSON.stringify(image.prepared_batch) === JSON.stringify(preparedBatch) ? image.written : false,
      };
      continue;
    }
    if (operation.op === "finalize_shared_research") {
      const stages = Object.values(record(next.stages));
      if (stages.some((state) => state === "waiting" || state === "running")) throw new Error("Shared research still has unfinished stages");
      const web = record(next.web);
      const image = record(next.image);
      if (web.prepared_batch && web.written !== true) throw new Error("Prepared web research has not been published");
      if (image.prepared_batch && image.written !== true) throw new Error("Prepared image research has not been published");
      const noNewResearch = record(web.decision).needs_search !== true && record(image.decision).needs_search !== true;
      next.status = stages.includes("warning") ? "warning" : noNewResearch ? "skipped" : "completed";
      continue;
    }
    throw new Error(`Unsupported shared research progress operation: ${String(operationName)}`);
  }

  const comparableCurrent: Record<string, unknown> = clone(currentValue);
  const comparableNext: Record<string, unknown> = clone(next);
  delete comparableCurrent.revision;
  delete comparableCurrent.updated_at;
  delete comparableNext.revision;
  delete comparableNext.updated_at;
  const updated = JSON.stringify(comparableCurrent) !== JSON.stringify(comparableNext);
  if (updated) {
    next.revision = previousRevision + 1;
    next.updated_at = now;
  } else {
    next.revision = previousRevision;
    next.updated_at = typeof currentValue.updated_at === "string" ? currentValue.updated_at : now;
  }
  return { progress: next, updated, revision: Number(next.revision), updated_at: String(next.updated_at) };
}
