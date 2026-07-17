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
  DeckRefinementIntentReviewResult,
  DeckRefinementOutlineOperation,
  GenerateDeckInput,
  GenerateSlidesFromOutlineInput,
  RefineDeckInput,
  RefineSlideInput,
  ReviseOutlineInput
} from "./types";
import type { AiOperationLogContext } from "./interactionLog";

function pageLooksResearchSensitive(text: string) {
  return /data|market|case|latest|trend|数据|市场|案例|最新|趋势|排名|规模|202\d|current|recent/i.test(text);
}

function pageLooksVisualSensitive(text: string) {
  return /image|photo|visual|product|logo|图片|照片|视觉|产品|标志|screenshot|map|person|place/i.test(text);
}

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
    async generatePresentationRequirements(input) {
      await sleep(700);
      const usesChinese = /[\u3400-\u9fff]/.test(input.brief);
      const result = {
        audience: [{
          label: usesChinese ? "业务决策者" : "Business decision-makers",
          description: usesChinese
            ? "面向需要快速理解主题并作出判断的业务决策者。"
            : "For business decision-makers who need to understand the topic and act.",
        }],
        purpose: [{
          label: usesChinese ? "方案沟通" : "Proposal communication",
          description: usesChinese
            ? "用于清晰说明方案、依据与后续行动。"
            : "Communicate the proposal, rationale, and next actions clearly.",
        }],
        desired_outcome: [{
          label: usesChinese ? "形成共识" : "Build alignment",
          description: usesChinese
            ? "让受众理解核心判断并对下一步形成共识。"
            : "Help the audience understand the key judgment and align on next steps.",
        }],
        slide_count: [8],
        output_language: [usesChinese ? "中文" : "English"],
        visual_tone: [{
          label: usesChinese ? "编辑式专业感" : "Editorial professionalism",
          description: usesChinese
            ? "采用清晰有力的标题与编辑式节奏，呈现专业而有观点的阅读体验。"
            : "Use strong headings and editorial rhythm for a professional, opinionated reading experience.",
        }],
      };
      await logMockInteraction(
        input.logContext,
        { method: "generatePresentationRequirements", brief: input.brief },
        result,
      );
      return result;
    },

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

    async generateThemeToken(input) {
      await sleep(120);
      const result = input.themeContext.default_token;
      await logMockInteraction(input.logContext, { method: "generateThemeToken", input }, result);
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

    async generateAddedPagePlan(input) {
      await sleep(250);
      const now = new Date().toISOString();
      const blueprints = input.planningContext.blueprints;
      const fallback = blueprints[0];
      const content = blueprints.find((item) => item.layout_family === "two-column") ?? fallback;
      const plan = {
        version: 1 as const,
        status: "planned" as const,
        title: input.baseOutline.title,
        source: {
          outline_updated_at: input.baseOutline.updated_at,
          template_group: input.planningContext.template_group,
          template_manifest_path: input.planningContext.manifest_path,
          generated_by: "mock",
        },
        pages: input.outlineItems.map((item, index) => {
          const pageNumber = String(index + 1).padStart(2, "0");
          return {
            page_id: `added-${pageNumber}`,
            index,
            title: item.title,
            outline: item.outline,
            blueprint_id: content.id,
            blueprint_source: content.blueprint_source,
            slide_path: `./slides/added-${pageNumber}.tsx`,
            data_path: `./data/added-${pageNumber}.json`,
            manifest_slide_id: `added-${pageNumber}`,
            reason: "Mock added-page page plan.",
          };
        }),
        updated_at: now,
      };
      await logMockInteraction(input.logContext, { method: "generateAddedPagePlan", input }, plan);
      return plan;
    },

    async generateResearchDiscoveryDecision(input) {
      await sleep(80);
      const targetIds = new Set(input.targetPageIds ?? input.pagePlan.pages.map((page) => page.page_id));
      const scopedPages = input.pagePlan.pages.filter((page) => targetIds.has(page.page_id));
      const existingQueries = new Set(
        input.discoveryPool.iterations.flatMap((iteration) =>
          iteration.query_summaries
            .filter((summary) => summary.kind === input.phase)
            .map((summary) => summary.query.toLowerCase()),
        ),
      );
      const queries = scopedPages
        .filter((page) => input.phase === "web"
          ? pageLooksResearchSensitive(`${page.title} ${page.outline}`)
          : pageLooksVisualSensitive(`${page.title} ${page.outline}`))
        .map((page) => input.phase === "web" ? page.title : `${page.title} visual reference`)
        .filter((query) => !existingQueries.has(query.toLowerCase()))
        .slice(0, 4);
      const decision = {
        action: queries.length > 0 && input.iteration <= input.iterationLimit ? "search" as const : "stop" as const,
        phase: input.phase,
        queries,
        rationale: queries.length > 0 ? "Mock detected research-sensitive target pages." : "Mock found no additional search needs.",
        evidence_needs: input.phase === "web" && queries.length > 0 ? ["Source-backed facts for target pages."] : [],
        visual_needs: input.phase === "visual" && queries.length > 0 ? ["Relevant non-template visual assets for target pages."] : [],
        gaps: [],
      };
      await logMockInteraction(input.logContext, { method: "generateResearchDiscoveryDecision", input }, decision);
      return decision;
    },

    async generateEvidenceAwarePagePlan(input) {
      await sleep(120);
      const targetIds = new Set(input.targetPageIds ?? input.pagePlan.pages.map((page) => page.page_id));
      const factIds = input.discoveryPool.facts.map((fact) => fact.id);
      const insightIds = input.discoveryPool.derived_insights.map((insight) => insight.id);
      const visualIds = input.discoveryPool.visual_assets.map((asset) => asset.id);
      const planned = {
        ...input.pagePlan,
        pages: input.pagePlan.pages.map((page) => targetIds.has(page.page_id)
          ? {
              ...page,
              content_plan: {
                main_message: page.outline || page.title,
                content_points: [page.outline || page.title],
                evidence_fact_ids: factIds.slice(0, 4),
                derived_insight_ids: insightIds.slice(0, 3),
                visual_asset_ids: visualIds.slice(0, 2),
                gaps: input.discoveryPool.gaps.slice(0, 3),
                authoring_notes: ["Use only assigned Research Evidence; generalize unsupported details."],
              },
            }
          : page),
        updated_at: new Date().toISOString(),
      };
      await logMockInteraction(input.logContext, { method: "generateEvidenceAwarePagePlan", input }, planned);
      return planned;
    },

    async reviewPageRefinementIntent(input) {
      await sleep(200);
      const result = {
        route: "proceed" as const,
        outline_change_required: false,
        additional_research_required: false,
        additional_web_query_intents: [],
        additional_image_query_intents: [],
        evidence_needs: [],
        visual_needs: [],
        reason: "Mock current-page refinement can proceed.",
      };
      await logMockInteraction(input.logContext, { method: "reviewPageRefinementIntent", input }, result);
      return result;
    },

    async reviewDeckRefinementIntent(input) {
      await sleep(250);
      const lower = input.instruction.toLowerCase();
      const wantsNoOp = /no.?op|不用改|无需|没变化/.test(lower);
      const wantsTemplate = /template|模板/.test(lower) && /换|change|switch|更换/.test(lower);
      const wantsThemeChange = /theme|palette|brand|color|dark|light|主题|配色|品牌色|深色|浅色|视觉风格/.test(lower);
      const wantsEnglish = /english|英文|英语/.test(lower);
      const wantsChinese = /中文|chinese|汉语/.test(lower);
      const wantsAdd = /add|增加|新增|加一页|加页/.test(lower);
      const wantsDelete = /delete|remove|删除|删掉|去掉/.test(lower);
      const wantsGlobalRewrite = /audience|style|受众|风格|表达|统一/.test(lower);
      const wantsUpdate = /update|rewrite|优化|调整|改/.test(lower);

      const result: DeckRefinementIntentReviewResult = wantsTemplate
        ? {
            route: "unsupported" as const,
            blocking_reason: "Mock: selected Template changes are unsupported in Deck Refinement.",
            output_language_change: { changed: false },
            theme_change_required: false,
            operations: [],
            reason: "Template migration is outside Deck Refinement.",
          }
        : wantsNoOp
          ? {
              route: "no_op" as const,
              output_language_change: { changed: false },
              theme_change_required: false,
              operations: [],
              reason: "Mock no-op Deck Refinement.",
            }
          : {
              route: "proceed" as const,
              output_language_change: {
                changed: wantsEnglish || wantsChinese,
                output_language: wantsEnglish ? "English" : wantsChinese ? "中文" : "",
                reason: wantsEnglish || wantsChinese ? "Mock explicit output language change." : "",
              },
              theme_change_required: wantsThemeChange,
              theme_change_reason: wantsThemeChange ? "Mock explicit whole-deck theme change." : "",
              operations: input.pagePlan.pages.flatMap((page, index): DeckRefinementOutlineOperation[] => {
                if (wantsDelete && index === input.pagePlan.pages.length - 1) {
                  return [{ op: "delete" as const, page_id: page.page_id, reason: "Mock delete last page." }];
                }
                const shouldUpdate = wantsGlobalRewrite || (wantsUpdate && index === Math.min(1, input.pagePlan.pages.length - 1));
                const base = shouldUpdate
                  ? {
                      op: "update" as const,
                      page_id: page.page_id,
                      title: page.title.includes("Updated") ? page.title : `${page.title} Updated`,
                      outline: `${page.outline}\nMock deck-level refinement: ${input.instruction}`,
                      reason: wantsGlobalRewrite ? "Mock explicit whole-deck rewrite." : "Mock update page intent.",
                      additional_research_required: /latest|最新|citation|引用|数据/.test(lower),
                      additional_web_query_intents: /latest|最新|citation|引用|数据/.test(lower) ? [page.title] : [],
                      additional_image_query_intents: [],
                      evidence_needs: [],
                      visual_needs: [],
                    }
                  : { op: "keep" as const, page_id: page.page_id, reason: "Mock keep page." };
                if (wantsAdd && index === input.pagePlan.pages.length - 1) {
                  return [
                    base,
                    {
                      op: "add" as const,
                      title: input.locale === "zh" ? "新增补充页" : "Additional Supporting Page",
                      outline: input.locale === "zh"
                        ? "补充整套优化请求中新增的关键信息。"
                        : "Add the key supporting information requested by the deck refinement.",
                      reason: "Mock add page.",
                      additional_research_required: /latest|最新|citation|引用|数据/.test(lower),
                      additional_web_query_intents: /latest|最新|citation|引用|数据/.test(lower) ? [input.instruction] : [],
                      additional_image_query_intents: [],
                      evidence_needs: [],
                      visual_needs: [],
                    },
                  ];
                }
                return [base];
              }),
              reason: "Mock Deck Refinement proceed.",
            };
      await logMockInteraction(input.logContext, { method: "reviewDeckRefinementIntent", input }, result);
      return result;
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
