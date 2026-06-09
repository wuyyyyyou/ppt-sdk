import type { OutlineDetail, Slide } from "../data/mockDeck";
import type { AnnaLlmCompleteInput } from "../runtime/annaRuntime";
import type { WorkspaceSettings } from "../api/types";
import type { PagePlan, TemplatePlanningContext, WorkspaceOutline } from "../api/types";
import type { Locale } from "../i18n/messages";

export interface LlmContextRow {
  id: string;
  value: string;
}

export interface DeckBriefInput {
  prompt: string;
  contextRows: LlmContextRow[];
  locale: Locale;
  setting?: WorkspaceSettings;
}

export interface GenerateOutlineInput extends DeckBriefInput {}

export interface GenerateDeckInput extends DeckBriefInput {
  outlineFirst: boolean;
}

export interface SuggestContextInput {
  prompt: string;
  locale: Locale;
}

export interface ContextSuggestionResult {
  audience: string[];
  goal: string[];
  style: string[];
  theme: string[];
}

export interface ReviseOutlineInput {
  title?: string;
  outline: OutlineDetail[];
  feedback: string;
  locale: Locale;
  setting?: WorkspaceSettings;
  contextRows?: LlmContextRow[];
}

export interface GenerateSlidesFromOutlineInput {
  outline: OutlineDetail[];
  locale: Locale;
}

export interface RefineDeckInput {
  slides: Slide[];
  locale: Locale;
}

export interface RefineSlideInput {
  slide: Slide;
  slideIndex: number;
  locale: Locale;
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
}

export interface AiClient {
  generateOutline(input: GenerateOutlineInput): Promise<OutlineGenerationResult>;
  suggestContext(input: SuggestContextInput): Promise<ContextSuggestionResult>;
  generatePagePlan(input: GeneratePagePlanInput): Promise<PagePlan>;
  generateDeck(input: GenerateDeckInput): Promise<GeneratedDeck>;
  reviseOutline(input: ReviseOutlineInput): Promise<OutlineGenerationResult>;
  generateSlidesFromOutline(
    input: GenerateSlidesFromOutlineInput
  ): Promise<Slide[]>;
  refineDeck(input: RefineDeckInput): Promise<Slide[]>;
  refineSlide(input: RefineSlideInput): Promise<Slide>;
}
