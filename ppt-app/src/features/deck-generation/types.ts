import type {
  AgentClient,
  AgentPageVisualReviewResult,
} from "../../agent/agentClient";
import type { AiClient } from "../../ai/aiClient";
import type { AiInteractionLogger } from "../../ai/interactionLog";
import type {
  PagePlanItem,
  PageProgress,
  ResearchDiscoveryProgress,
  ResearchDiscoveryProgressPhase,
  ResearchDiscoveryProgressPhaseRecord,
  ResearchDiscoveryProgressQuery,
  ResearchDiscoveryProgressSource,
  ResearchDiscoveryProgressState,
  ResearchDiscoveryProgressSummary,
  ResearchDiscoveryProgressVisualAsset,
  RenderDeckHtmlResult,
  WorkspaceOutline,
  WorkspaceResult,
} from "../../api/types";
import type { PptBackend } from "../../api/pptBackend";
import type { Locale } from "../../i18n/messages";
import type { AppHostUploadClient } from "../../runtime/appHostUploadClient";

export const ATTEMPT_LIMITS = {
  render: 10,
  visualReview: 5,
  agent: 5,
};

export const LOCAL_GATE_REPAIR_LIMIT = 3;

export type RenderFailurePhase = "pre-render-typecheck" | "render";

export interface RenderFailureHistoryItem {
  attempt: number;
  phase: RenderFailurePhase;
  error: string;
  timestamp: string;
}

export interface NoChangeAuthoringRetry {
  retryCount: number;
  previousSummary: string;
  previousChangedFiles: string[];
}

export type DeckGenerationStep =
  | "authoring-kit"
  | "style-guide"
  | "page-sources"
  | "page-plan"
  | "research-planning"
  | "research-discovery"
  | "research-collection"
  | "research-curation"
  | "evidence-page-planning"
  | "prepare"
  | "page-authoring"
  | "page-render"
  | "page-visual-review"
  | "final-render"
  | "complete"
  | "interrupted"
  | "cancelled"
  | "failed";

export type DeckGenerationStartMode = "new" | "resume";

export interface DeckGenerationProgressPage {
  page_id: string;
  index: number;
  title: string;
  status: string;
  render_attempts: number;
  render_attempt_limit: number;
  visual_review_attempts: number;
  visual_review_attempt_limit: number;
  agent_failures: number;
  agent_failure_limit: number;
  agent_infrastructure_failures: number;
  last_error?: string;
  last_screenshot_path?: string;
}

export interface DeckGenerationStream {
  run_id?: string;
  kind?: string;
  page_id: string;
  page_index: number;
  status: string;
  lines: string[];
  activities: string[];
  started_at?: string;
  updated_at?: string;
}

export type {
  ResearchDiscoveryProgress,
  ResearchDiscoveryProgressPhase,
  ResearchDiscoveryProgressPhaseRecord,
  ResearchDiscoveryProgressQuery,
  ResearchDiscoveryProgressSource,
  ResearchDiscoveryProgressState,
  ResearchDiscoveryProgressSummary,
  ResearchDiscoveryProgressVisualAsset,
};

export interface DeckGenerationProgress {
  step: DeckGenerationStep;
  message: string;
  currentPageIndex: number | null;
  totalPages: number;
  pages: DeckGenerationProgressPage[];
  recoveryRunKind?: NonNullable<PageProgress["recovery"]>["run_kind"];
  stream?: DeckGenerationStream;
  activeStreams?: DeckGenerationStream[];
  researchDiscovery?: ResearchDiscoveryProgress;
}

export interface DeckGenerationStreamSnapshot {
  id: string;
  phase: string;
  kind?: string;
  label: string;
  page_id?: string;
  page_index?: number;
  status: string;
  message: string;
  lines: string[];
  activities: string[];
  updated_at: string;
}

export interface DeckGenerationResult {
  outline: WorkspaceOutline;
  authoringDeck: AuthoringDeck;
  progress: PageProgress;
  rendered: RenderDeckHtmlResult;
}

export interface AuthoringPage {
  page_id: string;
  index: number;
  title: string;
  outline: string;
  slide_path: string;
}

export interface AuthoringDeck {
  title: string;
  pages: AuthoringPage[];
}

export interface DeckGenerationError {
  type:
    | "page_failed"
    | "agent_infrastructure"
    | "final_render_failed"
    | "stale_artifacts"
    | "cancelled"
    | "invalid_confirmed_outline";
  message: string;
  page_id?: string;
  page_index?: number;
  page_status?: string;
}

export type DeckGenerationCompletion =
  | { status: "completed"; result: DeckGenerationResult }
  | { status: "cancelled"; progress: DeckGenerationProgress | null }
  | {
      status: "failed";
      error: DeckGenerationError;
      progress: DeckGenerationProgress | null;
    };

export interface PageRefinementVisualContext {
  screenshotPath?: string;
  source: "progress" | "fresh-render" | "unavailable";
  unavailableReason?: string;
}

export interface RunDeckGenerationInput {
  backend: PptBackend;
  aiClient: AiClient;
  agentClient: AgentClient;
  hostUploadClient?: AppHostUploadClient | null;
  aiLogger?: AiInteractionLogger | null;
  workspace: WorkspaceResult;
  confirmedOutline: WorkspaceOutline;
  locale: Locale;
  startMode?: DeckGenerationStartMode;
  onProgress: (progress: DeckGenerationProgress) => void;
  isCancelled: () => boolean;
  cancelSignal?: AbortSignal;
  pageRefinementRequests?: Record<string, string>;
  pageRefinementVisualContexts?: Record<string, PageRefinementVisualContext>;
  refinementRunKind?: "page-refinement" | "deck-refinement";
  selectedStyleProfile?: {
    displayName?: string;
    profilePath: string;
    content: string;
  } | null;
}

export interface RunDeckRefinementInput extends RunDeckGenerationInput {
  instruction: string;
  scope: "deck" | "slide";
  pageIndex?: number;
  resumePageIds?: string[];
  skipIntentReview?: boolean;
}

export interface RunPageGenerationRetryInput extends RunDeckGenerationInput {
  pageId: string;
}

export type DeckGenerationContext = Omit<RunDeckGenerationInput, "startMode">;
export type PageTerminalReason = "accepted" | "page_failed" | "agent_infrastructure" | "cancelled";

export interface PageGenerationResult {
  page: AuthoringPage;
  reason: PageTerminalReason;
  progress: PageProgress;
  error?: DeckGenerationError;
}

export interface DeckGenerationRuntime extends DeckGenerationContext {
  activeStreams: Map<string, DeckGenerationStream>;
  researchDiscoveryProgress?: ResearchDiscoveryProgress;
  getProgress: () => PageProgress | null;
  setProgress: (progress: PageProgress) => void;
}

export interface StoredPageReviews {
  visualReview: AgentPageVisualReviewResult | null;
}
