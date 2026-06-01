import {
  initialDeck,
  outlineDetails,
  type OutlineDetail,
  type Slide
} from "../data/mockDeck";
import { sleep } from "../features/deck-workspace/utils";
import {
  buildGenerateOutlineLlmRequest,
  buildReviseOutlineLlmRequest,
  getExpectedSlideCount,
  getExpectedSlideCountForRevision,
} from "./outlinePrompt";
import { validateGeneratedOutline } from "./outlineParser";
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
    ...item
  }));
}

function cloneSlides(slides: Slide[]): Slide[] {
  return slides.map((slide) => ({ ...slide }));
}

function fitOutlineCount(outline: OutlineDetail[], count: number | null): OutlineDetail[] {
  if (count === null || count === outline.length) {
    return cloneOutline(outline);
  }

  if (count < outline.length) {
    return cloneOutline(outline.slice(0, count));
  }

  const next = cloneOutline(outline);
  while (next.length < count) {
    next.push({
      title: `Supporting Point ${next.length + 1}`,
      outline:
        "Add a focused supporting page that extends the core argument with one clear takeaway.",
    });
  }
  return next;
}

export function createMockAiClient(): AiClient {
  return {
    async generateOutline(input) {
      await sleep(900);
      const llmRequest = buildGenerateOutlineLlmRequest(input);
      const expectedSlideCount = getExpectedSlideCount(input.setting, input.prompt, input.contextRows);
      const rawOutline = {
        title: input.locale === "zh" ? "AI Agent 工作流" : "AI Agent Workflows",
        items: fitOutlineCount(outlineDetails, expectedSlideCount),
      };
      const outline = validateGeneratedOutline(rawOutline, expectedSlideCount);
      return {
        outline,
        attempts: [
          {
            operation: "generateOutline",
            attempt: 1,
            status: "success",
            llmRequest,
            llmRawResponse: {
              content: {
                type: "text",
                text: JSON.stringify(rawOutline),
              },
            },
            validation: {
              ok: true,
              errors: [],
            },
          },
        ],
      };
    },

    async suggestContext(input) {
      await sleep(500);
      return input.locale === "zh"
        ? {
            audience: ["企业管理层", "业务负责人"],
            goal: ["说明 AI Agent 的能力与落地路径"],
            style: ["Business Professional"],
          }
        : {
            audience: ["Executive stakeholders", "Business owners"],
            goal: ["Explain AI Agent capabilities and adoption path"],
            style: ["Business Professional"],
          };
    },

    async generatePagePlan(input) {
      await sleep(300);
      const now = new Date().toISOString();
      const blueprints = input.planningContext.blueprints;
      const fallback = blueprints[0];
      const cover = blueprints.find((item) => item.layout_family === "cover") ?? fallback;
      const closing = blueprints.find((item) => item.layout_family === "closing") ?? fallback;
      const content = blueprints.find((item) => item.layout_family === "two-column") ?? fallback;

      return {
        version: 1,
        status: "planned",
        title: input.outline.title,
        source: {
          outline_updated_at: input.outline.updated_at,
          template_group: input.planningContext.template_group,
          template_manifest_path: input.planningContext.manifest_path,
          generated_by: "mock",
        },
        pages: input.outline.items.map((item, index) => {
          const pageNumber = String(index + 1).padStart(2, "0");
          const blueprint =
            index === 0 ? cover : index === input.outline.items.length - 1 ? closing : content;
          return {
            page_id: `page-${pageNumber}`,
            index,
            title: item.title,
            outline: item.outline,
            blueprint_id: blueprint.id,
            blueprint_source: blueprint.blueprint_source,
            slide_path: `./slides/page-${pageNumber}.tsx`,
            data_path: `./data/page-${pageNumber}.json`,
            manifest_slide_id: `page-${pageNumber}`,
            reason: "Mock page plan.",
          };
        }),
        updated_at: now,
      };
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
      const llmRequest = buildReviseOutlineLlmRequest(input);
      const expectedSlideCount = getExpectedSlideCountForRevision(input.setting, input.feedback, input.contextRows);
      const revisedItems = !input.feedback.trim()
        ? fitOutlineCount(input.outline, expectedSlideCount)
        : fitOutlineCount(input.outline, expectedSlideCount).map((item, index) =>
            index === 5
              ? { ...item, title: "Security Boundaries for Real Action" }
              : { ...item }
          );
      const rawOutline = {
        title:
          input.title ||
          (input.locale === "zh" ? "AI Agent 工作流" : "AI Agent Workflows"),
        items: revisedItems,
      };
      const outline = validateGeneratedOutline(rawOutline, expectedSlideCount);

      return {
        outline,
        attempts: [
          {
            operation: "reviseOutline",
            attempt: 1,
            status: "success",
            llmRequest,
            llmRawResponse: {
              content: {
                type: "text",
                text: JSON.stringify(rawOutline),
              },
            },
            validation: {
              ok: true,
              errors: [],
            },
          },
        ],
      };
    },

    async generateSlidesFromOutline(input: GenerateSlidesFromOutlineInput) {
      await sleep(1200);
      return input.outline.map((item) => ({
        title: item.title,
        subtitle: item.outline
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
