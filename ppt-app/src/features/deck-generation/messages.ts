import type { PagePlanItem, PageProgress } from "../../api/types";
import type { Locale } from "../../i18n/messages";

export function generationText(locale: Locale) {
  const zh = locale === "zh";
  return {
    authoringKit: zh ? "正在准备 Authoring Kit（创作套件）" : "Preparing the Authoring Kit",
    styleGuide: zh ? "正在生成艺术指导" : "Creating the Workspace Style Guide",
    pageSources: zh ? "正在初始化 Page Sources（页面源文件）" : "Preparing Page Sources",
    pagePlan: zh ? "正在规划页面和模板蓝图" : "Planning pages and template blueprints",
    researchPlanning: zh ? "正在规划检索需求" : "Planning research needs",
    webResearchDiscovery: zh ? "正在判断并补充网页资料" : "Discovering needed web evidence",
    visualResearchDiscovery: zh ? "正在判断并补充图片素材" : "Discovering needed visual assets",
    collectingWebSources: zh ? "正在搜索并抓取网页资料" : "Searching and fetching web sources",
    collectingVisualSources: zh ? "正在搜索并下载图片素材" : "Searching and downloading visual assets",
    curatingDiscoveryFacts: zh ? "正在筛选资料证据" : "Curating discovered factual evidence",
    curatingDiscoveryImages: zh ? "正在筛选图片素材" : "Curating discovered visual assets",
    evidencePagePlanning: zh ? "正在根据证据补充页面内容规划" : "Planning page content from curated evidence",
    collectingSources: (page: Pick<PagePlanItem, "index" | "title">) =>
      zh ? `正在搜索并抓取第 ${page.index + 1} 页资料` : `Collecting sources for page ${page.index + 1}`,
    curatingEvidence: (page: Pick<PagePlanItem, "index" | "title">) =>
      zh ? `正在筛选第 ${page.index + 1} 页证据` : `Curating evidence for page ${page.index + 1}`,
    curatingFacts: (page: Pick<PagePlanItem, "index" | "title">) =>
      zh ? `正在筛选第 ${page.index + 1} 页事实证据` : `Curating facts for page ${page.index + 1}`,
    curatingImages: (page: Pick<PagePlanItem, "index" | "title">) =>
      zh ? `正在筛选第 ${page.index + 1} 页图片素材` : `Curating images for page ${page.index + 1}`,
    prepare: zh ? "正在准备页面文件" : "Preparing page files",
    complete: zh ? "生成完成" : "Generation complete",
    resumed: zh ? "已恢复上次生成进度" : "Resumed previous generation progress",
    interrupted: zh ? "生成已中断，可继续生成" : "Generation interrupted. You can resume.",
    invalidOutline: zh ? "Deck Generation 需要 Confirmed Outline。" : "Deck Generation requires a confirmed outline.",
    staleArtifacts: zh
      ? "无法续跑：现有 Page Plan 或 Page Progress 已过期。"
      : "Unable to resume: the existing page plan or page progress is stale.",
    pageFailed: (page: PageProgress["pages"][number]) =>
      page.last_error ||
      (zh
        ? `页面未通过：${page.status}`
        : `Page did not pass: ${page.status}`),
    pagePassed: (page: Pick<PagePlanItem, "index" | "title">) =>
      zh
        ? `第 ${page.index + 1} 页已通过，继续下一页`
        : `Page ${page.index + 1} passed; continuing to the next page`,
    generatingPage: (page: Pick<PagePlanItem, "index" | "title">, total: number) =>
      zh
        ? `正在生成第 ${page.index + 1} / ${total} 页`
        : `Generating page ${page.index + 1} / ${total}`,
    authoringPage: (page: Pick<PagePlanItem, "index" | "title">) =>
      zh ? `正在思考第 ${page.index + 1} 页的表达` : `Thinking through page ${page.index + 1}`,
    renderingPage: (page: Pick<PagePlanItem, "index" | "title">) =>
      zh ? `正在渲染第 ${page.index + 1} 页` : `Rendering page ${page.index + 1}`,
    reviewingVisuals: (page: Pick<PagePlanItem, "index" | "title">) =>
      zh ? `正在检查第 ${page.index + 1} 页视觉效果` : `Reviewing page ${page.index + 1} visuals`,
    cancelled: zh ? "已停止生成" : "Generation stopped",
    agentSessionCacheMissExhausted: zh
      ? "Agent 会话重试后仍失败，请重跑这一页。"
      : "Agent session failed after retrying. Please retry this page.",
    agentToolsUnavailable: zh
      ? "Agent 会话没有可执行工具权限，无法读取或编辑本地 PPT 工作区文件。请在 app grants drawer 中开启 “Let agent sessions use my tools”，然后重试本页或继续生成。"
      : "Agent sessions cannot use executable tools, so they cannot read or edit local PPT workspace files. Enable “Let agent sessions use my tools” in the app grants drawer, then retry this page or resume generation.",
    finalRender: zh ? "正在生成最终预览" : "Generating final preview",
    deckReady: zh ? "演示文稿已生成" : "Deck generated",
    activeSummary: (input: { active: number; accepted: number; failed: number; total: number }) => {
      if (input.failed > 0) {
        return zh
          ? `${input.failed} 页生成失败，${input.accepted}/${input.total} 页已通过`
          : `${input.failed} pages failed, ${input.accepted}/${input.total} accepted`;
      }
      if (input.active > 0) {
        return zh
          ? `正在生成 ${input.active} 页，${input.accepted}/${input.total} 页已通过`
          : `Generating ${input.active} pages, ${input.accepted}/${input.total} accepted`;
      }
      return zh
        ? `${input.accepted}/${input.total} 页已通过`
        : `${input.accepted}/${input.total} pages accepted`;
    },
    failedSummary: (failedCount: number) =>
      zh
        ? `${failedCount} 页生成失败，请重跑失败页`
        : `${failedCount} pages failed. Retry the failed pages.`,
    streamLabel: (pageIndex: number, kind: string) =>
      zh ? `第 ${pageIndex + 1} 页 · ${kind}` : `Page ${pageIndex + 1} · ${kind}`,
  };
}
