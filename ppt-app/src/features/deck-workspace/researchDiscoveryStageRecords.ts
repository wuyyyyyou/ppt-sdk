import type { Messages } from "../../i18n/messages";
import type {
  DeckGenerationProgress,
  DeckGenerationStream,
  ResearchDiscoveryProgressPhase,
  ResearchDiscoveryProgressState,
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
      queryLines: [],
      sourceLines: [],
      activities: record.activities ?? [],
      lines: record.lines ?? [],
      gaps: record.gaps ?? [],
      rejectedReasons: [],
      summaryLines: [],
    })),
  };
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
