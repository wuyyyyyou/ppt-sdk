import type { OutlineDetail, Slide } from "../data/mockDeck";
import type { AnnaLlmCompleteInput } from "../runtime/annaRuntime";
import type { PresentationRequirements, PresentationRequirementsCandidates, WorkspaceSettings } from "../api/types";
import type {
  PagePlan,
  PagePlanItem,
  ResearchDiscoveryDecision,
  ResearchDiscoveryEvidencePool,
  ResearchEvidenceIndex,
  ResearchRequirement,
  TemplatePlanningContext,
  WorkspaceThemeContext,
  WorkspaceOutlineItem,
  WorkspaceOutline,
} from "../api/types";
import type { Locale } from "../i18n/messages";
import type { AiOperationLogContext } from "./interactionLog";
import type { GenerateWorkspaceStyleGuideInput } from "./styleGuidePrompt";

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

export interface GenerateOutlineInput {
  requirements: PresentationRequirements;
  uploadedSourceAnalysisContext?: unknown;
  logContext?: AiOperationLogContext;
}

export interface GenerateDeckInput extends DeckBriefInput {
  outlineFirst: boolean;
}

export interface GeneratePresentationRequirementsInput {
  brief: string;
  logContext?: AiOperationLogContext;
}

export interface GenerateThemeTokenInput {
  prompt: string;
  contextRows: LlmContextRow[];
  locale: Locale;
  themeContext: WorkspaceThemeContext;
  refinementRequest?: string;
  currentToken?: unknown;
  validationErrors?: string[];
  previousResponse?: unknown;
  selectedStyleProfile?: {
    displayName?: string;
    profilePath: string;
    content: string;
  } | null;
  logContext?: AiOperationLogContext;
}

export interface ReviseOutlineInput {
  title?: string;
  outline: OutlineDetail[];
  feedback: string;
  requirements: PresentationRequirements;
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
  theme_change_required: boolean;
  theme_change_reason?: string;
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
  generatePresentationRequirements(
    input: GeneratePresentationRequirementsInput
  ): Promise<PresentationRequirementsCandidates>;
  generateOutline(input: GenerateOutlineInput): Promise<OutlineGenerationResult>;
  generateWorkspaceStyleGuide(input: GenerateWorkspaceStyleGuideInput): Promise<string>;
  generateThemeToken(input: GenerateThemeTokenInput): Promise<unknown>;
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
