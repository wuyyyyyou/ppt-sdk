import type { OutlineDetail, Slide } from "../data/mockDeck";
import type { AnnaLlmCompleteInput } from "../runtime/annaRuntime";
import type {
  PresentationRequirements,
  PresentationRequirementsCandidates,
  VisualStylePreset,
  VisualStylePresetColor,
  VisualStylePresetSelection,
  WorkspaceSettings,
} from "../api/types";
import type {
  PagePlan,
  PagePlanItem,
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
  visualStylePreset?: VisualStylePresetSelection | null;
  visualToneRequired?: boolean;
  logContext?: AiOperationLogContext;
}

export type VisualStylePresetSelectionCandidate = Pick<
  VisualStylePreset,
  "id" | "version" | "name" | "description" | "theme" | "color" | "user" | "use_case" | "industry" | "style_guide"
>;

export interface SelectVisualStylePresetColorInput {
  brief: string;
  requirements: PresentationRequirements;
  colors: VisualStylePresetColor[];
  logContext?: AiOperationLogContext;
}

export interface SelectVisualStylePresetInput {
  brief: string;
  requirements: PresentationRequirements;
  color: VisualStylePresetColor;
  candidates: VisualStylePresetSelectionCandidate[];
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

export type DeckRefinementPlanningRoute = "proceed" | "no_op";

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
      core_message: string;
      required_content: string[];
      reason: string;
    }
  | {
      op: "add";
      title: string;
      core_message: string;
      required_content: string[];
      reason: string;
    }
  | {
      op: "delete";
      page_id: string;
      reason: string;
    };

export interface DeckRefinementPlan {
  route: DeckRefinementPlanningRoute;
  title: string;
  output_language_change: {
    changed: boolean;
    output_language?: string;
    reason?: string;
  };
  style_guide_change: {
    action: "preserve" | "regenerate";
    reason: string;
  };
  persistent_elements_action: "preserve" | "revise";
  operations: DeckRefinementOutlineOperation[];
  reason: string;
}

export interface PlanDeckRefinementInput {
  instruction: string;
  outline: WorkspaceOutline;
  requirements: PresentationRequirements;
  currentStyleGuide: string;
  locale: Locale;
  visualStylePresetSelected?: boolean;
  logContext?: AiOperationLogContext;
}

export interface DeckRefinementPlanningAttempt {
  attempt: number;
  status: "success" | "retry" | "error";
  llmRequest: AnnaLlmCompleteInput;
  llmRawResponse?: unknown;
  validation: {
    ok: boolean;
    errors: string[];
  };
  error?: { message: string };
}

export interface DeckRefinementPlanningResult {
  plan: DeckRefinementPlan;
  attempts: DeckRefinementPlanningAttempt[];
}

export interface GenerateAddedPagePlanInput {
  outlineItems: WorkspaceOutlineItem[];
  baseOutline: WorkspaceOutline;
  planningContext: TemplatePlanningContext;
  locale: Locale;
  logContext?: AiOperationLogContext;
}

export interface AiClient {
  generatePresentationRequirements(
    input: GeneratePresentationRequirementsInput
  ): Promise<PresentationRequirementsCandidates>;
  selectVisualStylePresetColor(
    input: SelectVisualStylePresetColorInput,
  ): Promise<VisualStylePresetColor>;
  selectVisualStylePreset(
    input: SelectVisualStylePresetInput,
  ): Promise<string>;
  generateOutline(input: GenerateOutlineInput): Promise<OutlineGenerationResult>;
  generateWorkspaceStyleGuide(input: GenerateWorkspaceStyleGuideInput): Promise<string>;
  generateThemeToken(input: GenerateThemeTokenInput): Promise<unknown>;
  generatePagePlan(input: GeneratePagePlanInput): Promise<PagePlan>;
  generateAddedPagePlan(input: GenerateAddedPagePlanInput): Promise<PagePlan>;
  planDeckRefinement(input: PlanDeckRefinementInput): Promise<DeckRefinementPlanningResult>;
  generateDeck(input: GenerateDeckInput): Promise<GeneratedDeck>;
  reviseOutline(input: ReviseOutlineInput): Promise<OutlineGenerationResult>;
  generateSlidesFromOutline(
    input: GenerateSlidesFromOutlineInput
  ): Promise<Slide[]>;
  refineDeck(input: RefineDeckInput): Promise<Slide[]>;
  refineSlide(input: RefineSlideInput): Promise<Slide>;
}
