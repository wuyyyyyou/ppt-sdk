import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { OpenTaskProjectResult } from "../actions/project.js";
import type { DiscoveredTemplateGroupSummaryInfo } from "../../discovery/index.js";
import type {
  TaskArtifactIndexRecord,
  TaskCurrentPageRecord,
  TaskOutlineRecord,
  TaskPagePlanItem,
  TaskPagePlanRecord,
  TaskPromoteDocumentReference,
  TaskPromoteKind,
  TaskPromoteManifestRecord,
  TaskRequirementsRecord,
} from "../types.js";
import {
  getArtifactsFilePath,
  getCurrentPageFilePath,
  getOutlineFilePath,
  getPagePlanFilePath,
  getRequirementsFilePath,
  getStateFilePath,
  getTaskFilePath,
  readOptionalOutlineRecord,
  readOptionalRequirementsRecord,
} from "../storage/records.js";
import { writeJsonObject } from "../storage/json.js";
import {
  resolvePromoteCurrentFilePath,
  resolvePromoteDeckDir,
  resolvePromoteDeckFilePath,
  resolvePromoteDir,
  resolvePromoteManifestFilePath,
  resolvePromotePageFilePath,
  resolvePromotePagesDir,
  resolvePromoteRecoveryFilePath,
  resolvePromoteTemplatesDir,
} from "../storage/paths.js";

const PROMOTE_VERSION = "1.0.0";

export interface PromoteActionContext {
  type: string;
  summary: string;
  requiredInputs: string[];
  expectedArtifacts: string[];
  allowedOperations: string[];
  availableTemplateGroups?: DiscoveredTemplateGroupSummaryInfo[];
}

interface PromoteRenderContext {
  opened: OpenTaskProjectResult;
  requirements: TaskRequirementsRecord | null;
  outline: TaskOutlineRecord | null;
  action: PromoteActionContext;
  availableTemplateGroups: DiscoveredTemplateGroupSummaryInfo[];
  generatedAt: string;
  sourceFiles: Record<string, string>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function sanitizeFileSegment(value: string): string {
  const sanitized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "_");
  return sanitized.length > 0 ? sanitized : "current-page";
}

function formatList(items: string[]): string {
  if (items.length === 0) {
    return "- 无。";
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function formatCodeList(items: string[]): string {
  return formatList(items.map((item) => `\`${item}\``));
}

function formatJson(value: unknown): string {
  return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

function formatTemplateGroupOptions(groups: DiscoveredTemplateGroupSummaryInfo[]): string {
  if (groups.length === 0) {
    return "- 当前没有发现可用模板组。先重新调用 `listDiscoveredTemplateGroupSummaries` 确认模板注册状态。";
  }

  return groups.map((group) => {
    const tags = [
      ...(group.style_tags ?? []),
      ...(group.industry_tags ?? []),
      ...(group.use_cases ?? []),
      ...(group.audience_tags ?? []),
      ...(group.tone_tags ?? []),
    ];
    const tagText = tags.length > 0 ? ` 标签：${tags.join(" / ")}。` : "";
    return `- \`${group.group_id}\`：${group.group_name}。${group.group_description} 布局数：${group.layout_count}。来源：${group.source.type}。${tagText}`;
  }).join("\n");
}

function relativeFromPromote(projectDir: string, filePath: string): string {
  return path.relative(resolvePromoteDir(projectDir), filePath) || path.basename(filePath);
}

function collectSourceFiles(projectDir: string): Record<string, string> {
  const files: Record<string, string> = {
    task: getTaskFilePath(projectDir),
    state: getStateFilePath(projectDir),
    currentPage: getCurrentPageFilePath(projectDir),
    requirements: getRequirementsFilePath(projectDir),
    outline: getOutlineFilePath(projectDir),
    pagePlan: getPagePlanFilePath(projectDir),
    artifacts: getArtifactsFilePath(projectDir),
  };

  const templateDir = path.join(projectDir, "template");
  const templateGroupFile = path.join(templateDir, "group.json");
  if (existsSync(templateGroupFile)) {
    files.templateGroup = templateGroupFile;
    files.templateManifest = path.join(templateDir, "manifest.json");
    files.templateCatalog = path.join(templateDir, "catalog.json");
    files.templateSlidesReadme = path.join(templateDir, "slides", "README.md");
    files.templateComponentsReadme = path.join(templateDir, "components", "README.md");
  }

  return files;
}

function getPromoteKind(opened: OpenTaskProjectResult): TaskPromoteKind {
  if (opened.state.deckState === "failed" || !opened.state.recoverable) {
    return "recovery";
  }

  if (opened.state.deckState === "page_iteration_active") {
    return opened.currentPage?.pageId ? "page" : "recovery";
  }

  return "deck";
}

function getCurrentPagePlanItem(
  pagePlan: TaskPagePlanRecord | null,
  currentPage: TaskCurrentPageRecord | null,
): TaskPagePlanItem | null {
  if (!pagePlan || !currentPage) {
    return null;
  }

  return pagePlan.pages.find((page) => page.pageId === currentPage.pageId) ?? null;
}

function getFirstPagePlanItem(pagePlan: TaskPagePlanRecord | null): TaskPagePlanItem | null {
  return pagePlan?.pages[0] ?? null;
}

function getPageProgressGuidance(currentPage: TaskCurrentPageRecord | null): string[] {
  switch (currentPage?.pageState) {
    case "page_selected":
      return [
        "阅读当前页从大纲派生出的页面骨架，以及模板工作副本中的 `slides/README.md`、`components/README.md`。",
        "在当前页阶段再决定具体组件、布局和视觉表达，然后修改 TSX、必要的数据 JSON 或共享组件。",
        "完成页面实现后调用 `record_page_progress`，把 `page_state` 记录为 `page_authoring`。",
      ];
    case "page_authoring":
      return [
        "继续完成当前页 TSX 和数据修改。",
        "生成单页预览 PNG。",
        "渲染完成后调用 `record_page_progress`，把 `page_state` 记录为 `page_rendered`，并写入渲染产物路径。",
      ];
    case "page_rendered":
      return [
        "读取最近一次 PNG 预览。",
        "检查文字溢出、遮挡、空白、错位、图表比例和视觉层级。",
        "开始自审时调用 `record_page_progress`，把 `page_state` 记录为 `page_review_pending`。",
      ];
    case "page_review_pending":
      return [
        "根据 PNG 自审结果决定继续修复还是接受当前页。",
        "如果发现问题，调用 `record_page_progress` 记录 `page_fix_required` 并写入 `review_notes`。",
        "如果通过自审，调用 `record_page_progress` 记录 `page_accepted`。",
      ];
    case "page_fix_required":
      return [
        "按 `review_notes` 修改当前页 TSX、数据或组件。",
        "修改后重新渲染单页 PNG。",
        "再次调用 `record_page_progress` 进入 `page_authoring` 或后续渲染状态。",
      ];
    case "page_accepted":
      return [
        "确认当前页已经通过自审。",
        "调用 `record_page_progress` 将当前页推进到 `page_locked`。",
        "如果还有未锁定页面，继续用 `start_page_iteration` 选择下一页。",
      ];
    case "page_locked":
      return [
        "当前页已锁定，不要继续直接修改这一页。",
        "检查是否还有未锁定页面。",
        "如需修改已锁定页，先通过回退、分支或重新选择页面处理。",
      ];
    default:
      return [
        "确认当前页是否已经选定。",
        "如果没有当前页，先调用 `start_page_iteration`。",
        "如果当前页状态损坏，先运行 `validate_task_project` 或 `recover_task_project`。",
      ];
  }
}

function getDeckStageGuidance(context: PromoteRenderContext): string[] {
  const { opened } = context;

  switch (opened.state.deckState) {
    case "initialized":
    case "project_ready":
      return [
        `先检查已有需求记录：\`${context.sourceFiles.requirements}\`。如果文件不存在，就从用户原始请求开始建立第一版需求。`,
        "对已有字段只做确认和补充，不要无理由覆盖用户已经确认的内容。",
        "必须确认主题、受众、使用场景和页数；建议同时确认语言、语气、视觉偏好、必须覆盖的信息和用户素材。",
        "需求完整后调用 `record_requirements`，默认使用 `mode: \"merge\"` 只更新本次确认字段；只有用户明确要求重写全部需求时才使用 `mode: \"replace_all\"`。",
      ];
    case "requirements_collected":
      return [
        "读取 `requirements.json`，确认主题、受众、页数、语气和素材约束。",
        "调用 `listDiscoveredTemplateGroupSummaries` 列出当前全部可用模板组，不要由 Agent 直接替用户拍板。",
        "把完整模板组选项展示给用户，让用户明确确认要使用的 `template_group`。",
        "用户确认后调用 `record_template_selection`，它会记录所选模板组并直接 fork 到 `template/`，然后进入 `project_forked`。",
      ];
    case "template_selected":
      return [
        "确认已选模板组 id/name 和来源。",
        "如果还停在这个中间态，优先检查是否漏掉了 fork 步骤。",
        "正常主线应直接由 `record_template_selection` 进入 `project_forked`。",
      ];
    case "project_forked":
      return [
        "先读取 `requirements.json`，把 `pageCount` 当作大纲页数的硬约束，不要多写或少写。",
        "再读取模板工作副本中的 `template/group.json`、`template/manifest.json`、`template/catalog.json`、`template/slides/README.md` 和 `template/components/README.md`，理解模板可用的页面族、组件家族和表达边界。",
        "先生成整套 deck 的叙事大纲，不要直接开始写全部页面 TSX，也不要提前把实现细节锁死。",
        "大纲要写成可给用户审阅的草案：先定叙事主线和章节，再按页列出每页的标题、目标和核心信息。",
        "大纲确认后，系统会自动生成页面骨架；这里不需要再额外做一轮全 deck 的 `page_plan` 规划。",
        "如果需求页数和内容冲突，先和用户确认是否需要改需求，再改大纲。",
        "确认无误后再调用 `record_outline`。",
      ];
    case "outline_ready":
      return [
        "读取 `outline.json`，确认它已经覆盖所有页数和核心信息。",
        "页面骨架已经由系统自动生成，这不是新的 deck 级规划阶段，不要再单独做一轮全局 `page_plan`。",
        "现在的重点是直接进入第一页的精细生成，而不是继续扩展整套 deck 的计划。",
        "如果大纲与需求冲突，回到需求层修正；如果大纲无误，直接开始逐页实现。",
      ];
    case "page_plan_ready":
      return [
        "读取自动生成的页面骨架，确认它只是从大纲派生出来的内部结构。",
        "不要把这里当成新的 deck 级规划阶段；现在只需要选第一页并开始逐页精细生成。",
        "调用 `start_page_iteration` 设置当前页。",
        "进入逐页实现后，每一页都要经过修改、单页渲染、PNG 自审、修复或接受、锁定。",
      ];
    case "page_iteration_active":
      return [
        "当前处于逐页实现阶段，但没有可用的当前页文档。",
        "先检查 `current-page.json` 和 `page-plan.json` 是否一致。",
        "如果没有当前页，调用 `start_page_iteration` 选择下一页。",
      ];
    case "deck_html_ready":
      return [
        "整套 deck HTML 已经生成。",
        "让用户先审阅 `output/deck.html`，不要直接导出 PPTX。",
        "用户确认后再推进到 `deck_review_pending` 或 `deck_reviewed`。",
      ];
    case "deck_review_pending":
      return [
        "等待用户对 HTML 审阅稿给出明确意见。",
        "如果用户要求修改，回退到合适的页面或分支继续调整。",
        "如果用户确认通过，记录确认并推进到 `deck_reviewed`。",
      ];
    case "deck_reviewed":
      return [
        "HTML 已通过用户确认。",
        "可以把 deck HTML 转换为 PPT 中间模型。",
        "生成模型后记录工件并推进到 `model_ready`。",
      ];
    case "model_ready":
      return [
        "PPT 中间模型已经生成。",
        "可以生成最终 PPTX。",
        "生成后记录 PPTX 工件并推进到 `pptx_ready`。",
      ];
    case "pptx_ready":
      return [
        "最终 PPTX 已经生成。",
        "确认文件路径、版本和用户是否还需要修改。",
        "没有后续修改时推进到 `completed`。",
      ];
    case "completed":
      return [
        "任务已经完成。",
        "除非用户要求修改、分支或回退，否则不要继续推进主线。",
      ];
    case "failed":
      return [
        "项目处于失败状态。",
        "先读取失败上下文和校验结果。",
        "优先调用 `validate_task_project` 判断问题，再决定是否调用 `recover_task_project`。",
      ];
    default:
      return ["- 无。"];
  }
}

function getRecommendedToolCall(context: PromoteRenderContext): unknown {
  const projectDir = context.opened.projectDir;
  const currentPage = context.opened.currentPage;
  const pagePlanItem = getCurrentPagePlanItem(context.opened.pagePlan, currentPage)
    ?? getFirstPagePlanItem(context.opened.pagePlan);

  switch (context.action.type) {
    case "collect_requirements":
      return {
        tool: "record_requirements",
        arguments: {
          project_dir: projectDir,
          mode: "merge",
          requirements: {
            topic: "<用户确认的主题>",
            audience: "<目标受众>",
            scenario: "<使用场景>",
            pageCount: "<页数，数字>",
            tone: "<语气或风格，可选>",
            language: "<语言，可选>",
            mustCover: ["<必须覆盖的信息，可选>"],
          },
          source: "user",
        },
      };
    case "write_outline":
      return {
        tool: "record_outline",
        arguments: {
          project_dir: projectDir,
          outline: {
            narrative: "<整套 deck 的叙事主线>",
            sections: ["<章节 1>", "<章节 2>"],
            pages: [
              {
                pageId: "slide-01",
                pageNumber: 1,
                title: "<页面标题>",
                goal: "<页面目标>",
                coreMessage: "<核心信息>",
              },
            ],
          },
        },
      };
    case "select_template_group":
      return {
        tool: "record_template_selection",
        arguments: {
          project_dir: projectDir,
          template_group: "<用户确认的 template_group>",
          selection_reason: "<用户确认或 Agent 解释的选择理由>",
          source: "user",
        },
      };
    case "fork_template_group":
      return {
        tool: "advance_task_state",
        arguments: {
          project_dir: projectDir,
          target_deck_state: "project_forked",
          reason: "模板组已经 fork 到当前任务目录。",
        },
      };
    case "write_page_plan":
      return {
        tool: "record_page_plan",
        arguments: {
          project_dir: projectDir,
          mode: "replace_all",
          page_plan: {
            pages: [
              {
                pageId: "slide-01",
                pageNumber: 1,
                title: "<页面标题>",
                goal: "<页面目标>",
                coreMessage: "<核心信息>",
                suggestedExpression: "<建议表达形态>",
                candidateComponentFamilies: ["<候选组件家族>"],
                openQuestions: [],
              },
            ],
          },
        },
      };
    case "start_page_authoring":
      return {
        tool: "start_page_iteration",
        arguments: {
          project_dir: projectDir,
          page_id: pagePlanItem?.pageId ?? "<page_id>",
          page_number: pagePlanItem?.pageNumber ?? "<page_number>",
        },
      };
    case "render_current_page":
    case "review_page_png":
    case "fix_current_page":
    case "lock_current_page":
      return {
        tool: "record_page_progress",
        arguments: {
          project_dir: projectDir,
          page_id: currentPage?.pageId ?? "<page_id>",
          page_state: "<page_authoring | page_rendered | page_review_pending | page_fix_required | page_accepted | page_locked>",
          summary: "<本轮页面实现、渲染或审查摘要>",
          review_notes: "<PNG 自审结论，可选>",
          changed_files: ["<本轮修改的 TSX/JSON 文件，可选>"],
          rendered_html_path: "<单页 HTML 路径，可选>",
          rendered_png_path: "<单页 PNG 路径，可选>",
        },
      };
    case "request_deck_html_approval":
      return {
        tool: "advance_task_state",
        arguments: {
          project_dir: projectDir,
          target_deck_state: "deck_review_pending",
          reason: "deck.html 已生成，需要用户审阅确认。",
        },
      };
    case "convert_deck_html_to_model":
      return {
        tool: "advance_task_state",
        arguments: {
          project_dir: projectDir,
          target_deck_state: "model_ready",
          reason: "HTML 审阅已通过，PPT 中间模型已生成。",
        },
      };
    case "generate_pptx":
      return {
        tool: "advance_task_state",
        arguments: {
          project_dir: projectDir,
          target_deck_state: "pptx_ready",
          reason: "最终 PPTX 已生成。",
        },
      };
    case "complete_task":
      return {
        tool: "advance_task_state",
        arguments: {
          project_dir: projectDir,
          target_deck_state: "completed",
          reason: "任务已经完成并准备归档。",
        },
      };
    case "recover_from_failure":
      return {
        tool: "recover_task_project",
        arguments: {
          project_dir: projectDir,
        },
      };
    default:
      return {
        tool: "advance_task_state",
        arguments: {
          project_dir: projectDir,
          target_deck_state: "<目标 deck 状态>",
          reason: "<为什么可以推进>",
        },
      };
  }
}

function buildKnownFacts(context: PromoteRenderContext): string[] {
  const { opened, requirements, outline } = context;
  const currentPage = opened.currentPage;
  const pagePlan = opened.pagePlan;

  return [
    `项目：\`${opened.task.title ?? opened.task.projectId}\``,
    `项目目录：\`${opened.projectDir}\``,
    `deck 状态：\`${opened.state.deckState}\``,
    `page 状态：\`${opened.state.pageState ?? "none"}\``,
    `当前页：\`${currentPage?.pageId ?? "none"}\``,
    `已选模板组：${opened.state.selectedTemplateGroupId ? `\`${opened.state.selectedTemplateGroupId}\`${opened.state.selectedTemplateGroupName ? `（${opened.state.selectedTemplateGroupName}）` : ""}` : "未选择"}`,
    `需求记录：${requirements ? `已存在，更新时间 \`${requirements.updatedAt}\`` : "未找到"}`,
    `大纲记录：${outline ? `已存在，页面数 ${outline.outline.pages.length}` : "未找到"}`,
    `页面计划：${pagePlan ? `已存在，页面数 ${pagePlan.pages.length}` : "未找到"}`,
    `工件索引：${opened.artifacts ? `已存在，工件数 ${opened.artifacts.artifacts.length}` : "未找到"}`,
  ];
}

function buildRequirementsStatus(requirements: TaskRequirementsRecord | null): string {
  if (!requirements) {
    return [
      "- 当前还没有 `requirements.json`。",
      "- 需要向用户确认主题、受众、场景和页数。",
      "- 建议同时确认语言、语气、视觉偏好、必须覆盖的信息和用户素材路径。",
      "- 记录完成后，调用 `record_requirements` 写入结构化需求。",
    ].join("\n");
  }

  return [
    `- 需求文件：\`${requirements.updatedAt}\` 更新。`,
    "- 已有需求内容：",
    formatJson(requirements.requirements),
    "- 不要无理由覆盖已有字段；只追问缺失或含糊的信息。",
    "- 确认过的字段应直接沿用到后续大纲和页面计划里。",
  ].join("\n");
}

function buildRequirementsPromoteChecklist(requirements: TaskRequirementsRecord | null): string[] {
  if (!requirements) {
    return [
      "先读 `task-state/requirements.json`，确认有没有已有需求。",
      "如果没有 `requirements.json`，优先向用户收集主题、受众、场景和页数。",
      "补充确认语言、语气、必须覆盖的信息和用户素材约束。",
      "把最终确认结果通过 `record_requirements` 写入，使用 `mode: \"merge\"`。",
      "当前项目还没有结构化需求，不能直接进入大纲阶段。",
    ];
  }

  const payload = requirements.requirements;
  return [
    "先复核现有结构化需求，不要直接覆盖。",
    `当前主题：${payload.topic || "未填"}`,
    `当前受众：${payload.audience || "未填"}`,
    `当前场景：${payload.scenario || "未填"}`,
    `当前页数：${payload.pageCount ?? "未填"}`,
    payload.tone ? `当前语气：${payload.tone}` : "语气未明确，需要确认。",
    payload.language ? `当前语言：${payload.language}` : "语言未明确，需要确认。",
    payload.mustCover?.length
      ? `必须覆盖的信息：${payload.mustCover.join(" / ")}`
      : "必须覆盖的信息尚未补齐。",
    "补充或修正单个字段时调用 `record_requirements` 并使用 `mode: \"merge\"`，保留未提到的既有字段。",
    "只有用户明确要求废弃原需求并重写时，才调用 `record_requirements` 并使用 `mode: \"replace_all\"`。",
    "如果已有内容和用户新意图冲突，优先解释冲突并重新确认，而不是直接写死。",
  ];
}

function buildOutlineStatus(outline: TaskOutlineRecord | null): string {
  if (!outline) {
    return [
      "- 当前还没有 `outline.json`。",
      "- 需要先把需求转成叙事主线、章节和页面列表。",
      "- 大纲确认后再进入页面计划。",
    ].join("\n");
  }

  return [
    `- 大纲更新时间：\`${outline.updatedAt}\``,
    `- 叙事主线：${outline.outline.narrative}`,
    `- 章节数：${outline.outline.sections.length}`,
    `- 页面数：${outline.outline.pages.length}`,
    "- 大纲页面预览：",
    formatJson(outline.outline.pages.slice(0, 3)),
  ].join("\n");
}

function buildOutlinePromoteChecklist(outline: TaskOutlineRecord | null): string[] {
  if (!outline) {
    return [
      "先读需求和模板工作副本，明确主题、受众、场景、页数和模板表达边界。",
      "先写整套 deck 的叙事主线，再拆成章节和逐页结构。",
      "每一页都要写清 `pageId`、`pageNumber`、`title`、`goal` 和 `coreMessage`。",
      "页数必须严格等于 `requirements.pageCount`，不能多也不能少。",
      "不要直接生成 TSX，也不要把组件实现细节写进大纲。",
      "先把大纲草案给用户确认，再调用 `record_outline`。",
    ];
  }

  return [
    "先检查 `outline.json` 里的叙事主线是否和需求一致。",
    `当前章节：${outline.outline.sections.join(" / ") || "未填"}`,
    `当前页面数：${outline.outline.pages.length}`,
    "确认每页是否都承担了不同职责，避免两页说同一件事。",
    "确认每页标题、目标和核心信息是否足够支撑后续页面计划。",
    "如果要调整页数或章节顺序，先回到需求层解释原因，再更新大纲。",
    "大纲确认后，系统会自动生成页面骨架，不需要再单独调用 `record_page_plan` 做一轮全局规划。",
  ];
}

function buildOutlineQualityStandards(requirements: TaskRequirementsRecord | null): string[] {
  const pageCount = requirements?.requirements.pageCount;
  return [
    pageCount ? `页数必须等于 \`${pageCount}\`` : "页数必须和需求确认结果一致。",
    "章节顺序要服务于整套 deck 的教学或讲述节奏。",
    "每页只保留一个核心信息，不要把多页内容塞进同一页。",
    "标题要具体、可审阅，能看出这页在整个 deck 里的作用。",
    "内容要符合目标受众、使用场景、语气和语言。",
    "模板信息只能用来约束表达方式和可复用组件，不要提前锁死 TSX 实现。",
    "在调用 `record_outline` 前，先把草案展示给用户确认。",
  ];
}

function buildPagePlanStatus(
  pagePlan: TaskPagePlanRecord | null,
  currentPage: TaskCurrentPageRecord | null,
): string {
  if (!pagePlan) {
    return [
      "- 当前还没有自动生成的页面骨架。",
      "- 需要先完成大纲，系统才会派生出每页的内部骨架。",
    ].join("\n");
  }

  const currentPageItem = getCurrentPagePlanItem(pagePlan, currentPage);
  return [
    `- 页面骨架更新时间：\`${pagePlan.updatedAt}\``,
    `- 骨架页数：${pagePlan.pages.length}`,
    `- 当前页骨架：${currentPageItem?.pageId ?? "未选定"}`,
    "- 前几页骨架预览：",
    formatJson(pagePlan.pages.slice(0, 3)),
  ].join("\n");
}

function buildPagePlanPromoteChecklist(
  pagePlan: TaskPagePlanRecord | null,
  currentPage: TaskCurrentPageRecord | null,
): string[] {
  if (!pagePlan) {
    return [
      "先让系统根据 outline 自动生成页面骨架。",
      "每页至少写清 pageId、pageNumber、title、goal、coreMessage。",
      "如果需要进一步补充，也只是在这个骨架上做局部修补，不要把它升级成新的 deck 级规划。",
    ];
  }

  const currentPageItem = getCurrentPagePlanItem(pagePlan, currentPage);
  return [
    "先读自动生成的页面骨架，不要把它当成新的 deck 级规划阶段。",
    currentPageItem
      ? `当前页骨架：${currentPageItem.pageId} / ${currentPageItem.title}`
      : "当前还没有选定页，需要先通过 `start_page_iteration` 选页。",
    "如果骨架里缺少候选组件方向或表达形态，只做当前页的局部补充，不要回到全 deck 规划。",
    "确认后直接进入 `start_page_iteration` 或当前页实现。",
  ];
}

function buildDeckStageChecklist(context: PromoteRenderContext): string[] {
  switch (context.action.type) {
    case "collect_requirements":
      return buildRequirementsPromoteChecklist(context.requirements);
    case "write_outline":
      return buildOutlinePromoteChecklist(context.outline);
    case "write_page_plan":
      return buildPagePlanPromoteChecklist(context.opened.pagePlan, context.opened.currentPage);
    case "start_page_authoring":
      return [
        "读取自动生成的页面骨架，确认它只是从大纲派生出来的内部结构。",
        "选择第一页未锁定或最适合作为起点的页面。",
        "调用 `start_page_iteration` 后，后续 query 会生成 page 级 promote 文档。",
      ];
    case "select_template_group":
      return [
        "先调用 `listDiscoveredTemplateGroupSummaries` 获取当前全部可用模板组。",
        "把模板组清单完整展示给用户，并结合需求简要说明各组选项的差异。",
        "等待用户明确确认一个 `template_group`，不要由 Agent 直接替用户决定。",
        "用户确认后调用 `record_template_selection`，它会记录模板选择、fork 模板组到 `template/`，并推进到 `project_forked`。",
      ];
    case "fork_template_group":
      return [
        "确认已选模板组。",
        "把模板组 fork 到项目 `template/` 工作副本。",
        "确认 `manifest.json`、`catalog.json`、`slides/`、`components/` 可读后推进。",
      ];
    case "request_deck_html_approval":
      return [
        "确认 `output/deck.html` 已生成并可打开。",
        "让用户审阅整套 HTML，而不是只看 PPTX。",
        "用户确认前不要进入模型或 PPTX 导出。",
      ];
    case "recover_from_failure":
      return [
        "先运行 `validate_task_project`。",
        "只有确认是可修复状态后再运行 `recover_task_project`。",
        "恢复后重新 query，按新生成的 promote 文档继续。",
      ];
    default:
      return getDeckStageGuidance(context);
  }
}

function buildPageSummary(
  currentPage: TaskCurrentPageRecord | null,
  pagePlanItem: TaskPagePlanItem | null,
  artifacts: TaskArtifactIndexRecord | null,
): string {
  if (!currentPage) {
    return [
      "- 当前没有选中的页面。",
      "- 需要先调用 `start_page_iteration`。",
    ].join("\n");
  }

  const pageArtifacts = (artifacts?.artifacts ?? [])
    .filter((artifact) => artifact.pageId === currentPage.pageId && artifact.valid)
    .map((artifact) => `${artifact.type}: ${artifact.path}`);

  return [
    `- 当前页：\`${currentPage.pageId}\``,
    `- 页码：${currentPage.pageNumber ?? pagePlanItem?.pageNumber ?? "未知"}`,
    `- 页状态：\`${currentPage.pageState}\``,
    `- 页面标题：${pagePlanItem?.title ?? "未记录"}`,
    `- 页面目标：${pagePlanItem?.goal ?? "未记录"}`,
    `- 核心信息：${pagePlanItem?.coreMessage ?? "未记录"}`,
    `- 最近 PNG：${currentPage.lastRenderedPngPath ? `\`${currentPage.lastRenderedPngPath}\`` : "无"}`,
    `- 页级有效工件：\n${formatList(pageArtifacts)}`,
  ].join("\n");
}

function buildDeckPromoteMarkdown(context: PromoteRenderContext): string {
  const { opened, action } = context;
  const guidance = getDeckStageGuidance(context);

  return [
    `# Deck 阶段行动说明：${opened.state.deckState}`,
    "",
    "## 当前阶段",
    "",
    `当前 deck 状态是 \`${opened.state.deckState}\`。`,
    "",
    "## 本阶段目标",
    "",
    action.summary,
    "",
    "## 必读文件",
    "",
    formatCodeList(Object.values(context.sourceFiles)),
    "",
    "## 已知事实",
    "",
    formatList(buildKnownFacts(context)),
    "",
    "## 需求状态",
    "",
    buildRequirementsStatus(context.requirements),
    ...(context.availableTemplateGroups.length > 0 ? [
      "",
      "## 可用模板组",
      "",
      formatTemplateGroupOptions(context.availableTemplateGroups),
    ] : []),
    "",
    "## 大纲状态",
    "",
    buildOutlineStatus(context.outline),
    ...(action.type === "write_outline" ? [
      "",
      "## 大纲质量标准",
      "",
      formatList(buildOutlineQualityStandards(context.requirements)),
    ] : []),
    "",
    "## 页面骨架状态",
    "",
    buildPagePlanStatus(context.opened.pagePlan, context.opened.currentPage),
    "",
    "## 本阶段执行清单",
    "",
    formatList(buildDeckStageChecklist(context)),
    "",
    "## 尚未确认的信息",
    "",
    formatCodeList(action.requiredInputs),
    "",
    "## 推荐操作顺序",
    "",
    formatList(guidance),
    "",
    "## 推荐调用的子工具",
    "",
    formatJson(getRecommendedToolCall(context)),
    "",
    "## 进入下一阶段的条件",
    "",
    formatList(action.allowedOperations.map((operation) => `当前允许推进到 \`${operation}\``)),
    "",
    "## 失败或回退处理",
    "",
    "- 如果状态文件缺失或不一致，先调用 `validate_task_project`。",
    "- 如果校验提示可恢复，再调用 `recover_task_project`。",
    "- 如果用户要求修改已确认内容，优先使用回退或分支，不要直接覆盖历史。",
  ].join("\n");
}

function buildPagePromoteMarkdown(context: PromoteRenderContext): string {
  const currentPage = context.opened.currentPage;
  const pagePlanItem = getCurrentPagePlanItem(context.opened.pagePlan, currentPage);
  const guidance = getPageProgressGuidance(currentPage);

  return [
    `# Page 阶段行动说明：${currentPage?.pageId ?? "unknown"}`,
    "",
    "## 当前阶段",
    "",
    `当前 deck 状态是 \`${context.opened.state.deckState}\`，page 状态是 \`${currentPage?.pageState ?? "none"}\`。`,
    "",
    "## 本阶段目标",
    "",
    "只打磨当前这一页。不要一次性改完整套 deck。",
    "",
    "## 必读文件",
    "",
    formatCodeList([
      context.sourceFiles.currentPage,
      context.sourceFiles.pagePlan,
      context.sourceFiles.artifacts,
      path.join(context.opened.projectDir, "template", "slides", "README.md"),
      path.join(context.opened.projectDir, "template", "components", "README.md"),
    ]),
    "",
    "## 当前页事实",
    "",
    buildPageSummary(currentPage, pagePlanItem, context.opened.artifacts),
    "",
    "## 当前页骨架",
    "",
    pagePlanItem ? formatJson(pagePlanItem) : "- `page-plan.json` 中没有找到当前页条目。",
    "",
    "## 页面骨架概览",
    "",
    buildPagePlanStatus(context.opened.pagePlan, currentPage),
    "",
    "## 本阶段执行清单",
    "",
    formatList(buildPagePlanPromoteChecklist(context.opened.pagePlan, currentPage)),
    "",
    "## 推荐操作顺序",
    "",
    formatList(guidance),
    "",
    "## 截图自审要求",
    "",
    formatList([
      "检查文字是否溢出、遮挡或过小。",
      "检查标题、图表、注释和页脚是否重叠。",
      "检查画面是否空白、比例失衡或视觉重心不稳定。",
      "检查组件使用是否符合模板 README 和当前页表达目标。",
      "如果不通过，记录 `page_fix_required` 并继续修改；通过后记录 `page_accepted`，再锁定页面。",
    ]),
    "",
    "## 推荐调用的子工具",
    "",
    formatJson(getRecommendedToolCall(context)),
    "",
    "## 进入下一阶段的条件",
    "",
    formatList(context.action.allowedOperations.map((operation) => `当前允许推进到 \`${operation}\``)),
    "",
    "## 失败或回退处理",
    "",
    "- 如果当前页和页面计划对不上，先运行 `validate_task_project`。",
    "- 如果用户要求改已锁定页面，优先回退到该页检查点或创建分支。",
    "- 不要在没有 PNG 自审的情况下直接锁定页面。",
  ].join("\n");
}

function buildRecoveryPromoteMarkdown(context: PromoteRenderContext): string {
  return [
    "# Recovery 行动说明",
    "",
    "## 当前阶段",
    "",
    `当前 deck 状态是 \`${context.opened.state.deckState}\`，recoverable 为 \`${context.opened.state.recoverable}\`。`,
    "",
    "## 本阶段目标",
    "",
    "先恢复可继续推进的可信状态，不要直接生成新工件。",
    "",
    "## 必读文件",
    "",
    formatCodeList(Object.values(context.sourceFiles)),
    "",
    "## 阻塞原因",
    "",
    formatCodeList(context.opened.state.blockedBy),
    "",
    "## 推荐操作顺序",
    "",
    formatList([
      "先调用 `validate_task_project` 判断损坏范围。",
      "如果只是可修复的派生信息缺失，可以重新运行 `query_task_state` 生成 `promote/`。",
      "如果主状态文件缺失或不一致，再调用 `recover_task_project`。",
      "恢复后重新调用 `query_task_state`，按新的 `promote` 文档继续。",
    ]),
    "",
    "## 推荐调用的子工具",
    "",
    formatJson(getRecommendedToolCall(context)),
  ].join("\n");
}

function buildCurrentMarkdown(
  projectDir: string,
  reference: TaskPromoteDocumentReference,
  action: PromoteActionContext,
  generatedAt: string,
): string {
  const relativeDocument = relativeFromPromote(projectDir, reference.path);

  return [
    "# 当前行动入口",
    "",
    `- 当前阶段：\`${reference.stage}\``,
    `- 文档类型：\`${reference.kind}\``,
    `- 推荐动作：${action.summary}`,
    `- 必须先读：\`${relativeDocument}\``,
    `- 生成时间：\`${generatedAt}\``,
    "",
    "## 阅读顺序",
    "",
    `1. 先打开 \`${relativeDocument}\`。`,
    "2. 按阶段文档里的“推荐操作顺序”执行。",
    "3. 需要写入状态时，只通过状态机子工具写入，不要手工改 `task-state/*.json`。",
  ].join("\n");
}

function buildTemplateMarkdown(kind: "deck" | "page" | "recovery"): string {
  return [
    `# ${kind} promote 模板`,
    "",
    "每份 promote 文档都应包含：",
    "",
    "- 当前阶段。",
    "- 本阶段目标。",
    "- 必读文件。",
    "- 已知事实。",
    "- 尚未确认的信息。",
    "- 推荐操作顺序。",
    "- 推荐调用的子工具。",
    "- 进入下一阶段的条件。",
    "- 失败或回退处理。",
  ].join("\n");
}

async function writePromoteTemplates(projectDir: string): Promise<void> {
  const templatesDir = resolvePromoteTemplatesDir(projectDir);
  await mkdir(templatesDir, { recursive: true });
  await writeFile(path.join(templatesDir, "deck.md"), `${buildTemplateMarkdown("deck")}\n`, "utf8");
  await writeFile(path.join(templatesDir, "page.md"), `${buildTemplateMarkdown("page")}\n`, "utf8");
  await writeFile(path.join(templatesDir, "recovery.md"), `${buildTemplateMarkdown("recovery")}\n`, "utf8");
}

function buildReference(
  opened: OpenTaskProjectResult,
  kind: TaskPromoteKind,
): TaskPromoteDocumentReference {
  const projectDir = opened.projectDir;
  const entryPath = resolvePromoteCurrentFilePath(projectDir);
  const manifestPath = resolvePromoteManifestFilePath(projectDir);

  if (kind === "page" && opened.currentPage?.pageId) {
    const pageId = opened.currentPage.pageId;
    return {
      kind,
      version: PROMOTE_VERSION,
      freshness: "fresh",
      readBeforeAction: true,
      stage: `${opened.state.deckState}:${opened.currentPage.pageState}`,
      path: resolvePromotePageFilePath(projectDir, sanitizeFileSegment(pageId)),
      entryPath,
      manifestPath,
      pageId,
      pageNumber: opened.currentPage.pageNumber,
    };
  }

  if (kind === "recovery") {
    return {
      kind,
      version: PROMOTE_VERSION,
      freshness: "fresh",
      readBeforeAction: true,
      stage: "recovery",
      path: resolvePromoteRecoveryFilePath(projectDir),
      entryPath,
      manifestPath,
      pageId: opened.currentPage?.pageId,
      pageNumber: opened.currentPage?.pageNumber,
    };
  }

  return {
    kind: "deck",
    version: PROMOTE_VERSION,
    freshness: "fresh",
    readBeforeAction: true,
    stage: opened.state.deckState,
    path: resolvePromoteDeckFilePath(projectDir, `${opened.state.deckState}.md`),
    entryPath,
    manifestPath,
    pageId: opened.currentPage?.pageId,
    pageNumber: opened.currentPage?.pageNumber,
  };
}

function buildManifest(
  context: PromoteRenderContext,
  reference: TaskPromoteDocumentReference,
): TaskPromoteManifestRecord {
  return {
    projectId: context.opened.projectId,
    updatedAt: context.generatedAt,
    version: PROMOTE_VERSION,
    kind: reference.kind,
    deckState: context.opened.state.deckState,
    pageState: context.opened.state.pageState,
    currentPageId: context.opened.currentPage?.pageId,
    currentPath: reference.entryPath,
    documentPath: reference.path,
    manifestPath: reference.manifestPath,
    sourceUpdatedAt: context.opened.state.updatedAt,
    sourceFiles: context.sourceFiles,
  };
}

export async function ensureTaskPromoteDocument(
  opened: OpenTaskProjectResult,
  action: PromoteActionContext,
): Promise<TaskPromoteDocumentReference> {
  const projectDir = opened.projectDir;
  const kind = getPromoteKind(opened);
  const reference = buildReference(opened, kind);
  const generatedAt = nowIso();
  const sourceFiles = collectSourceFiles(projectDir);
  const requirements = await readOptionalRequirementsRecord(projectDir);
  const outline = await readOptionalOutlineRecord(projectDir);

  await mkdir(resolvePromoteDir(projectDir), { recursive: true });
  await mkdir(resolvePromoteDeckDir(projectDir), { recursive: true });
  await mkdir(resolvePromotePagesDir(projectDir), { recursive: true });
  await writePromoteTemplates(projectDir);

  const context: PromoteRenderContext = {
    opened,
    requirements,
    outline,
    action,
    availableTemplateGroups: action.availableTemplateGroups ?? [],
    generatedAt,
    sourceFiles,
  };

  const markdown = kind === "page"
    ? buildPagePromoteMarkdown(context)
    : kind === "recovery"
      ? buildRecoveryPromoteMarkdown(context)
      : buildDeckPromoteMarkdown(context);

  await writeFile(reference.path, `${markdown}\n`, "utf8");
  await writeFile(
    reference.entryPath,
    `${buildCurrentMarkdown(projectDir, reference, action, generatedAt)}\n`,
    "utf8",
  );
  await writeJsonObject(reference.manifestPath, buildManifest(context, reference));

  return reference;
}
