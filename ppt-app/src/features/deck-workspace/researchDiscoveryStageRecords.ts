import { formatMessage, type Messages } from "../../i18n/messages";
import type {
  DeckGenerationProgress,
  DeckGenerationStream,
  ResearchDiscoveryProgressActivity,
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
  const research = input.progress?.researchDiscovery;
  if (!research) return null;
  return {
    title: input.t.generating.researchDiscovery.title,
    statusLabel: input.t.generating.researchDiscovery.statuses[research.status],
    state: displayState(research.status),
    summaryLines: [],
    records: research.records.map((record) => ({
      id: `research-discovery:${record.phase}`,
      phase: record.phase,
      label: input.t.generating.researchDiscovery.phases[record.phase],
      statusLabel: input.t.generating.researchDiscovery.statuses[record.state],
      state: displayState(record.state),
      rationale: record.rationale,
      queryLines: queryLines(input.t, record),
      sourceLines: sourceLines(input.t, record),
      activities: [formatActivity(input.t, record.activity), ...(record.activities ?? [])].filter((value): value is string => Boolean(value)),
      lines: record.lines ?? [],
      gaps: record.gaps ?? [],
      rejectedReasons: record.rejectedReasons ?? [],
      summaryLines: countLines(input.t, record.counts),
    })),
  };
}

function queryLines(t: Messages, record: ResearchDiscoveryProgressPhaseRecord) {
  return (record.queries ?? []).map((query) => {
    const counts = [
      typeof query.resultCount === "number"
        ? formatMessage(t.generating.researchDiscovery.resultCount, { count: query.resultCount })
        : "",
      typeof query.fetchCount === "number"
        ? formatMessage(t.generating.researchDiscovery.fetchCount, { count: query.fetchCount })
        : "",
      typeof query.downloadCount === "number"
        ? formatMessage(t.generating.researchDiscovery.downloadCount, { count: query.downloadCount })
        : "",
    ].filter(Boolean).join(" · ");
    const status = t.generating.researchDiscovery.queryStatuses[query.status];
    return counts ? `${status}: ${query.query} (${counts})` : `${status}: ${query.query}`;
  });
}

function sourceLines(t: Messages, record: ResearchDiscoveryProgressPhaseRecord) {
  const sources = [...(record.sources ?? []), ...(record.queries ?? []).flatMap((query) => query.sources ?? [])];
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const source of sources) {
    const title = source.title?.trim();
    const label = title && !/^https?:\/\//i.test(title)
      ? title
      : sourceHostname(title || source.url) || t.generating.researchDiscovery.untitledSource;
    if (seen.has(label)) continue;
    seen.add(label);
    lines.push(label);
    if (lines.length >= 8) break;
  }
  return lines;
}

function sourceHostname(url: string | undefined) {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function countLines(t: Messages, counts: Partial<ResearchDiscoveryProgressSummary> | undefined) {
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

function formatActivity(t: Messages, activity: ResearchDiscoveryProgressActivity | undefined) {
  if (!activity) return "";
  const templates = t.generating.researchDiscovery.activities;
  const keyByKind: Record<ResearchDiscoveryProgressActivity["kind"], keyof typeof templates> = {
    "web-decision": "webDecision",
    "web-search": "webSearch",
    "web-fetch-selection": "webFetchSelection",
    "web-fetch": "webFetch",
    "web-synthesis": "webSynthesis",
    "web-publish": "webPublish",
    "web-complete": "webComplete",
    "web-skipped": "webSkipped",
    "image-decision": "imageDecision",
    "image-search": "imageSearch",
    "image-deduplication": "imageDeduplication",
    "image-download": "imageDownload",
    "image-prepare": "imagePrepare",
    "image-analysis": "imageAnalysis",
    "image-import": "imageImport",
    "image-publish": "imagePublish",
    "image-complete": "imageComplete",
    "image-skipped": "imageSkipped",
  };
  return formatMessage(templates[keyByKind[activity.kind]], {
    completed: activity.completed ?? 0,
    total: activity.total ?? 0,
    count: activity.count ?? 0,
    selected: activity.selected ?? 0,
    failed: activity.failed ?? 0,
  });
}

export function isDiscoveryStream(_stream: Pick<DeckGenerationStream, "page_id" | "kind">) {
  return false;
}

export function isDiscoveryPageId(pageId: string) {
  return pageId.startsWith("discovery-");
}

function displayState(state: ResearchDiscoveryProgressState): PageStageRecordState {
  if (state === "running") return "active";
  if (state === "waiting") return "pending";
  return "completed";
}
