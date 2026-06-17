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
import { buildGenerateResearchPlanLlmRequest } from "./researchPlanPrompt";
import { validateGeneratedOutline } from "./outlineParser";
import type {
  AiClient,
  GenerateDeckInput,
  GenerateSlidesFromOutlineInput,
  RefineDeckInput,
  RefineSlideInput,
  ReviseOutlineInput
} from "./types";
import type { AiOperationLogContext } from "./interactionLog";

async function logMockInteraction(
  logContext: AiOperationLogContext | undefined,
  request: unknown,
  response: unknown
) {
  if (!logContext?.logger) return;
  const context = {
    ...logContext,
    provider: "mock",
    runtime_mode: "mock",
  };
  const handle = await logContext.logger.startInteraction(context, { request });
  await logContext.logger.finishInteraction(handle, {
    status: "succeeded",
    response,
    output: typeof response === "string" ? response : JSON.stringify(response),
    model: "mock",
  });
}

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

function readOutputLanguage(value: unknown, fallback: string): string {
  const language = typeof value === "string" && value.trim() ? value.trim() : "auto";
  return language === "auto" ? fallback : language;
}

export function createMockAiClient(): AiClient {
  return {
    async generateOutline(input) {
      await sleep(900);
      const llmRequest = buildGenerateOutlineLlmRequest(input);
      const expectedSlideCount = getExpectedSlideCount(input.setting, input.prompt, input.contextRows);
      const rawOutline = {
        title: input.locale === "zh" ? "AI Agent 工作流" : "AI Agent Workflows",
        output_language: readOutputLanguage(
          input.setting?.output_language,
          input.locale === "zh" ? "中文" : "English"
        ),
        items: fitOutlineCount(outlineDetails, expectedSlideCount),
      };
      const llmRawResponse = {
        content: {
          type: "text",
          text: JSON.stringify(rawOutline),
        },
        model: "mock",
      };
      await logMockInteraction(input.logContext, llmRequest, llmRawResponse);
      const outline = validateGeneratedOutline(rawOutline, expectedSlideCount);
      return {
        outline,
        attempts: [
          {
            operation: "generateOutline",
            attempt: 1,
            status: "success",
            llmRequest,
            llmRawResponse,
            validation: {
              ok: true,
              errors: [],
            },
          },
        ],
      };
    },

    async detectOutputLanguage(input) {
      await sleep(200);
      const result = {
        output_language: readOutputLanguage(
          input.setting?.output_language,
          input.locale === "zh" ? "中文" : "English"
        ),
      };
      await logMockInteraction(input.logContext, { method: "detectOutputLanguage", input }, result);
      return result;
    },

    async suggestContext(input) {
      await sleep(500);
      const result = input.locale === "zh"
        ? {
            audience: ["企业管理层", "业务负责人"],
            goal: ["说明 AI Agent 的能力与落地路径"],
            style: ["Business Professional"],
            theme: ["digital-indigo"],
            slides: "7",
          }
        : {
            audience: ["Executive stakeholders", "Business owners"],
            goal: ["Explain AI Agent capabilities and adoption path"],
            style: ["Business Professional"],
            theme: ["digital-indigo"],
            slides: "7",
          };
      await logMockInteraction(input.logContext, { method: "suggestContext", input }, result);
      return result;
    },

    async generatePagePlan(input) {
      await sleep(300);
      const now = new Date().toISOString();
      const blueprints = input.planningContext.blueprints;
      const fallback = blueprints[0];
      const cover = blueprints.find((item) => item.layout_family === "cover") ?? fallback;
      const closing = blueprints.find((item) => item.layout_family === "closing") ?? fallback;
      const content = blueprints.find((item) => item.layout_family === "two-column") ?? fallback;

      const plan = {
        version: 1 as const,
        status: "planned" as const,
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
      await logMockInteraction(input.logContext, { method: "generatePagePlan", input }, plan);
      return plan;
    },

    async generateResearchPlan(input) {
      await sleep(250);
      const now = new Date().toISOString();
      const request = buildGenerateResearchPlanLlmRequest(input);
      const plan = {
        version: 1 as const,
        status: "planned" as const,
        title: input.pagePlan.title,
        source: {
          outline_updated_at: input.outline.updated_at,
          page_plan_updated_at: input.pagePlan.updated_at,
          template_group: input.pagePlan.source.template_group,
          generated_by: "mock",
        },
        pages: input.pagePlan.pages.map((page) => {
          const text = `${page.title} ${page.outline}`.toLowerCase();
          const webNeeded = /data|market|case|latest|trend|数据|市场|案例|最新|趋势|排名|规模/.test(text);
          const imageNeeded = /image|photo|visual|product|logo|图片|照片|视觉|产品|标志/.test(text);
          return {
            page_id: page.page_id,
            index: page.index,
            title: page.title,
            web_research_needed: webNeeded,
            image_research_needed: imageNeeded,
            query_intents: webNeeded ? [page.title] : [],
            image_query_intents: imageNeeded ? [page.title] : [],
            evidence_needs: webNeeded ? ["Source-backed facts for this page."] : [],
            visual_needs: imageNeeded ? ["A relevant non-template visual asset."] : [],
            gap_strategy: "Generalize unsupported concrete details or mark data slots as TBD / 待补充.",
            reason: webNeeded || imageNeeded ? "Mock detected research-sensitive page intent." : "Mock detected no external research need.",
          };
        }),
        shared: {
          web_research_needed: false,
          image_research_needed: false,
          query_intents: [],
        },
        updated_at: now,
      };
      await logMockInteraction(input.logContext, request, plan);
      return plan;
    },

    async generateDeck(input: GenerateDeckInput) {
      await sleep(input.outlineFirst ? 900 : 1100);
      const deck = {
        title: input.locale === "zh" ? "AI Agent 工作流" : "AI Agent Workflows",
        outline: cloneOutline(outlineDetails),
        slides: cloneSlides(initialDeck)
      };
      await logMockInteraction(input.logContext, { method: "generateDeck", input }, deck);
      return deck;
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
        output_language: readOutputLanguage(
          input.setting?.output_language,
          input.locale === "zh" ? "中文" : "English"
        ),
        items: revisedItems,
      };
      const llmRawResponse = {
        content: {
          type: "text",
          text: JSON.stringify(rawOutline),
        },
        model: "mock",
      };
      await logMockInteraction(input.logContext, llmRequest, llmRawResponse);
      const outline = validateGeneratedOutline(rawOutline, expectedSlideCount);

      return {
        outline,
        attempts: [
          {
            operation: "reviseOutline",
            attempt: 1,
            status: "success",
            llmRequest,
            llmRawResponse,
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
      const slides = input.outline.map((item) => ({
        title: item.title,
        subtitle: item.outline
      }));
      await logMockInteraction(input.logContext, { method: "generateSlidesFromOutline", input }, slides);
      return slides;
    },

    async refineDeck(input: RefineDeckInput) {
      await sleep(1600);
      const slides = input.slides.map((slide) => ({
        ...slide,
        title: slide.title.includes("Refined")
          ? slide.title
          : `${slide.title} (Refined)`
      }));
      await logMockInteraction(input.logContext, { method: "refineDeck", input }, slides);
      return slides;
    },

    async refineSlide(input: RefineSlideInput) {
      await sleep(1200);
      const slide = {
        ...input.slide,
        title: input.slide.title.includes("Updated")
          ? input.slide.title
          : `${input.slide.title} (Updated)`
      };
      await logMockInteraction(input.logContext, { method: "refineSlide", input }, slide);
      return slide;
    }
  };
}
