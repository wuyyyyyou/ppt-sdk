import type { AgentPageVisualReviewResult } from "../../agent/agentClient";
import type { RenderWorkspacePagePreviewResult, WorkspaceOutline } from "../../api/types";
import type { Locale } from "../../i18n/messages";
import type { AuthoringDeck, AuthoringPage, NoChangeAuthoringRetry, RenderFailureHistoryItem, RenderFailurePhase } from "./types";
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
  visualReviewScreenshotPath?: string;
  noChangeRetry?: NoChangeAuthoringRetry | null;
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
  const authoringKitReadmePath = `${input.workspaceDir}/authoring-kit/README.md`;
  const screenshotPath = input.visualReviewScreenshotPath?.trim() ?? "";
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
          screenshotPath ? toolPath("视觉检查截图", screenshotPath) : "",
        ].filter(Boolean).join("\n")
      : "这是首次页面创作。根据已确认页面意图和整套艺术指导完成当前页。";

  return [
    "你是本地文件编辑 Agent，负责创作一页 1280 × 720 的 TSX PPT 页面。",
    "你只允许修改当前页面源文件。不要修改 manifest.json、outline.json、requirements.json、style-guide.md、authoring-kit、其他页面或任何共享文件。",
    "",
    describeAgentFileToolPathContext(context),
    "",
    "开始写代码前，必须严格按以下顺序完整读取文件：",
    `1. ${toolPath("当前页面 TSX", pageSourcePath)}`,
    `2. ${toolPath("演示需求", requirementsPath)}`,
    `3. ${toolPath("已确认大纲", outlinePath)}`,
    `4. ${toolPath("艺术指导", styleGuidePath)}`,
    `5. ${toolPath("Authoring Kit 总说明", authoringKitReadmePath)}`,
    "6. 根据总说明判断当前页相关的 foundations / references 分类，并完整读取相关分类 README。",
    "7. 如果认为任何 Foundation Module（基础模块）或 Reference Implementation（参考实现）适合使用或参考，必须先完整读取对应组件的 TSX 文件，再开始写当前页面。不能只看文件名、README 摘要或局部代码。",
    "",
    "页面要求：",
    `- page_id: ${input.page.page_id}`,
    `- 页面序号: ${input.page.index + 1} / ${input.authoringDeck.pages.length}`,
    `- 页面标题: ${input.page.title}`,
    `- 页面意图: ${input.page.outline}`,
    `- Deck 标题: ${input.outline.title}`,
    "- 保持 Page Source Bootstrap（页面源引导文件）要求的固定画布和导出行为。",
    "- 用清晰的视觉层级表达当前页唯一核心信息；事实和数字只能来自已读 Workspace 文件，不要自行补造。",
    "",
    "当前轮次：",
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
  workspaceRoot?: string;
  workspaceDir: string;
  page: AuthoringPage;
  screenshotPath: string;
  preview: RenderWorkspacePagePreviewResult;
}) {
  const context = createAgentFileToolPathContext({
    workspaceRoot: input.workspaceRoot,
    workspaceDir: input.workspaceDir,
  });
  return [
    "You are a Page Visual Review agent for one generated PPT slide.",
    "Review only visual usability. Do not judge factual correctness or rewrite content.",
    "First upload and analyze the screenshot. Fail only for overlap, cutoff, unreadable key content, insufficient contrast, broken/missing visuals, major unintended blank areas, or content outside the 1280x720 canvas.",
    "Return only JSON: {\"pass\":true,\"score\":8,\"issues\":[],\"revision_request\":\"\",\"confidence\":\"medium\"}",
    describeAgentFileToolPathContext(context),
    formatAgentFileToolPathBlock({
      label: "Screenshot path",
      path: toAgentFileToolPath(context, input.screenshotPath),
    }),
    formatAgentFileToolPathBlock({
      label: "Rendered HTML path",
      path: toAgentFileToolPath(context, input.preview.html_path),
    }),
    `Page title: ${input.page.title}`,
  ].join("\n");
}

export function visualReviewPassed(review: AgentPageVisualReviewResult) {
  return review.pass && review.score >= 7 && review.confidence !== "low";
}
