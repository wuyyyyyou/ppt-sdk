import type { OutlineDetail, Slide } from "../data/mockDeck";
import type { AnnaLlmCompleteInput } from "../runtime/annaRuntime";
import type { WorkspaceSettings } from "../api/types";
import type {
  PagePlan,
  PagePlanItem,
  ResearchDiscoveryDecision,
  ResearchDiscoveryEvidencePool,
  ResearchEvidenceIndex,
  ResearchRequirement,
  TemplatePlanningContext,
  WorkspaceOutlineItem,
  WorkspaceOutline,
} from "../api/types";
import type { Locale } from "../i18n/messages";
import type { AiOperationLogContext } from "./interactionLog";

export interface LlmContextRow {
  id: string;
  value: string;
}

export interface DeckBriefInput {
  prompt: string;
  contextRows: LlmContextRow[];
  locale: Locale;
  setting?: WorkspaceSettings;
  logContext?: AiOperationLogContext;
}

export interface GenerateOutlineInput extends DeckBriefInput {
  uploadedSourceAnalysisContext?: unknown;
}

export interface GenerateDeckInput extends DeckBriefInput {
  outlineFirst: boolean;
}

export interface SuggestContextInput {
  prompt: string;
  locale: Locale;
  logContext?: AiOperationLogContext;
}

export interface ContextSuggestionResult {
  audience: string[];
  goal: string[];
  style: string[];
  theme: string[];
  slides: string;
}

export interface ReviseOutlineInput {
  title?: string;
  outline: OutlineDetail[];
  feedback: string;
  locale: Locale;
  setting?: WorkspaceSettings;
  contextRows?: LlmContextRow[];
  uploadedSourceAnalysisContext?: unknown;
  logContext?: AiOperationLogContext;
}

export interface GenerateSlidesFromOutlineInput {
  outline: OutlineDetail[];
  locale: Locale;
  logContext?: AiOperationLogContext;
}

export interface RefineDeckInput {
  slides: Slide[];
  locale: Locale;
  logContext?: AiOperationLogContext;
}

export interface RefineSlideInput {
  slide: Slide;
  slideIndex: number;
  locale: Locale;
  logContext?: AiOperationLogContext;
}

export interface GeneratedDeck {
  title: string;
  outline: OutlineDetail[];
  slides: Slide[];
}

export interface GeneratedOutline {
  title: string;
  output_language: string;
  items: OutlineDetail[];
}

export interface AiAttemptLog {
  operation: "generateOutline" | "reviseOutline";
  attempt: number;
  status: "success" | "retry" | "error";
  llmRequest: AnnaLlmCompleteInput;
  llmRawResponse?: unknown;
  validation?: {
    ok: boolean;
    errors: string[];
  };
  error?: {
    message: string;
  };
}

export interface OutlineGenerationResult {
  outline: GeneratedOutline;
  attempts: AiAttemptLog[];
}

export interface GeneratePagePlanInput {
  outline: WorkspaceOutline;
  planningContext: TemplatePlanningContext;
  locale: Locale;
  logContext?: AiOperationLogContext;
}

export type PageRefinementIntentReviewRoute = "proceed" | "unsupported";

export interface PageRefinementIntentReviewResult {
  route: PageRefinementIntentReviewRoute;
  blocking_reason?: string;
  outline_change_required: boolean;
  target_outline_item?: {
    title: string;
    outline: string;
  };
  additional_research_required: boolean;
  additional_web_query_intents: string[];
  additional_image_query_intents: string[];
  evidence_needs: string[];
  visual_needs: string[];
  reason: string;
}

export interface ReviewPageRefinementIntentInput {
  instruction: string;
  outline: WorkspaceOutline;
  pagePlan: PagePlan;
  targetPage: PagePlanItem;
  planningContext: TemplatePlanningContext;
  researchRequirement: ResearchRequirement | null;
  researchEvidence: ResearchEvidenceIndex | null;
  locale: Locale;
  logContext?: AiOperationLogContext;
}

export type DeckRefinementIntentReviewRoute = "proceed" | "unsupported" | "no_op";

export type DeckRefinementOutlineOperation =
  | {
      op: "keep";
      page_id: string;
      reason: string;
    }
  | {
      op: "update";
      page_id: string;
      title: string;
      outline: string;
      reason: string;
      additional_research_required?: boolean;
      additional_web_query_intents?: string[];
      additional_image_query_intents?: string[];
      evidence_needs?: string[];
      visual_needs?: string[];
    }
  | {
      op: "add";
      title: string;
      outline: string;
      reason: string;
      additional_research_required?: boolean;
      additional_web_query_intents?: string[];
      additional_image_query_intents?: string[];
      evidence_needs?: string[];
      visual_needs?: string[];
    }
  | {
      op: "delete";
      page_id: string;
      reason: string;
    };

export interface DeckRefinementIntentReviewResult {
  route: DeckRefinementIntentReviewRoute;
  blocking_reason?: string;
  output_language_change: {
    changed: boolean;
    output_language?: string;
    reason?: string;
  };
  operations: DeckRefinementOutlineOperation[];
  reason: string;
}

export interface ReviewDeckRefinementIntentInput {
  instruction: string;
  outline: WorkspaceOutline;
  pagePlan: PagePlan;
  planningContext: TemplatePlanningContext;
  setting?: WorkspaceSettings;
  locale: Locale;
  logContext?: AiOperationLogContext;
}

export interface GenerateAddedPagePlanInput {
  outlineItems: WorkspaceOutlineItem[];
  baseOutline: WorkspaceOutline;
  planningContext: TemplatePlanningContext;
  locale: Locale;
  logContext?: AiOperationLogContext;
}

export interface GenerateResearchDiscoveryDecisionInput {
  outline: WorkspaceOutline;
  pagePlan: PagePlan;
  phase: "web" | "visual";
  iteration: number;
  iterationLimit: number;
  targetPageIds?: string[];
  discoveryPool: ResearchDiscoveryEvidencePool;
  uploadedSourceAnalysisContext?: unknown;
  researchStatus?: unknown;
  locale: Locale;
  logContext?: AiOperationLogContext;
}

export interface GenerateEvidenceAwarePagePlanInput {
  outline: WorkspaceOutline;
  pagePlan: PagePlan;
  discoveryPool: ResearchDiscoveryEvidencePool;
  uploadedSourceAnalysisContext?: unknown;
  targetPageIds?: string[];
  locale: Locale;
  logContext?: AiOperationLogContext;
}

export interface AiClient {
  generateOutline(input: GenerateOutlineInput): Promise<OutlineGenerationResult>;
  detectOutputLanguage(input: GenerateOutlineInput & {
    title?: string;
    outline?: OutlineDetail[];
  }): Promise<{ output_language: string }>;
  suggestContext(input: SuggestContextInput): Promise<ContextSuggestionResult>;
  generatePagePlan(input: GeneratePagePlanInput): Promise<PagePlan>;
  generateAddedPagePlan(input: GenerateAddedPagePlanInput): Promise<PagePlan>;
  generateResearchDiscoveryDecision(input: GenerateResearchDiscoveryDecisionInput): Promise<ResearchDiscoveryDecision>;
  generateEvidenceAwarePagePlan(input: GenerateEvidenceAwarePagePlanInput): Promise<PagePlan>;
  reviewPageRefinementIntent(input: ReviewPageRefinementIntentInput): Promise<PageRefinementIntentReviewResult>;
  reviewDeckRefinementIntent(input: ReviewDeckRefinementIntentInput): Promise<DeckRefinementIntentReviewResult>;
  generateDeck(input: GenerateDeckInput): Promise<GeneratedDeck>;
  reviseOutline(input: ReviseOutlineInput): Promise<OutlineGenerationResult>;
  generateSlidesFromOutline(
    input: GenerateSlidesFromOutlineInput
  ): Promise<Slide[]>;
  refineDeck(input: RefineDeckInput): Promise<Slide[]>;
  refineSlide(input: RefineSlideInput): Promise<Slide>;
}
