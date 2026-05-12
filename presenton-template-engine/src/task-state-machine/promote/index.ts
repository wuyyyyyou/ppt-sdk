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
const PROMOTE_RULES_DIRNAME = "rules";

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

function resolvePromoteRulesDir(projectDir: string): string {
  return path.join(resolvePromoteDir(projectDir), PROMOTE_RULES_DIRNAME);
}

function resolvePromoteRuleFilePath(projectDir: string, fileName: string): string {
  return path.join(resolvePromoteRulesDir(projectDir), fileName);
}

function getPromoteRuleFilePaths(projectDir: string): Record<string, string> {
  return {
    manifestSpec: resolvePromoteRuleFilePath(projectDir, "ppt-manifest-spec.md"),
    tsxAuthoring: resolvePromoteRuleFilePath(projectDir, "ppt-tsx-authoring.md"),
    tsxExportRules: resolvePromoteRuleFilePath(projectDir, "ppt-tsx-export-rules.md"),
  };
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
    files.templateBlueprintsReadme = path.join(templateDir, "blueprints", "README.md");
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

function getStartPagePlanItem(
  pagePlan: TaskPagePlanRecord | null,
  currentPage: TaskCurrentPageRecord | null,
): TaskPagePlanItem | null {
  if (!pagePlan || pagePlan.pages.length === 0) {
    return null;
  }

  if (!currentPage) {
    return pagePlan.pages[0] ?? null;
  }

  const currentIndex = pagePlan.pages.findIndex((page) => page.pageId === currentPage.pageId);
  if (currentIndex < 0) {
    return pagePlan.pages[0] ?? null;
  }

  if (currentPage.locked) {
    return pagePlan.pages[currentIndex + 1] ?? null;
  }

  return pagePlan.pages[currentIndex] ?? null;
}

function toPascalCase(value: string): string {
  const parts = value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const joined = parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  if (joined.length === 0) {
    return "SlidePage";
  }

  return /^[A-Za-z]/.test(joined) ? joined : `Slide${joined}`;
}

function getPageProgressGuidance(currentPage: TaskCurrentPageRecord | null): string[] {
  switch (currentPage?.pageState) {
    case "page_selected":
      return [
        "阅读当前页作业单、页面骨架、模板 README、manifest/catalog 和 `promote/rules/*.md`。",
        "为当前页选择最贴合大纲的蓝图或现有 slide 起点，派生出当前页最终 `slides/*.tsx` 和 `data/*.json`。",
        "如果 `slides/*.tsx` 或 `data/*.json` 还不存在，先创建它们；如果已经存在，就在现有文件基础上继续精修。",
        "必须做实质改造：当前页不能长期停留在只 re-export 蓝图的状态，也不能只改 data 迁就版式。",
        "同步更新 `manifest.json`，确保当前页有稳定 slide id、title、speaker_note、local source 和 data_path。",
        "完成页面实现后调用 `record_page_progress`，把 `page_state` 记录为 `page_authoring`。",
      ];
    case "page_authoring":
      return [
        "继续完成当前页 TSX、data JSON、manifest 或必要的组件修改。",
        "调用 `buildDeckHtmlFromManifest`，使用 `single_page: true` 和当前页页码生成单页 deck HTML 与 PNG。",
        "渲染完成后调用 `record_page_progress`，把 `page_state` 记录为 `page_rendered`，并写入返回的 HTML 和当前页 PNG 路径。",
      ];
    case "page_rendered":
      return [
        "读取最近一次当前页 PNG 预览，不要只凭代码判断质量。",
        "按页面作业单里的截图审查提示词检查文字溢出、遮挡、空白、错位、图表比例、视觉层级和内容贴合度。",
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
        "检查是否还有未锁定页面；如果有，就用 `start_page_iteration` 切换到下一页。",
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

function getPageStateGuidance(): string[] {
  return [
    "`page_selected`：当前页已选中，开始读取骨架、模板和规则，准备创建或修改当前页文件；完成初始实现后记录 `page_authoring`。",
    "`page_authoring`：当前页正在实现中，允许继续修改 TSX、data、manifest 或必要组件；渲染完成后记录 `page_rendered`。",
    "`page_rendered`：当前页已经生成单页 HTML 和 PNG，等待基于截图进入自审；开始审查时记录 `page_review_pending`。",
    "`page_review_pending`：当前页 PNG 已生成，正在审查是否通过；审查后要么记录 `page_fix_required`，要么记录 `page_accepted`。",
    "`page_fix_required`：当前页自审未通过，需要根据 `review_notes` 继续修复。",
    "`page_accepted`：当前页通过自审，可以准备锁定；随后记录 `page_locked`。",
    "`page_locked`：当前页已经锁定，不应再直接编辑；如需修改，先回退或分支；如果还有未锁定页面，先切换到下一页。",
    "推荐流转：`page_selected -> page_authoring -> page_rendered -> page_review_pending -> page_fix_required / page_accepted -> page_locked`。",
  ];
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
  const startPagePlanItem = getStartPagePlanItem(context.opened.pagePlan, currentPage);
  const buildPageProgressCall = (
    pageState: string,
    summary: string,
    extras: Record<string, unknown> = {},
  ) => ({
    tool: "record_page_progress",
    arguments: {
      project_dir: projectDir,
      page_id: currentPage?.pageId ?? "<page_id>",
      page_state: pageState,
      summary,
      changed_files: ["<本轮修改的 TSX/JSON/manifest 文件，可选>"],
      ...extras,
    },
  });

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
          page_id: startPagePlanItem?.pageId ?? "<page_id>",
          page_number: startPagePlanItem?.pageNumber ?? "<page_number>",
        },
      };
    case "author_current_page":
      return buildPageProgressCall(
        "page_authoring",
        "已完成当前页 TSX、data 和 manifest 的初始实现，准备进入单页渲染。",
      );
    case "render_current_page":
      return buildPageProgressCall(
        "page_rendered",
        "已调用 buildDeckHtmlFromManifest 生成当前页单页 HTML 和 PNG。",
        {
          rendered_html_path: "<单页 HTML 路径>",
          rendered_png_path: "<单页 PNG 路径>",
        },
      );
    case "review_page_png":
      if (currentPage?.pageState === "page_rendered") {
        return buildPageProgressCall(
          "page_review_pending",
          "已开始基于当前页 PNG 做截图自审。",
          {
            review_notes: "<PNG 初步自审记录>",
          },
        );
      }

      return buildPageProgressCall(
        "<page_fix_required | page_accepted>",
        "已完成当前页 PNG 自审，并根据结果决定修复或接受。",
        {
          review_notes: "<PNG 自审结论；不通过时写明必须修复项>",
        },
      );
    case "fix_current_page":
      return buildPageProgressCall(
        "page_authoring",
        "已按 review_notes 修复当前页 TSX、data 或 manifest，准备重新渲染。",
        {
          review_notes: "<本轮修复说明>",
        },
      );
    case "lock_current_page":
      return buildPageProgressCall(
        "page_locked",
        "当前页已通过自审并锁定，不再直接修改。",
      );
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

function buildManifestRuleMarkdown(): string {
  const exampleManifest = {
    title: "Task Deck",
    theme: {
      company_name: "PPT AI Agent",
    },
    slides: [
      {
        id: "slide-01",
        title: "AI Agent 是什么",
        speaker_note: "引导用户理解 AI Agent 的基本概念。",
        source: {
          type: "local",
          path: "./slides/Slide01.tsx",
        },
        data_path: "./data/slide-01.json",
      },
    ],
  };

  return [
    "# PPT Manifest 规则",
    "",
    "## 文件职责",
    "",
    "`manifest.json` 描述一整套 deck 如何装配，它驱动 `ppt-engine.buildDeckHtmlFromManifest`。",
    "",
    "它负责：",
    "",
    "- deck 标题和默认主题",
    "- slide 顺序",
    "- 每页使用哪个 source",
    "- 每页从哪里读取数据",
    "- 每页标题和 speaker note",
    "",
    "它不负责：",
    "",
    "- 模板组发现。模板组发现依赖 `group.json` 和工具内部发现机制。",
    "- 页面结构说明。页面结构说明主要看 `catalog.json`。",
    "- TSX 组件实现。页面实现放在 `slides/*.tsx` 和 `components/*.tsx`。",
    "",
    "## 推荐结构",
    "",
    "fork 后的模板建议采用 TSX-first 的本地页面装配方式：",
    "",
    "```json",
    ...formatJson(exampleManifest).split("\n"),
    "```",
    "",
    "## 顶层字段",
    "",
    "- `title`：可选字符串，用于 deck 标题和默认输出文件名。",
    "- `theme`：可选对象，作为 deck 级默认主题。",
    "- `slides`：必填非空数组，顺序就是 deck 页面顺序。",
    "",
    "## slide 字段",
    "",
    "每个 slide 通常需要：",
    "",
    "- `id`：在整个 manifest 内唯一，推荐稳定、语义化。",
    "- `title`：当前页标题。",
    "- `speaker_note`：当前页备注。",
    "- `source`：本地页面入口。fork 后模板通常使用 `type: \"local\"`。",
    "- `data_path`：指向相对于 `manifest.json` 的数据文件。",
    "",
    "## local source 规则",
    "",
    "- `source.type` 必须是 `local`。",
    "- `source.path` 必须指向最终页面入口 `./slides/*.tsx`。",
    "- 不要把 `components/*`、`data/*` 或 `blueprints/*` 写成最终入口。",
    "- `blueprints/*.tsx` 只是基础页，不是最终 manifest 入口。",
    "",
    "## data_path 规则",
    "",
    "- 优先使用 `data_path`，让页面数据保存在 `data/*.json`。",
    "- `data_path` 相对 `manifest.json` 解析。",
    "- 数据文件顶层必须是对象。",
    "- 如果同时存在 `data_path` 和 `data`，优先使用 `data_path`。",
    "",
    "## TSX-first 蓝图模板组",
    "",
    "- `blueprints/*.tsx` 是可复制的基础页和起始结构。",
    "- `slides/*.tsx` 是最终页面，应该直接承载具体 deck 的结构、组件编排和表达。",
    "- 新 deck 优先从 `blueprints/*.tsx` 派生 `slides/*.tsx`，再在最终页面里直接修改。",
    "- 不要只改 manifest 或 data 来迁就版式；结构和表达必须在最终 slide 中解决。",
    "",
    "## 推荐示例",
    "",
    "```json",
    ...formatJson(exampleManifest.slides[0]).split("\n"),
    "```",
    "",
    "## 失败模式",
    "",
    "- manifest 指向 `blueprints/*.tsx`。",
    "- manifest 把页面结构责任推给 data。",
    "- manifest 没有同步更新 `data_path` 或 `speaker_note`。",
    "- 一个 deck 仍然依赖不稳定的临时入口。",
  ].join("\n");
}

function buildTsxAuthoringRuleMarkdown(): string {
  const exampleData = {
    title: "AI Agent 是什么",
    subtitle: "最直观的基本概念说明",
    bullets: [
      "AI Agent 不只是回答问题。",
      "AI Agent 会围绕目标执行动作。",
      "AI Agent 通常会调用工具并持续反馈。",
    ],
  };

  return [
    "# PPT TSX 编写规范",
    "",
    "## 目标",
    "",
    "本地 TSX 不是普通网页组件，而是一页可导出的 PPT slide。",
    "",
    "每个 `slides/*.tsx` 文件负责：",
    "",
    "- 接收一页 `data`",
    "- 用 `Schema` 校验和补默认值",
    "- 复用 `components/` 中的稳定组件",
    "- 输出固定 1280x720 的单页画布",
    "",
    "不要在一个 TSX 文件里生成整套 deck。",
    "",
    "## 组件优先原则",
    "",
    "页面不是固定版式模板，而是组件编排结果。",
    "",
    "写 TSX 时先想这三个问题：",
    "",
    "1. 这一页由哪些组件块组成",
    "2. 哪些组件是主结构，哪些是辅助结构",
    "3. 哪些区域是可替换槽位，哪些区域是稳定壳",
    "",
    "## 目录结构",
    "",
    "fork 后模板采用 TSX-first 蓝图结构，通常包含 `manifest.json`、`catalog.json`、`blueprints/`、`slides/`、`components/`、`data/`、`theme/` 和 `group.json`。",
    "",
    "## 必须导出",
    "",
    "每个 `slides/*.tsx` 必须导出：`Schema`、默认 React 组件、`layoutId`、`layoutName`、`layoutDescription`。",
    "",
    "推荐继续导出：`layoutTags`、`layoutRole`、`contentElements`、`useCases`、`density`、`visualWeight`、`editableTextPriority`。",
    "",
    "## 推荐骨架",
    "",
    "```tsx",
    "import React from \"react\";",
    "import * as z from \"zod\";",
    "",
    "export const Schema = z.object({",
    "  title: z.string().min(2).max(20).default(\"AI Agent 是什么\"),",
    "  bullets: z.array(z.string().min(4).max(40)).min(1).max(4).default([",
    "    \"AI Agent 不只是回答问题。\",",
    "  ]),",
    "});",
    "",
    "export const layoutId = \"slide-01\";",
    "export const layoutName = \"Slide 01\";",
    "export const layoutDescription = \"A customized page for the current outline item.\";",
    "",
    "const Slide01 = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {",
    "  const parsed = Schema.parse(data ?? {});",
    "",
    "  return <div className=\"h-[720px] w-[1280px]\">{parsed.title}</div>;",
    "};",
    "",
    "export default Slide01;",
    "```",
    "",
    "## Schema 规则",
    "",
    "- 组件读取的所有字段都必须出现在 `Schema`。",
    "- 渲染时优先使用 `parsed`，不要继续直接读取原始 `data`。",
    "- 用 `.min()`、`.max()`、数组限制控制文本长度和列表数量。",
    "- 给标题、列表、图表、卡片等字段提供合理默认值。",
    "- 避免 `any`、`foo`、`data2` 和过深嵌套。",
    "",
    "## 数据与 TSX 的配合",
    "",
    "1. 先读对应 TSX 的 `Schema`。",
    "2. 再改 `data/*.json`，让数据满足 schema。",
    "3. 如果用户需求确实超出现有 schema，才修改 TSX 的 schema 和布局。",
    "4. 修改后保持 `manifest.json` 的 `data_path` 与数据文件一致。",
    "",
    "## 组件复用原则",
    "",
    "- 先读 `blueprints/README.md`、`components/README.md`、`slides/README.md`。",
    "- 优先复用 `components/` 里的稳定组件。",
    "- 新增或手写与现有组件语义重叠的 UI 前，先确认是否已有合适组件。",
    "- 如果多个页面需要同一种新视觉能力，优先组合已有组件，再考虑小幅扩展 `components/*.tsx`。",
    "",
    "## TSX-first 蓝图规则",
    "",
    "- 先从最接近当前页结构的 `blueprints/*.tsx` 派生，再落到 `slides/*.tsx` 继续改。",
    "- `slides/*.tsx` 不应长期停留在只 re-export 蓝图的状态。",
    "- 不要只改 `data/*.json` 或 `manifest.json` 来迁就版式。",
    "- 如果用户需求要求改变布局、组件组合、层级、视觉风格或信息密度，必须修改 `slides/*.tsx`。",
    "",
    "## 布局规则",
    "",
    "- 外层必须是固定 slide 画布：`h-[720px] w-[1280px]`，或复用已经固定画布的 frame 组件。",
    "- 页面内容必须完整出现在首屏，不依赖滚动、hover、点击或动画。",
    "",
    "## 示例数据",
    "",
    "```json",
    ...formatJson(exampleData).split("\n"),
    "```",
  ].join("\n");
}

function buildTsxExportRuleMarkdown(): string {
  const buildDeckHtmlExample = {
    tool: "buildDeckHtmlFromManifest",
    arguments: {
      cwd: "./output",
      manifest_path: "./template/manifest.json",
      output_dir: "./output/page-preview/slide-01",
      name: "slide-01",
      single_page: true,
      page: 1,
    },
  };

  return [
    "# PPT TSX 导出稳定性规则",
    "",
    "## 目标",
    "",
    "TSX 的最终目标不是网页展示，而是进入 `buildDeckHtmlFromManifest`、deck HTML 与每页截图、HTML 到 PPT 模型以及最终 PPTX 导出。",
    "",
    "## 核心原则",
    "",
    "- 固定 1280x720 单页画布。",
    "- 无需滚动、点击、hover、动画即可完整展示。",
    "- 关键标题、正文、bullet、指标说明保持为真实文本节点。",
    "- 图形主导模块可以截图，但不要把大段可编辑正文一起截图。",
    "- 布局有明确边界，文字长度和列表数量受控。",
    "",
    "## 禁止事项",
    "",
    "- 可滚动长页面。",
    "- 依赖交互或动画过程表达信息。",
    "- 把关键文字画到 canvas 或整张图片里。",
    "- 用复杂 CSS 特效承载关键内容。",
    "- 让内容自动撑破 1280x720 画布。",
    "",
    "## 文本结构规则",
    "",
    "- 关键文本尽量拆成独立文本块，不要把图标、前缀和正文混在一个复杂节点里。",
    "- 关键单行文本应有明确宽度，必要时使用 `whitespace-nowrap`。",
    "- 固定高度的单行文本盒应使用 `flex` 或 `inline-flex` 明确垂直居中。",
    "",
    "## 图表与截图规则",
    "",
    "- 图形主导模块默认应在外层加 `data-pptx-export=\"screenshot\"`。",
    "- 文本主导模块默认不要整块截图。",
    "- 混合型模块只截图纯图形区域，不要把标题、正文、结论一起包进去。",
    "- 截图容器必须有明确宽高、明确背景、边界收敛到单个图表或纯图形模块。",
    "",
    "## 导出示例",
    "",
    "```json",
    ...formatJson(buildDeckHtmlExample).split("\n"),
    "```",
    "",
    "## 生成 HTML 后的自检清单",
    "",
    "- 是否有文字溢出、裁切、换行异常。",
    "- 是否有元素超出页面边界。",
    "- 是否有文字或 UI 重叠。",
    "- 图表是否空白、错位、比例异常。",
    "- 图片是否缺失或拉伸异常。",
    "- 页面标题、页码、顺序是否正确。",
    "- 内容是否贴合用户需求和已确认大纲。",
    "- 所有页面是否都在 1280x720 内完整展示。",
    "",
    "## 修改后流程",
    "",
    "1. 回到 `slides/*.tsx`、`components/*.tsx` 或 `data/*.json` 修复。",
    "2. 重新调用 `buildDeckHtmlFromManifest`。",
    "3. 再次检查所有受影响页面截图。",
    "4. 截图没有明显问题后，才能把 HTML 路径给用户审阅。",
    "",
    "## 修改前后的自检",
    "",
    "- 已加载 `ppt-tsx-authoring`。",
    "- 已读对应 `Schema`。",
    "- 已确认数据是否满足 schema。",
    "- 已判断问题是数据问题、布局问题还是导出兼容问题。",
    "- 没有新增第三方库。",
    "- 没有把关键文本截图化。",
    "- 没有引入滚动、hover、点击依赖。",
    "- 没有使用复杂 CSS 承载关键内容。",
    "- 已重新生成 HTML 并检查截图。",
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
      "页级精修必须同时考虑 manifest、data、slides、components 和导出自审闭环。",
    ];
  }

  const currentPageItem = getCurrentPagePlanItem(pagePlan, currentPage);
  return [
    "先读自动生成的页面骨架，不要把它当成新的 deck 级规划阶段。",
    currentPageItem
      ? `当前页骨架：${currentPageItem.pageId} / ${currentPageItem.title}`
      : "当前还没有选定页，需要先通过 `start_page_iteration` 选页。",
    "如果骨架里缺少候选组件方向或表达形态，只做当前页的局部补充，不要回到全 deck 规划。",
    "当前页必须显式决定：manifest 入口、data 文件、slide TSX 和必要的 component 改造。",
    "不要只引用 blueprint；要主动改结构、组件或文案，形成真正的最终页面。",
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
    `- 建议 slide 文件：${pagePlanItem?.slidePath ? `\`${pagePlanItem.slidePath}\`` : "未记录"}（不存在则先创建，已存在则在当前文件基础上继续精修）`,
    `- 建议 data 文件：${pagePlanItem?.dataPath ? `\`${pagePlanItem.dataPath}\`` : "未记录"}（不存在则先创建，已存在则按当前页继续补充或修正）`,
    `- 最近 PNG：${currentPage.lastRenderedPngPath ? `\`${currentPage.lastRenderedPngPath}\`` : "无"}`,
    `- 页级有效工件：\n${formatList(pageArtifacts)}`,
  ].join("\n");
}

function buildCollectRequirementsPromoteMarkdown(context: PromoteRenderContext): string {
  const { opened, action, requirements } = context;
  const requirementsPath = context.sourceFiles.requirements;

  return [
    `# Deck 阶段行动说明：${opened.state.deckState}`,
    "",
    "## 当前阶段",
    "",
    `当前 deck 状态是 \`${opened.state.deckState}\`。`,
    "",
    "## 本阶段目标",
    "",
    "确认用户的 PPT 制作需求，并通过状态机写入结构化 `requirements.json`。",
    "",
    "## 必读文件",
    "",
    formatCodeList([
      context.sourceFiles.task,
      context.sourceFiles.state,
      requirementsPath,
    ]),
    "",
    "## 当前已知信息",
    "",
    formatList([
      `项目：\`${opened.task.title ?? opened.task.projectId}\``,
      `项目目录：\`${opened.projectDir}\``,
      `需求记录：${requirements ? `已存在，路径 \`${requirementsPath}\`` : `未找到，预期路径 \`${requirementsPath}\``}`,
    ]),
    "",
    "## 下一步行动建议",
    "",
    [
      `1. 先读取 \`${requirementsPath}\`，确认是否已有结构化需求；如果文件不存在，就从用户原始请求开始建立第一版需求。`,
      "2. 和用户核对并补齐需求。必须确认：主题、目标受众、使用场景、页数；建议同时确认：语言、语气、视觉偏好、必须覆盖的信息、用户提供的素材或参考文件。已有字段只做确认和补充，不要无理由覆盖。",
      "3. 需求完整后调用 `record_requirements` 子工具写入状态机。默认使用 `mode: \"merge\"`，只更新本次确认字段；只有用户明确要求重写全部需求时，才使用 `mode: \"replace_all\"`。",
      "4. `record_requirements` 成功后，继续调用 `query_task_state` 子工具查询下一阶段要做什么，并重新阅读最新的 `promote/current.md`。",
    ].join("\n"),
    "",
    "## 推荐调用的子工具",
    "",
    formatJson([
      getRecommendedToolCall(context),
      {
        tool: "query_task_state",
        arguments: {
          project_dir: opened.projectDir,
          response_mode: "compact",
        },
      },
    ]),
  ].join("\n");
}

function buildSelectTemplateGroupPromoteMarkdown(context: PromoteRenderContext): string {
  const { opened, requirements } = context;
  const requirementsPath = context.sourceFiles.requirements;

  return [
    `# Deck 阶段行动说明：${opened.state.deckState}`,
    "",
    "## 当前阶段",
    "",
    `当前 deck 状态是 \`${opened.state.deckState}\`。`,
    "",
    "## 本阶段目标",
    "",
    "基于已确认的需求，让用户从可用模板组中明确选择一个 `template_group`。",
    "",
    "## 必读文件",
    "",
    formatCodeList([
      context.sourceFiles.task,
      context.sourceFiles.state,
      requirementsPath,
    ]),
    "",
    "## 当前需求",
    "",
    buildRequirementsStatus(requirements),
    "",
    "## 可用模板组",
    "",
    formatTemplateGroupOptions(context.availableTemplateGroups),
    "",
    "## 下一步行动建议",
    "",
    [
      "1. 直接阅读上方 `可用模板组` 列表，不需要再次调用模板发现工具。",
      "2. 结合 `requirements.json` 中的主题、受众、场景、页数、语气和素材约束，向用户展示候选模板组，并简要说明每个候选项适合或不适合的原因。",
      "3. 等待用户明确确认一个 `template_group`，不要由 PPT AI Agent 直接替用户拍板。",
      "4. 用户确认后调用 `record_template_selection` 子工具。这个子工具会把对应模板组 fork 到当前项目的 `template/` 目录，并以 `overwrite: true` 的方式覆盖该工作副本。",
      "5. `record_template_selection` 成功后，继续调用 `query_task_state` 子工具查询下一阶段要做什么，并重新阅读最新的 `promote/current.md`。",
    ].join("\n"),
    "",
    "## 推荐调用的子工具",
    "",
    formatJson([
      getRecommendedToolCall(context),
      {
        tool: "query_task_state",
        arguments: {
          project_dir: opened.projectDir,
          response_mode: "compact",
        },
      },
    ]),
  ].join("\n");
}

function buildWriteOutlinePromoteMarkdown(context: PromoteRenderContext): string {
  const { opened, requirements, outline } = context;
  const requirementsPath = context.sourceFiles.requirements;
  const outlinePath = context.sourceFiles.outline;

  return [
    `# Deck 阶段行动说明：${opened.state.deckState}`,
    "",
    "## 当前阶段",
    "",
    `当前 deck 状态是 \`${opened.state.deckState}\`。`,
    "",
    "## 本阶段目标",
    "",
    "根据已确认的用户需求，生成一份可审阅、页数准确、叙事清晰的 PPT 大纲。",
    "",
    "## 必读文件",
    "",
    formatCodeList([
      context.sourceFiles.task,
      context.sourceFiles.state,
      requirementsPath,
      outlinePath,
    ]),
    "",
    "## 当前需求",
    "",
    buildRequirementsStatus(requirements),
    "",
    "## 当前大纲",
    "",
    buildOutlineStatus(outline),
    "",
    "## 下一步行动建议",
    "",
    [
      `1. 先读取 \`${requirementsPath}\`，把其中的 \`pageCount\` 作为硬约束，大纲页数不能多也不能少。`,
      "2. 根据用户需求生成整套 deck 的叙事主线、章节结构和逐页安排。每一页都要写清 `pageId`、`pageNumber`、`title`、`goal` 和 `coreMessage`。",
      "3. 先把大纲草案给用户确认。不要直接开始写页面 TSX，也不要把组件、布局或模板实现细节写进大纲。",
      "4. 用户确认大纲后，调用 `record_outline` 子工具写入状态机。`record_outline` 成功后，系统会自动派生页面骨架，不需要额外做一轮全 deck 的 `page_plan`。",
      "5. `record_outline` 成功后，继续调用 `query_task_state` 子工具查询下一阶段要做什么，并重新阅读最新的 `promote/current.md`。",
    ].join("\n"),
    "",
    "## 推荐调用的子工具",
    "",
    formatJson([
      getRecommendedToolCall(context),
      {
        tool: "query_task_state",
        arguments: {
          project_dir: opened.projectDir,
          response_mode: "compact",
        },
      },
    ]),
  ].join("\n");
}

function buildDeckPromoteMarkdown(context: PromoteRenderContext): string {
  const { opened, action } = context;
  const guidance = getDeckStageGuidance(context);

  if (action.type === "collect_requirements") {
    return buildCollectRequirementsPromoteMarkdown(context);
  }

  if (action.type === "select_template_group") {
    return buildSelectTemplateGroupPromoteMarkdown(context);
  }

  if (action.type === "write_outline") {
    return buildWriteOutlinePromoteMarkdown(context);
  }

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
  const ruleFiles = getPromoteRuleFilePaths(context.opened.projectDir);
  const currentPageSlide = pagePlanItem?.slidePath
    ?? `./slides/${currentPage?.pageId ? `${toPascalCase(currentPage.pageId)}.tsx` : "SlidePage.tsx"}`;
  const currentPageData = pagePlanItem?.dataPath
    ?? `./data/${currentPage?.pageId ?? "current-page"}.json`;
  const manifestPath = context.sourceFiles.templateManifest ?? path.join(context.opened.projectDir, "template", "manifest.json");
  const buildDeckHtmlToolCall = {
    tool: "buildDeckHtmlFromManifest",
    arguments: {
      cwd: path.join(context.opened.projectDir, "output"),
      manifest_path: manifestPath,
      output_dir: path.join(context.opened.projectDir, "output", "page-preview", currentPage?.pageId ?? "current-page"),
      name: currentPage?.pageId ?? "current-page",
      single_page: true,
      page: pagePlanItem?.pageNumber ?? currentPage?.pageNumber ?? null,
    },
  };

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
    "## 当前页推荐动作",
    "",
    context.action.summary,
    "",
    "## 必读文件",
    "",
    formatCodeList([
      context.sourceFiles.currentPage,
      context.sourceFiles.pagePlan,
      context.sourceFiles.artifacts,
      context.sourceFiles.templateGroup,
      context.sourceFiles.templateManifest,
      context.sourceFiles.templateCatalog,
      context.sourceFiles.templateBlueprintsReadme,
      path.join(context.opened.projectDir, "template", "slides", "README.md"),
      path.join(context.opened.projectDir, "template", "components", "README.md"),
      ruleFiles.manifestSpec,
      ruleFiles.tsxAuthoring,
      ruleFiles.tsxExportRules,
    ].filter((item): item is string => typeof item === "string" && item.length > 0)),
    "",
    "## 当前页事实",
    "",
    buildPageSummary(currentPage, pagePlanItem, context.opened.artifacts),
    "",
    "## page_state 说明",
    "",
    formatList(getPageStateGuidance()),
    "",
    "## 当前页改造目标",
    "",
    formatList([
      `当前页 slide 入口建议为 \`${currentPageSlide}\`；如果该文件不存在，就先创建它；如果已经存在，就在它基础上继续精修。`,
      `当前页数据文件建议为 \`${currentPageData}\`；如果该文件不存在，就先创建它；如果已经存在，就按当前页内容继续补充或修正。`,
      "如果现有页面只是蓝图复用，必须继续改成贴合当前大纲的最终页面。",
      "如果当前页只是改了 data，没有改结构或组件，也不算通过。",
      "如果当前页已引入新组件或改造现有组件，说明进入了真正的精修阶段。",
      "页面实现优先顺序：先改 TSX 结构，再改 data，再补组件，再同步 manifest。",
    ]),
    "",
    "## 当前页修改范围",
    "",
    formatList([
      `\`${currentPageSlide}\`：当前页最终 TSX 入口，负责页面结构、组件编排和表达方式；不存在就创建，存在就精修。`,
      `\`${currentPageData}\`：当前页内容数据，只承载内容，不承载布局决策；不存在就创建，存在就按当前页继续补充。`,
      `\`${manifestPath}\`：如果当前页新增、替换或重排入口，需要同步更新。`,
      "`template/components/*.tsx`：只有当当前页确实缺少可复用组件、或者需要抽象重复结构时才改。",
    ]),
    "",
    "## 当前页 HTML 生成",
    "",
    formatJson(buildDeckHtmlToolCall),
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
      "检查组件使用是否符合模板 README、manifest 入口和当前页表达目标。",
      "检查当前页是否真的比蓝图更进一步：至少要有结构、组件或文案上的实质变化。",
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
    "",
    "## 当前页截图审查提示词",
    "",
    "请只审查当前页 PNG，不要泛评整套 deck。",
    "重点检查：当前页内容是否贴合大纲；是否真的比蓝图有实质修改；manifest/data/tsx 是否协调；是否存在文字溢出、遮挡、空白、重叠或导出异常。",
    "给出通过/不通过结论，并列出必须修复的具体项。",
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

async function writePromoteRules(projectDir: string): Promise<void> {
  const rulesDir = resolvePromoteRulesDir(projectDir);
  await mkdir(rulesDir, { recursive: true });
  await writeFile(resolvePromoteRuleFilePath(projectDir, "ppt-manifest-spec.md"), `${buildManifestRuleMarkdown()}\n`, "utf8");
  await writeFile(resolvePromoteRuleFilePath(projectDir, "ppt-tsx-authoring.md"), `${buildTsxAuthoringRuleMarkdown()}\n`, "utf8");
  await writeFile(resolvePromoteRuleFilePath(projectDir, "ppt-tsx-export-rules.md"), `${buildTsxExportRuleMarkdown()}\n`, "utf8");
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
  await writePromoteRules(projectDir);

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
