import type { OutlineDetail, Slide } from "../data/mockDeck";
import type { ContextRow } from "../features/deck-workspace/types";
import type { Locale } from "../i18n/messages";

export interface DeckBriefInput {
  prompt: string;
  contextRows: ContextRow[];
  locale: Locale;
}

export interface GenerateOutlineInput extends DeckBriefInput {}

export interface GenerateDeckInput extends DeckBriefInput {
  outlineFirst: boolean;
}

export interface ReviseOutlineInput {
  outline: OutlineDetail[];
  feedback: string;
  locale: Locale;
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

export interface AiClient {
  generateOutline(input: GenerateOutlineInput): Promise<OutlineDetail[]>;
  generateDeck(input: GenerateDeckInput): Promise<GeneratedDeck>;
  reviseOutline(input: ReviseOutlineInput): Promise<OutlineDetail[]>;
  generateSlidesFromOutline(
    input: GenerateSlidesFromOutlineInput
  ): Promise<Slide[]>;
  refineDeck(input: RefineDeckInput): Promise<Slide[]>;
  refineSlide(input: RefineSlideInput): Promise<Slide>;
}
