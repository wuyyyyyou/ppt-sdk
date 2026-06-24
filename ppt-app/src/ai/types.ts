import type { OutlineDetail, Slide } from "../data/mockDeck";
import type { AnnaLlmCompleteInput } from "../runtime/annaRuntime";
import type { WorkspaceSettings } from "../api/types";
import type {
  PagePlan,
  PagePlanItem,
  ResearchEvidenceIndex,
  ResearchPlan,
  ResearchRequirement,
  TemplatePlanningContext,
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

export interface GenerateOutlineInput extends DeckBriefInput {}

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

export interface GenerateResearchPlanInput {
  outline: WorkspaceOutline;
  pagePlan: PagePlan;
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

export interface AiClient {
  generateOutline(input: GenerateOutlineInput): Promise<OutlineGenerationResult>;
  detectOutputLanguage(input: GenerateOutlineInput & {
    title?: string;
    outline?: OutlineDetail[];
  }): Promise<{ output_language: string }>;
  suggestContext(input: SuggestContextInput): Promise<ContextSuggestionResult>;
  generatePagePlan(input: GeneratePagePlanInput): Promise<PagePlan>;
  generateResearchPlan(input: GenerateResearchPlanInput): Promise<ResearchPlan>;
  reviewPageRefinementIntent(input: ReviewPageRefinementIntentInput): Promise<PageRefinementIntentReviewResult>;
  generateDeck(input: GenerateDeckInput): Promise<GeneratedDeck>;
  reviseOutline(input: ReviseOutlineInput): Promise<OutlineGenerationResult>;
  generateSlidesFromOutline(
    input: GenerateSlidesFromOutlineInput
  ): Promise<Slide[]>;
  refineDeck(input: RefineDeckInput): Promise<Slide[]>;
  refineSlide(input: RefineSlideInput): Promise<Slide>;
}
