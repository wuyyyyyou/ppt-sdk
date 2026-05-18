import {
  initialDeck,
  outlineDetails,
  type OutlineDetail,
  type Slide
} from "../data/mockDeck";
import { sleep } from "../features/deck-workspace/utils";
import type {
  AiClient,
  GenerateDeckInput,
  GenerateSlidesFromOutlineInput,
  RefineDeckInput,
  RefineSlideInput,
  ReviseOutlineInput
} from "./types";

function cloneOutline(outline: OutlineDetail[]): OutlineDetail[] {
  return outline.map((item) => ({
    ...item,
    bullets: [...item.bullets]
  }));
}

function cloneSlides(slides: Slide[]): Slide[] {
  return slides.map((slide) => ({ ...slide }));
}

export function createMockAiClient(): AiClient {
  return {
    async generateOutline() {
      await sleep(900);
      return cloneOutline(outlineDetails);
    },

    async generateDeck(input: GenerateDeckInput) {
      await sleep(input.outlineFirst ? 900 : 1100);
      return {
        title: input.locale === "zh" ? "AI Agent 工作流" : "AI Agent Workflows",
        outline: cloneOutline(outlineDetails),
        slides: cloneSlides(initialDeck)
      };
    },

    async reviseOutline(input: ReviseOutlineInput) {
      await sleep(700);
      if (!input.feedback.trim()) {
        return cloneOutline(input.outline);
      }

      return input.outline.map((item, index) =>
        index === 5
          ? { ...item, title: "Security Boundaries for Real Action" }
          : { ...item, bullets: [...item.bullets] }
      );
    },

    async generateSlidesFromOutline(input: GenerateSlidesFromOutlineInput) {
      await sleep(1200);
      return input.outline.map((item) => ({
        title: item.title,
        subtitle: item.summary
      }));
    },

    async refineDeck(input: RefineDeckInput) {
      await sleep(1600);
      return input.slides.map((slide) => ({
        ...slide,
        title: slide.title.includes("Refined")
          ? slide.title
          : `${slide.title} (Refined)`
      }));
    },

    async refineSlide(input: RefineSlideInput) {
      await sleep(1200);
      return {
        ...input.slide,
        title: input.slide.title.includes("Updated")
          ? input.slide.title
          : `${input.slide.title} (Updated)`
      };
    }
  };
}
