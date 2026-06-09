import type { Messages } from "../../i18n/messages";
import type {
  DeckGenerationProgress,
  DeckGenerationProgressPage,
  DeckGenerationStep,
  DeckGenerationStream,
} from "../deck-generation";
import type { GenerationStreamSnapshot } from "./types";

type StageLabelKey =
  | "pagePlan"
  | "prepare"
  | "authoring"
  | "rendering"
  | "selfReview"
  | "renderFix"
  | "selfReviewFix"
  | "finalRender"
  | "accepted"
  | "failed"
  | "pending"
  | "unknown";

type PageStatusLabelKey =
  | "pending"
  | "authoring"
  | "rendering"
  | "selfReview"
  | "renderFixing"
  | "selfReviewFixing"
  | "accepted"
  | "renderFailed"
  | "agentFailed"
  | "needsUserReview"
  | "agentInfrastructureFailed"
  | "cancelled"
  | "unknown";

export type PageStageRecordState = "active" | "completed" | "failed" | "pending";

export interface PageGenerationStageRecord {
  id: string;
  stageKey: StageLabelKey;
  label: string;
  statusLabel: string;
  state: PageStageRecordState;
  lines: string[];
  activities: string[];
  hasStream: boolean;
  lastError?: string;
  updatedAt?: string;
}

export interface PageGenerationStageRecordGroup {
  pageId: string;
  pageIndex: number;
  title: string;
  pageStatus: string;
  pageStatusLabel: string;
  state: PageStageRecordState;
  lastError?: string;
  stages: PageGenerationStageRecord[];
}

export function buildPageGenerationStageRecords(input: {
  t: Messages;
  progress: DeckGenerationProgress | null;
  history: GenerationStreamSnapshot[];
}): PageGenerationStageRecordGroup[] {
  const { t, progress, history } = input;
  if (!progress) return [];

  const activeStreams = progress.activeStreams ?? (progress.stream ? [progress.stream] : []);
  const activeIds = new Set(activeStreams.map((stream) => buildActiveStageId(progress.step, stream)));
  const activeByPageId = groupBy(
    activeStreams.map((stream) => buildActiveStageRecord(t, progress.step, stream)),
    (record) => record.pageId,
  );
  const snapshotsByPageId = groupBy(
    history
      .filter((snapshot) => snapshot.page_id && !activeIds.has(snapshot.id))
      .map((snapshot) => buildSnapshotStageRecord(t, snapshot)),
    (record) => record.pageId,
  );

  return [...progress.pages]
    .sort((left, right) => left.index - right.index)
    .map((page) => {
      const activeRecords = activeByPageId.get(page.page_id)?.map(({ pageId: _pageId, ...record }) => record) ?? [];
      const snapshotRecords = snapshotsByPageId.get(page.page_id)?.map(({ pageId: _pageId, ...record }) => record) ?? [];
      const statusRecord = buildPageStatusStageRecord(t, page);
      const shouldIncludeStatusRecord =
        activeRecords.length === 0 ||
        statusRecord.state === "failed" ||
        statusRecord.stageKey === "rendering" ||
        statusRecord.stageKey === "accepted" ||
        statusRecord.stageKey === "pending";
      const stages = sortStageRecords([
        ...snapshotRecords,
        ...activeRecords,
        ...(shouldIncludeStatusRecord ? [statusRecord] : []),
      ]);

      return {
        pageId: page.page_id,
        pageIndex: page.index,
        title: page.title,
        pageStatus: page.status,
        pageStatusLabel: t.generating.stageRecords.pageStatuses[pageStatusLabelKey(page.status)],
        state: pageStatusState(page.status),
        lastError: page.last_error,
        stages,
      };
    });
}

function groupBy<T>(items: T[], keyFor: (item: T) => string | undefined) {
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    const key = keyFor(item);
    if (!key) return;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  });
  return groups;
}

function buildActiveStageId(step: DeckGenerationStep, stream: DeckGenerationStream) {
  return `${step}:${stream.page_id}:${stream.run_id ?? stream.kind ?? stream.status}`;
}

function buildActiveStageRecord(
  t: Messages,
  step: DeckGenerationStep,
  stream: DeckGenerationStream,
): PageGenerationStageRecord & { pageId: string } {
  const state = stream.status === "completed"
    ? "completed"
    : stream.status === "error"
      ? "failed"
      : "active";
  const stageKey = stageLabelKey(stream.kind, step);

  return {
    pageId: stream.page_id,
    id: buildActiveStageId(step, stream),
    stageKey,
    label: state === "active" && stream.status.trim()
      ? stream.status
      : t.generating.stageRecords.stages[stageKey],
    statusLabel: stateLabel(t, state),
    state,
    lines: [...stream.lines],
    activities: [...stream.activities],
    hasStream: true,
  };
}

function buildSnapshotStageRecord(
  t: Messages,
  snapshot: GenerationStreamSnapshot,
): PageGenerationStageRecord & { pageId: string | undefined } {
  const state = snapshot.status === "error" || snapshot.phase === "failed"
    ? "failed"
    : snapshot.status === "completed"
      ? "completed"
      : "completed";
  const stageKey = stageLabelKey(snapshot.kind, snapshot.phase);

  return {
    pageId: snapshot.page_id,
    id: snapshot.id,
    stageKey,
    label: t.generating.stageRecords.stages[stageKey],
    statusLabel: stateLabel(t, state),
    state,
    lines: [...snapshot.lines],
    activities: [...snapshot.activities],
    hasStream: snapshot.lines.some((line) => line.trim()) || snapshot.activities.length > 0,
    updatedAt: snapshot.updated_at,
  };
}

function buildPageStatusStageRecord(
  t: Messages,
  page: DeckGenerationProgressPage,
): PageGenerationStageRecord {
  const state = pageStatusState(page.status);
  const stageKey = stageLabelKey(undefined, undefined, page.status);
  const statusLabel = t.generating.stageRecords.pageStatuses[pageStatusLabelKey(page.status)];

  return {
    id: `status:${page.page_id}:${page.status}`,
    stageKey,
    label: statusLabel,
    statusLabel: stateLabel(t, state),
    state,
    lines: [],
    activities: [],
    hasStream: false,
    lastError: page.last_error,
  };
}

function sortStageRecords(records: PageGenerationStageRecord[]) {
  const order: StageLabelKey[] = [
    "pending",
    "authoring",
    "renderFix",
    "rendering",
    "selfReview",
    "selfReviewFix",
    "accepted",
    "failed",
  ];

  return [...records].sort((left, right) => {
    const leftIndex = order.indexOf(left.stageKey);
    const rightIndex = order.indexOf(right.stageKey);
    if (leftIndex === rightIndex) {
      return left.id.localeCompare(right.id);
    }
    return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex)
      - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
  });
}

function stageLabelKey(
  kind?: string,
  phase?: string,
  pageStatus?: string,
): StageLabelKey {
  if (kind === "authoring") return "authoring";
  if (kind === "render-fix") return "renderFix";
  if (kind === "self-review") return "selfReview";
  if (kind === "self-review-fix") return "selfReviewFix";

  if (phase === "page-plan") return "pagePlan";
  if (phase === "prepare") return "prepare";
  if (phase === "page-authoring") return "authoring";
  if (phase === "page-render") return "rendering";
  if (phase === "page-review") return "selfReview";
  if (phase === "final-render") return "finalRender";

  switch (pageStatus) {
    case "pending":
      return "pending";
    case "authoring":
      return "authoring";
    case "rendering":
      return "rendering";
    case "self_review":
      return "selfReview";
    case "render_fixing":
      return "renderFix";
    case "self_review_fixing":
      return "selfReviewFix";
    case "accepted":
      return "accepted";
    case "render_failed":
    case "agent_failed":
    case "needs_user_review":
    case "agent_infrastructure_failed":
      return "failed";
    default:
      return "unknown";
  }
}

function pageStatusLabelKey(status: string): PageStatusLabelKey {
  switch (status) {
    case "pending":
      return "pending";
    case "authoring":
      return "authoring";
    case "rendering":
      return "rendering";
    case "self_review":
      return "selfReview";
    case "render_fixing":
      return "renderFixing";
    case "self_review_fixing":
      return "selfReviewFixing";
    case "accepted":
      return "accepted";
    case "render_failed":
      return "renderFailed";
    case "agent_failed":
      return "agentFailed";
    case "needs_user_review":
      return "needsUserReview";
    case "agent_infrastructure_failed":
      return "agentInfrastructureFailed";
    case "cancelled":
      return "cancelled";
    default:
      return "unknown";
  }
}

function pageStatusState(status: string): PageStageRecordState {
  switch (status) {
    case "pending":
      return "pending";
    case "accepted":
      return "completed";
    case "render_failed":
    case "agent_failed":
    case "needs_user_review":
    case "agent_infrastructure_failed":
    case "cancelled":
      return "failed";
    default:
      return "active";
  }
}

function stateLabel(t: Messages, state: PageStageRecordState) {
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
