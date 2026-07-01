import type { Messages } from "../../i18n/messages";
import type {
  DeckGenerationProgress,
  DeckGenerationStream,
  ResearchDiscoveryProgressPhase,
  ResearchDiscoveryProgressPhaseRecord,
  ResearchDiscoveryProgressState,
  ResearchDiscoveryProgressSummary,
} from "../deck-generation";
import type { PageStageRecordState } from "./generationStageRecords";

export interface ResearchDiscoveryStageRecord {
  id: string;
  phase: ResearchDiscoveryProgressPhase;
  label: string;
  statusLabel: string;
  state: PageStageRecordState;
  rationale?: string;
  queryLines: string[];
  sourceLines: string[];
  activities: string[];
  lines: string[];
  gaps: string[];
  rejectedReasons: string[];
  summaryLines: string[];
}

export interface ResearchDiscoveryStageGroup {
  title: string;
  statusLabel: string;
  state: PageStageRecordState;
  summaryLines: string[];
  records: ResearchDiscoveryStageRecord[];
}

export function buildResearchDiscoveryStageRecords(input: {
  t: Messages;
  progress: DeckGenerationProgress | null;
}): ResearchDiscoveryStageGroup | null {
  const { t, progress } = input;
  if (!progress?.researchDiscovery) return null;
  const activeDiscoveryStreams = (progress.activeStreams ?? [])
    .filter(isDiscoveryStream);
  const streamByKind = new Map(activeDiscoveryStreams.map((stream) => [stream.kind, stream]));

  const records = progress.researchDiscovery.records.map((record) =>
    buildRecord(t, mergeActiveStream(record, streamByKind))
  );
  const state = groupDisplayState(progress.researchDiscovery.records, progress.researchDiscovery.status);
  return {
    title: t.generating.researchDiscovery.title,
    statusLabel: stateLabel(t, state),
    state,
    summaryLines: [],
    records,
  };
}

export function isDiscoveryStream(stream: Pick<DeckGenerationStream, "page_id" | "kind">) {
  return stream.page_id.startsWith("discovery-") && (
    stream.kind === "web-research-curation" ||
    stream.kind === "visual-research-curation"
  );
}

export function isDiscoveryPageId(pageId: string) {
  return pageId.startsWith("discovery-");
}

function mergeActiveStream(
  record: ResearchDiscoveryProgressPhaseRecord,
  streamByKind: Map<string | undefined, DeckGenerationStream>,
): ResearchDiscoveryProgressPhaseRecord {
  const stream = record.phase === "web-curation"
    ? streamByKind.get("web-research-curation")
    : record.phase === "visual-curation"
      ? streamByKind.get("visual-research-curation")
      : undefined;
  if (!stream) return record;
  return {
    ...record,
    state: stream.status === "error" ? "failed" : stream.status === "completed" ? "completed" : "active",
    activities: stream.activities,
    lines: stream.lines,
  };
}

function groupDisplayState(
  records: ResearchDiscoveryProgressPhaseRecord[],
  status: ResearchDiscoveryProgressState,
): ResearchDiscoveryStageGroup["state"] {
  if (records.some((record) => record.state === "failed")) return "failed";
  if (records.some((record) => record.state === "active")) return "active";
  const hasStarted = records.some((record) => record.state === "completed" || record.state === "warning");
  const allTerminal = records.length > 0 && records.every((record) =>
    record.state === "completed" || record.state === "warning"
  );
  if (!allTerminal && hasStarted) return "active";
  if (allTerminal) return "completed";
  return normalizeState(status);
}

function buildRecord(
  t: Messages,
  record: ResearchDiscoveryProgressPhaseRecord,
): ResearchDiscoveryStageRecord {
  const state = normalizeState(record.state);
  return {
    id: `research-discovery:${record.phase}`,
    phase: record.phase,
    label: t.generating.researchDiscovery.phases[record.phase],
    statusLabel: stateLabel(t, state),
    state,
    rationale: record.rationale,
    queryLines: queryLines(t, record),
    sourceLines: sourceLines(t, record),
    activities: record.activities ?? [],
    lines: record.lines ?? [],
    gaps: record.gaps ?? [],
    rejectedReasons: record.rejectedReasons ?? [],
    summaryLines: countLines(t, record.counts),
  };
}

function queryLines(t: Messages, record: ResearchDiscoveryProgressPhaseRecord) {
  return (record.queries ?? []).map((query) => {
    const counts = [
      typeof query.resultCount === "number"
        ? t.generating.researchDiscovery.resultCount.replace("{count}", String(query.resultCount))
        : "",
      typeof query.fetchCount === "number"
        ? t.generating.researchDiscovery.fetchCount.replace("{count}", String(query.fetchCount))
        : "",
      typeof query.downloadCount === "number"
        ? t.generating.researchDiscovery.downloadCount.replace("{count}", String(query.downloadCount))
        : "",
    ].filter(Boolean).join(" · ");
    const status = t.generating.researchDiscovery.queryStatuses[query.status];
    const message = query.message ? ` · ${query.message}` : "";
    return counts
      ? `${status}: ${query.query} (${counts})${message}`
      : `${status}: ${query.query}${message}`;
  });
}

function sourceLines(t: Messages, record: ResearchDiscoveryProgressPhaseRecord) {
  const sources = [
    ...(record.sources ?? []),
    ...(record.queries ?? []).flatMap((query) => query.sources ?? []),
  ];
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const source of sources) {
    const title = source.title || t.generating.researchDiscovery.untitledSource;
    const url = source.url ?? "";
    const key = `${title}\n${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(url ? `${title} · ${url}` : title);
    if (lines.length >= 8) break;
  }
  return lines;
}

function countLines(
  t: Messages,
  counts: Partial<ResearchDiscoveryProgressSummary> | undefined,
) {
  if (!counts) return [];
  const labels = t.generating.researchDiscovery.counts;
  return [
    typeof counts.facts === "number" ? `${labels.facts}: ${counts.facts}` : "",
    typeof counts.derivedInsights === "number" ? `${labels.derivedInsights}: ${counts.derivedInsights}` : "",
    typeof counts.visualAssets === "number" ? `${labels.visualAssets}: ${counts.visualAssets}` : "",
    typeof counts.gaps === "number" ? `${labels.gaps}: ${counts.gaps}` : "",
    typeof counts.rejectedMaterial === "number" ? `${labels.rejectedMaterial}: ${counts.rejectedMaterial}` : "",
  ].filter(Boolean);
}

function normalizeState(state: ResearchDiscoveryProgressState): ResearchDiscoveryStageRecord["state"] {
  if (state === "warning") return "completed";
  if (state === "failed") return "failed";
  if (state === "active") return "active";
  if (state === "completed") return "completed";
  return "pending";
}

function stateLabel(
  t: Messages,
  state: ResearchDiscoveryStageRecord["state"],
) {
  switch (state) {
    case "active":
      return t.generating.stageRecords.running;
    case "completed":
      return t.generating.stageRecords.completed;
    case "failed":
      return t.generating.stageRecords.failed;
    case "pending":
      return t.generating.stageRecords.pending;
  }
}
