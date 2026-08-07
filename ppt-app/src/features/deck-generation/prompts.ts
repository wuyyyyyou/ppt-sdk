import type { AgentPageVisualReviewResult } from "../../agent/agentClient";
import type { WorkspaceOutline } from "../../api/types";
import type { ManualPageRevisionManifest } from "../../api/types";
import type { Locale } from "../../i18n/messages";
import { currentDatePromptLine } from "../../ai/promptContext";
import type { AuthoringDeck, AuthoringPage, NoChangeAuthoringRetry, PageRefinementVisualContext, RenderFailureHistoryItem, RenderFailurePhase } from "./types";
import {
  createAgentFileToolPathContext,
  describeAgentFileToolPathContext,
  formatAgentFileToolPathBlock,
  toAgentFileToolPath,
} from "./agentFileToolPaths";

export function extractRenderFailureDiagnosticSummary(error: string): string {
  return error.split(/\r?\n/).map((line) => line.trim())
    .find((line) => /:\d+:\d+\s+TS\d+:/.test(line))
    ?? error.split(/\r?\n/).find((line) => line.trim())?.trim()
    ?? error;
}

export function extractRenderFailureDiagnosticKey(summary: string): string {
  const match = summary.match(/^(.+?:\d+:\d+)\s+(TS\d+):/);
  return match ? `${match[1]} ${match[2]}` : summary;
}

export function summarizeRenderFailureHistory(history: RenderFailureHistoryItem[]) {
  const grouped = new Map<string, { attempts: number[]; phases: Set<RenderFailurePhase>; diagnostic: string }>();
  for (const item of history) {
    const diagnostic = extractRenderFailureDiagnosticSummary(item.error);
    const key = extractRenderFailureDiagnosticKey(diagnostic);
    const existing = grouped.get(key);
    if (existing) {
      existing.attempts.push(item.attempt);
      existing.phases.add(item.phase);
    } else {
      grouped.set(key, { attempts: [item.attempt], phases: new Set([item.phase]), diagnostic });
    }
  }
  return [...grouped.values()].map((item) => ({
    attempts: item.attempts,
    phases: [...item.phases],
    repeated_count: item.attempts.length,
    diagnostic: item.diagnostic,
  }));
}

export function buildAuthoringPrompt(input: {
  workspaceRoot?: string;
  workspaceDir: string;
  page: AuthoringPage;
  authoringDeck: AuthoringDeck;
  outline: WorkspaceOutline;
  attemptKind: "initial" | "page-refinement" | "render-fix" | "visual-review-fix";
  renderError?: string;
  renderFailureHistory?: RenderFailureHistoryItem[];
  visualReview?: AgentPageVisualReviewResult | null;
  hasImageAttachment?: boolean;
  noChangeRetry?: NoChangeAuthoringRetry | null;
  refinementRequest?: string;
  refinementReason?: string;
  refinementVisualContext?: PageRefinementVisualContext;
  manualRevision?: ManualPageRevisionManifest | null;
}) {
  const context = createAgentFileToolPathContext({
    workspaceRoot: input.workspaceRoot,
    workspaceDir: input.workspaceDir,
  });
  const toolPath = (label: string, absolutePath: string) => formatAgentFileToolPathBlock({
    label,
    path: toAgentFileToolPath(context, absolutePath),
  });
  const pageSourcePath = `${input.workspaceDir}/slides/${input.page.page_id}.tsx`;
  const requirementsPath = `${input.workspaceDir}/requirements.json`;
  const outlinePath = `${input.workspaceDir}/outline.json`;
  const styleGuidePath = `${input.workspaceDir}/style-guide.md`;
  const persistentElementsPath = `${input.workspaceDir}/persistent-elements.tsx`;
  const authoringKitReadmePath = `${input.workspaceDir}/authoring-kit/README.md`;
  const presentationPrinciplesPath = `${input.workspaceDir}/authoring-kit/presentation-principles.md`;
  const webResearchSummaryPath = `${input.workspaceDir}/research/evidence/web-summary.md`;
  const imageCatalogPath = `${input.workspaceDir}/research/evidence/image-catalog.json`;
  const shouldReadResearch = input.attemptKind === "initial" || input.attemptKind === "page-refinement";
  const manualRevision = input.manualRevision;
  const refinementContext = input.refinementRequest?.trim() ? [
    "这是优化轮次。大纲和艺术指导是最初确定的基线；如果它们与用户本次优化要求冲突，只执行用户本次要求。",
    `用户本次优化要求: ${input.refinementRequest.trim()}`,
    `当前页优化原因: ${input.refinementReason?.trim() || "Apply the user's refinement request to this page."}`,
    input.hasImageAttachment
      ? "优化前页面截图已作为当前 Session 的原生图片附件提供，仅作视觉基线，不是事实来源。"
      : "优化前页面截图不可用。",
    "不得从截图推断或补造事实、数字、名称、日期、引用或来源依赖内容。",
  ].join("\n") : "";
  const repairContext = input.renderError
    ? [
        "这是渲染修复轮次。优先修复当前错误，不要做无关重构。",
        input.renderError,
        input.renderFailureHistory?.length
          ? JSON.stringify(summarizeRenderFailureHistory(input.renderFailureHistory), null, 2)
          : "",
      ].filter(Boolean).join("\n")
    : input.visualReview
      ? [
          "这是视觉检查修复轮次。只修复诊断指出的可用性问题，不增加新的事实性内容。",
          JSON.stringify(input.visualReview, null, 2),
          input.hasImageAttachment
            ? "导致本次检查失败的最新页面截图已作为当前 Session 的原生图片附件提供。"
            : "本轮没有可用的页面截图附件。",
        ].filter(Boolean).join("\n")
      : "这是首次页面创作。根据已确认页面意图和整套艺术指导完成当前页。";

  return [
    "你是本地文件编辑 Agent，负责创作一页 1280 × 720 的 TSX PPT 页面。",
    "你只允许修改当前页面源文件。不要修改 manifest.json、outline.json、requirements.json、style-guide.md、authoring-kit、其他页面或任何共享文件。",
    currentDatePromptLine(),
    "如果用户没有提供汇报人或组织，正式汇报封面的默认演示身份是 ANNA AI。",
    "",
    describeAgentFileToolPathContext(context),
    "",
    "开始写代码前，必须严格按以下顺序完整读取文件：",
    ...(manualRevision ? [
      `1. ${toolPath("人工页面修订 manifest", `${input.workspaceDir}/manual-edits/${input.page.page_id}/manifest.json`)}`,
      `2. ${toolPath("用户最新人工 HTML", manualRevision.agent_html_path)}`,
      `3. ${toolPath("当前旧 TSX（需要修改的源码）", pageSourcePath)}`,
      `4. ${toolPath("演示需求", requirementsPath)}`,
      `5. ${toolPath("已确认大纲", outlinePath)}`,
      `6. ${toolPath("艺术指导", styleGuidePath)}`,
      `7. ${toolPath("Presentation Principles（演示文稿创作原则）", presentationPrinciplesPath)}`,
      `8. ${toolPath("跨页固定元素参考", persistentElementsPath)}`,
      `9. ${toolPath("Authoring Kit 总说明", authoringKitReadmePath)}`,
      "10. 根据总说明判断当前页相关的 foundations / references 分类，并完整读取相关分类 README。",
      "11. 如果认为任何 Foundation Module（基础模块）或 Reference Implementation（参考实现）适合使用或参考，必须先完整读取对应组件的 TSX 文件，再开始写当前页面。不能只看文件名、README 摘要或局部代码。",
      input.hasImageAttachment
        ? "用户最新人工页面截图已作为当前 Session 的原生图片附件提供，仅作视觉参考。"
        : "用户最新人工页面截图附件不可用。",
      "人工页面修订是用户最新内容与视觉结构，旧 TSX 只是需要修复的源码。除非本次优化要求明确冲突，不得回退人工文字、数字、新增对象或恢复 data-ppt-editor-deleted=\"true\" 的对象；data-ppt-editor-placeholder=\"true\" 仅是布局占位，不得写入新 TSX。",
    ] : [
      `1. ${toolPath("当前页面 TSX", pageSourcePath)}`,
      `2. ${toolPath("演示需求", requirementsPath)}`,
      `3. ${toolPath("已确认大纲", outlinePath)}`,
      `4. ${toolPath("艺术指导", styleGuidePath)}`,
      `5. ${toolPath("Presentation Principles（演示文稿创作原则）", presentationPrinciplesPath)}`,
      `6. ${toolPath("跨页固定元素参考", persistentElementsPath)}`,
      `7. ${toolPath("Authoring Kit 总说明", authoringKitReadmePath)}`,
      "8. 根据总说明判断当前页相关的 foundations / references 分类，并完整读取相关分类 README。",
      "9. 如果认为任何 Foundation Module（基础模块）或 Reference Implementation（参考实现）适合使用或参考，必须先完整读取对应组件的 TSX 文件，再开始写当前页面。不能只看文件名、README 摘要或局部代码。",
    ]),
    ...(shouldReadResearch ? [
      "",
      "开始创作前还必须完整读取以下共享研究资料：",
      `- ${toolPath("Web 研究总结", webResearchSummaryPath)}`,
      `- ${toolPath("图片素材目录", imageCatalogPath)}`,
      "Web 研究总结是允许使用的事实依据；不要使用搜索原始结果、URL 列表或研究进度文件补充事实。",
      "图片素材目录只包含已通过视觉筛选并成功导入当前 Workspace 的可用本地图片。",
    ] : []),
    "本地图片路径规则：image-catalog.json 中每个 asset 的 file_path 是当前 Workspace 中已导入图片的绝对路径。",
    "在 TSX 的 <img src> 或图片组件 url 中必须原样使用该 file_path；不得改成相对路径、添加 ./ 或 ../，也不得使用远程 image_url 或 thumbnail_url。",
    "",
    "页面要求：",
    `- page_id: ${input.page.page_id}`,
    `- 页面序号: ${input.page.index + 1} / ${input.authoringDeck.pages.length}`,
    `- 页面标题: ${input.page.title}`,
    `- 页面意图: ${input.page.outline}`,
    `- Deck 标题: ${input.outline.title}`,
    "- 保持 Page Source Bootstrap（页面源引导文件）要求的固定画布和导出行为。",
    "- 先判断当前页是否需要页眉、页脚、页码、持续装饰、页面标题或副标题；特殊页可以省略或选择适用的标题处理变体。只要使用其中任一元素，必须仿照 persistent-elements.tsx 对应示例的 JSX 结构、位置、字体、字号、字重、是否斜体、颜色和间距；不要 import 它，也不要自行设计近似版本。",
    "- persistent-elements.tsx 中的标题和副标题文字只是视觉示意，不是当前页面的内容或事实依据。普通页面创作时，页面标题默认使用当前页 Outline 标题；如果是人工页面修订，必须保留用户最新人工内容，除非本次优化明确要求改变标题。副标题只有在当前页确实需要时才添加，并且必须来自已读 Workspace 文件或当前页面意图，不能复制参考文件中的示例文案，也不要仅为填充空间而添加。",
    "- persistent-elements.tsx 中的页码数字只是示意；复制页码时保留 data-presenton-page-number 标记，current 为当前页（1-based），total 为总页数。",
    "- 用清晰的视觉层级表达当前页唯一核心信息；事实和数字只能来自已读 Workspace 文件，不要自行补造。",
    "",
    "当前轮次：",
    refinementContext,
    repairContext,
    input.noChangeRetry ? [
      "上一次响应没有改变当前 TSX 的文件指纹。此次必须实际编辑当前 TSX，不能只返回说明。",
      `重试次数: ${input.noChangeRetry.retryCount}`,
      `上次摘要: ${input.noChangeRetry.previousSummary}`,
      `上次 changed_files: ${JSON.stringify(input.noChangeRetry.previousChangedFiles)}`,
    ].join("\n") : "",
    "",
    "完成编辑后，只返回一个 JSON 对象用于诊断记录：",
    '{"summary":"...","files_read":["..."],"authoring_kit_sources_read":["..."],"changed_files":["..."],"needs_render":true}',
    "Agent 返回值不决定是否通过；系统只根据当前 TSX 文件指纹是否变化执行确定性门禁。",
  ].filter(Boolean).join("\n");
}

export function targetPageNoChangeMessage(locale: Locale, page: AuthoringPage) {
  return locale === "zh"
    ? `页面生成失败：Agent 完成响应但没有实际修改当前页 TSX（${page.title || page.page_id}）。`
    : `Page generation failed: the Agent completed without modifying the current page TSX (${page.title || page.page_id}).`;
}

export function targetPageFingerprintReadErrorMessage(locale: Locale, page: AuthoringPage, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  return locale === "zh"
    ? `页面生成失败：无法读取当前页 TSX 文件用于指纹校验（${page.title || page.page_id}）：${detail}`
    : `Page generation failed: unable to fingerprint the current page TSX (${page.title || page.page_id}): ${detail}`;
}

export function buildPageVisualReviewPrompt(input: {
  page: AuthoringPage;
}) {
  return [
    "You are a Page Visual Review agent for one generated PPT slide.",
    "Review only visual usability. Do not judge factual correctness or rewrite content.",
    "First, strictly inspect the page screenshot attached to this Session as a native image attachment. Treat that image as the complete visual input; do not infer what it looks like from the page title or prompt.",
    "Check each of these areas: title and subtitle; body and explanatory text; card text; header and footer; decorative lines, grids, and text hierarchy; foreground/background contrast; fine-size text; edge clipping; and readability in every distinct region.",
    "Any obvious visual problem must fail the review and receive a score of 6 or lower. A score of 7-8 is only for a usable page with minor, non-blocking imperfections. Use 9-10 only when the page is clearly readable and visually complete.",
    "Write image_description as one or two short sentences describing what you actually see in the attached image, including its main layout and visual treatment. Keep it concise; do not merely repeat the page title.",
    "If the image attachment cannot be read, return image_description as IMAGE_UNAVAILABLE, pass as false, score as 0, and confidence as low.",
    "Return only one JSON object with exactly these fields: pass (boolean), score (integer 0-10), image_description (short string), issues (array of objects; each object requires problem and may include severity, area, and fix_hint), revision_request (short fix request), confidence (low, medium, or high).",
    `Page id: ${input.page.page_id}`,
    `Page title: ${input.page.title}`,
  ].join("\n");
}

export function visualReviewImageUnavailable(review: AgentPageVisualReviewResult) {
  return review.image_description?.trim().toUpperCase() === "IMAGE_UNAVAILABLE";
}

export function visualReviewPassed(review: AgentPageVisualReviewResult) {
  return review.pass && review.score >= 7 && review.confidence !== "low";
}
