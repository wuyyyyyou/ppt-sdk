import {
  AUTO_OUTPUT_LANGUAGE,
  normalizeOutputLanguage,
  readOutlineOutputLanguage,
} from "../../ai/outputLanguage";
import type {
  AgentPageContentReviewResult,
  AgentPageVisualReviewResult,
} from "../../agent/agentClient";
import type {
  GetWorkspacePageFileFingerprintsResult,
  PagePlan,
  PagePlanItem,
  RenderWorkspacePagePreviewResult,
  WorkspaceOutline,
} from "../../api/types";
import type { Locale } from "../../i18n/messages";
import type {
  NoChangeAuthoringRetry,
  PageRefinementVisualContext,
  RenderFailureHistoryItem,
  RenderFailurePhase,
} from "./types";

export function extractRenderFailureDiagnosticSummary(error: string): string {
  const diagnosticLine = error
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /:\d+:\d+\s+TS\d+:/.test(line));
  if (diagnosticLine) return diagnosticLine;
  return error.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() || error;
}

export function extractRenderFailureDiagnosticKey(summary: string): string {
  const match = summary.match(/^(.+?:\d+:\d+)\s+(TS\d+):/);
  return match ? `${match[1]} ${match[2]}` : summary;
}

export function summarizeRenderFailureHistory(history: RenderFailureHistoryItem[]) {
  const grouped = new Map<string, {
    attempts: number[];
    phases: Set<RenderFailurePhase>;
    diagnostic: string;
  }>();

  for (const item of history) {
    const diagnostic = extractRenderFailureDiagnosticSummary(item.error);
    const key = extractRenderFailureDiagnosticKey(diagnostic);
    const existing = grouped.get(key);
    if (existing) {
      existing.attempts.push(item.attempt);
      existing.phases.add(item.phase);
      continue;
    }
    grouped.set(key, {
      attempts: [item.attempt],
      phases: new Set([item.phase]),
      diagnostic,
    });
  }

  return Array.from(grouped.values()).map((item) => ({
    attempts: item.attempts,
    phases: Array.from(item.phases),
    repeated_count: item.attempts.length,
    diagnostic: item.diagnostic,
  }));
}

export function buildAuthoringPrompt(input: {
  workspaceDir: string;
  page: PagePlanItem;
  pagePlan: PagePlan;
  outline: WorkspaceOutline;
  attemptKind: "initial" | "page-refinement" | "render-fix" | "visual-review-fix" | "content-review-fix";
  pageRefinementRequest?: string;
  renderError?: string;
  renderFailureHistory?: RenderFailureHistoryItem[];
  visualReview?: AgentPageVisualReviewResult | null;
  contentReview?: AgentPageContentReviewResult | null;
  pageRefinementVisualContext?: PageRefinementVisualContext;
  noChangeRetry?: NoChangeAuthoringRetry | null;
}) {
  const hasFailureFix = Boolean(input.renderError || input.visualReview || input.contentReview);
  const pageRefinementRequest = input.pageRefinementRequest?.trim() ?? "";
  const renderFailureHistory = (input.renderFailureHistory ?? []).slice(-10);
  const relativeSlidePath = `template/${input.page.slide_path.replace(/^\.\//, "")}`;
  const relativeDataPath = `template/${input.page.data_path.replace(/^\.\//, "")}`;
  const slidePath = `${input.workspaceDir}/${relativeSlidePath}`;
  const dataPath = `${input.workspaceDir}/${relativeDataPath}`;
  const blueprintSourcePath = `${input.workspaceDir}/template/${input.page.blueprint_source.replace(/^\.\//, "")}`;
  const currentPageEvidencePath = `${input.workspaceDir}/research/evidence/pages/${input.page.page_id}.md`;
  const evidenceIndexPath = `${input.workspaceDir}/research/evidence-index.json`;
  const neighborPageTitles = input.pagePlan.pages
    .filter((page) => page.page_id !== input.page.page_id && Math.abs(page.index - input.page.index) <= 1)
    .sort((left, right) => left.index - right.index)
    .map((page) => `- Page ${page.index + 1}: ${page.title}`)
    .join("\n") || "- No neighbor pages";
  const modeSpecificPriority = input.renderError
    ? [
        "This is a render-fix pass. Fix the render error first, and make only design or code changes that support that fix.",
        "For TypeScript diagnostics, fix the exact expression at file:line:column first.",
        "If a source excerpt with a caret is present, treat the caret target as the primary suspect.",
        "Do not infer the failing API from the generic TypeScript message alone.",
        "Do not introduce unrelated redesigns, new content, or broad refactors during render-fix.",
      ].join("\n")
    : input.contentReview
      ? [
          "This is a content-review-fix pass. Fix the language, alignment, or grounding issues reported by Page Content Review first.",
          "Do not perform broad page-structure redesigns during render-fix, visual-review-fix, or content-review-fix.",
          "Prefer editing the current page data JSON. Do not modify outline.json, page-plan.json, other pages, or unrelated shared files.",
          "Do not replace unsupported claims with new unsupported claims. If source support is missing, remove, generalize, or mark the content as TBD / 待补充.",
          "Never satisfy a rewrite request by inventing or approximating real-world numbers.",
        ].join("\n")
      : input.visualReview
        ? [
            "This is a visual-review-fix pass. Fix the visual issue reported by Page Visual Review first.",
            "Make only necessary visual and layout changes, and do not add new factual claims.",
          ].join("\n")
        : pageRefinementRequest
          ? [
              "This is a refinement pass. Apply the user's refinement request to this Page Generation Unit.",
              "For Deck Refinement requests, preserve useful existing page work while applying the whole-deck change and the page-level reason.",
              "You may adjust page structure, component composition, TSX, and data when needed to satisfy the refinement request.",
              "Preserve the Confirmed Outline, Page Plan, and Template boundaries. Treat only facts, numbers, dates, names, and claims explicitly stated in the request as grounding for this refinement run.",
            ].join("\n")
          : "This is an initial authoring pass. Create the best version of this page from the current page plan, template components, and available grounded evidence.";

  return [
    "You are a local file-editing Agent authoring one TSX-first PPT slide.",
    "You are a local file-editing Agent generating one PPT slide.",
    "Edit files directly on disk. Work only on the current page unless a shared component or theme change is truly necessary.",
    "",
    `Authoring mode: ${input.attemptKind}`,
    "",
    "Highest priority:",
    modeSpecificPriority,
    "",
    hasFailureFix
      ? [
          "Failure-fix input:",
          input.renderError && renderFailureHistory.length > 1
            ? [
                "Repeated render failure summary:",
                "The following compressed JSON groups prior render or pre-render check failures for this page in the current run. Use it to avoid repeating the same failed fix.",
                "Each item groups identical diagnostics by file:line:column and TS code when available.",
                JSON.stringify(summarizeRenderFailureHistory(renderFailureHistory), null, 2),
              ].join("\n")
            : "",
          input.renderError ? `Render error to fix:\n${input.renderError}` : "",
          input.visualReview ? `Visual review failed. Fix request:\n${JSON.stringify(input.visualReview)}` : "",
          input.contentReview
            ? [
                "Page Content Review failed. Rewrite request:",
                JSON.stringify(input.contentReview),
                "If the review asks for real facts, numbers, dates, or source-backed data that are not present in workspace files, do not add those facts. Remove, generalize, or mark them as TBD / 待补充.",
              ].join("\n")
            : "",
        ].filter(Boolean).join("\n")
      : "",
    pageRefinementRequest
      ? [
          "Refinement Request:",
          pageRefinementRequest,
          "This is a user-requested refinement for the current Page Generation Unit, not a Page Visual Review failure and not a Page Generation Retry.",
          "Adjust only the current page files. Preserve existing grounded content unless the request explicitly changes it.",
          "Do not infer adjacent facts, complete missing time series, derive unstated metrics, or treat existing generated content as grounding.",
        ].join("\n")
      : "",
    pageRefinementRequest
      ? [
          "Page Refinement Visual Context:",
          input.pageRefinementVisualContext?.screenshotPath
            ? [
                `Screenshot path: ${input.pageRefinementVisualContext.screenshotPath}`,
                `Screenshot source: ${input.pageRefinementVisualContext.source}`,
                "Before editing, first call `upload_local_file` with the screenshot path, then call `analyze_image` on the uploaded image.",
                "Use the image analysis for visual and layout decisions only: hierarchy, density, whitespace, overlap, readability, and visual emphasis.",
                "The screenshot is not factual grounding evidence. Text, numbers, charts, logos, dates, claims, or source names visible in the screenshot are not grounded unless separately present in allowed grounding sources.",
                "If upload or image analysis fails, continue without visual context and mention the degradation in the final JSON notes.",
              ].join("\n")
            : [
                `No screenshot visual context is available: ${input.pageRefinementVisualContext?.unavailableReason ?? "not resolved"}.`,
                "Continue the refinement without visual context. Do not treat any screenshot as factual evidence.",
              ].join("\n"),
        ].join("\n")
      : "",
    input.noChangeRetry
      ? [
          "Previous authoring attempt did not modify the target page files.",
          `No-change retry count: ${input.noChangeRetry.retryCount}`,
          "The previous run completed, but both the current slide TSX and current data JSON had identical file hashes before and after the run.",
          "You must make a real edit to at least one of these target files when the authoring request requires a change:",
          `- ${slidePath}`,
          `- ${dataPath}`,
          input.noChangeRetry.previousChangedFiles.length > 0
            ? `Previous changed_files claim: ${JSON.stringify(input.noChangeRetry.previousChangedFiles)}`
            : "Previous changed_files claim: []",
          input.noChangeRetry.previousSummary
            ? `Previous summary: ${input.noChangeRetry.previousSummary}`
            : "",
          "Do not only return a summary claiming changes.",
        ].filter(Boolean).join("\n")
      : "",
    "",
    "Current page context:",
    `- Workspace directory: ${input.workspaceDir}`,
    `- Deck title: ${input.outline.title || input.pagePlan.title}`,
    `- Output content language: ${readOutlineOutputLanguage(input.outline)}`,
    `- Current page index: ${input.page.index}`,
    `- Current page id: ${input.page.page_id}`,
    `- Current page title: ${input.page.title}`,
    `- Current page outline: ${input.page.outline}`,
    `- Current page Page Plan reason: ${input.page.reason}`,
    `- Current slide TSX path: ${slidePath}`,
    `- Current data JSON path: ${dataPath}`,
    `- Selected blueprint id: ${input.page.blueprint_id}`,
    `- Selected blueprint source: ${blueprintSourcePath}`,
    "",
    [
      "Neighbor pages:",
      neighborPageTitles,
    ].join("\n"),
    "",
    [
      "Before editing, read these files in order:",
      `1. Current slide TSX: ${slidePath}`,
      `2. Current data JSON: ${dataPath}`,
      `3. Current blueprint source: ${blueprintSourcePath}`,
      `4. Workspace outline: ${input.workspaceDir}/outline.json`,
      `5. Workspace page plan: ${input.workspaceDir}/page-plan.json`,
      `6. Template component guide: ${input.workspaceDir}/template/components/README.md`,
      `7. Slide authoring guide: ${input.workspaceDir}/template/slides/README.md`,
      `8. REQUIRED when present, current-page Research Evidence: ${currentPageEvidencePath}`,
      `9. REQUIRED when present, deck-level Research Evidence index: ${evidenceIndexPath}`,
      `Also read ${currentPageEvidencePath} if it exists.`,
      `Also read ${evidenceIndexPath} if it exists.`,
      "10. Before using any component from template/components, read that component's source file.",
    ].join("\n"),
    "",
    [
      "Authoring composition strategy:",
      "- The current slide TSX/data you receive is based on the selected blueprint. Treat it as a starting canvas, not a finished slide.",
      "- Build the page primarily by composing existing template components.",
      "- Do not hand-code bespoke page sections, cards, KPI blocks, charts, or decorative structures when existing template components can express the same intent.",
      "- Add, remove, reorder, resize, or reconfigure components when needed to fit the page message and evidence.",
      "- Avoid mechanically cloning the selected blueprint structure across pages.",
    ].join("\n"),
    "",
    [
      "Grounding rules:",
      "- Treat the current slide TSX and current data JSON as editable draft content, not as factual sources.",
      "Authoring grounding source rules:",
      "- Treat the current slide TSX and current data JSON as editable draft content, not as sources of truth.",
      "- Current generated content must not be used as evidence for new factual claims, numbers, dates, chart data, KPIs, rankings, citations, or source-backed details.",
      "- Allowed grounding sources are only: the user's original prompt; context rows; task_context; uploaded or source material represented in workspace artifacts; Confirmed Outline source prompt/context/task_context; Confirmed Outline text; current Page Plan title/outline/reason when they restate or directly derive from the Confirmed Outline; current-page Research Evidence; Shared Research Evidence; and, in page-refinement mode, facts, numbers, dates, names, and claims explicitly stated in the current Page Refinement Request.",
      "- Not grounding sources: current generated data JSON or slide TSX; generated pages; rendered HTML; screenshots; visual review output; Agent summaries; Raw Research Material; and other pages' Research Evidence unless it is explicitly Shared Research Evidence.",
      "- Do not use Raw Research Material as evidence unless it has been curated into Research Evidence.",
      "- Do not call search tools during Page Authoring.",
      "- If source support is missing, remove the detail, generalize it, or mark it as TBD / 待补充 / 待确认.",
      "- Do not invent facts, numbers, years, rankings, citations, URLs, organization names, market data, customer cases, or chart data for completeness, polish, or realism.",
      "- Analytical conclusions must be clearly derived from provided facts.",
      "- If the requested content requires external knowledge and no source material is available, omit it, generalize it, or mark it as TBD / 待补充 / 待确认.",
    ].join("\n"),
    "",
    [
      "Research Evidence rules:",
      "- Current-page Research Evidence markdown may contain these sections:",
      "  - ## Facts: factual claims you may use on this page.",
      "  - ## Derived Insights: conclusions you may use only when they trace back to supporting fact ids.",
      "  - ## Visual Assets: curated local image assets for this page. Each asset usually includes an id and file_path.",
      "  - ## Gaps: missing or insufficient evidence. Do not fill these gaps yourself.",
      "- Use only content promoted into Research Evidence. Do not read or use raw research files by default.",
      "- If Research Evidence contains gaps, the corresponding concrete details must be omitted, generalized, or marked as TBD / 待补充.",
    ].join("\n"),
    "",
    [
      "Visual asset decision rules:",
      "- If the current-page Research Evidence contains ## Visual Assets, evaluate those assets before deciding the layout.",
      "- If the current page outline or Page Plan asks for photos, logos, cities, stadiums, products, people, places, or other real-world visuals, use at least one relevant Visual Asset by default.",
      "- When using an image, prefer the Visual Asset local file_path. Use image_url only when no file_path is available.",
      "- When writing a local Visual Asset path into slide data or an <img src>, convert the local filesystem path to a file:// URL, for example file:///Users/name/workspace/research/evidence/images/asset.png. Do not write raw relative paths or bare absolute filesystem paths into image URL fields unless the component explicitly expects a filesystem path.",
      "- Skip all Visual Assets only when they are irrelevant to the page intent, visually unusable, unavailable by path, or likely to mislead.",
      "- If you skip Visual Assets, explain why in final JSON visual_assets_skipped_reason.",
      "- Visual Assets are visual evidence only. Text, charts, rankings, numbers, or claims visible inside an image are not grounded facts unless separately listed under ## Facts.",
      "- Image captions, labels, and surrounding explanations must be grounded in ## Facts, Confirmed Outline, or Page Plan.",
    ].join("\n"),
    "",
    [
      "Authoring process:",
      "1. Read the required files.",
      "2. Extract usable facts, derived insights, visual assets, and gaps from current-page Research Evidence.",
      "3. Decide the page-specific message from the current page title, outline, Page Plan reason, available evidence, and output language.",
      "4. Choose 2-4 suitable components or component families from template/components.",
      "5. Judge whether the selected blueprint's default structure fits the current page. If it does not, restructure the current page TSX instead of mechanically filling blueprint fields.",
      "6. Edit the current data JSON and slide TSX.",
      "7. Keep content grounded, layout stable, and export-friendly.",
      "8. Return the required final JSON.",
    ].join("\n"),
    "",
    [
      "Component rules:",
      "- Prefer composing existing template components and blueprint-local patterns.",
      "- Do not hand-code new cards, KPIs, tables, matrices, charts, or decorative structures when an existing component can express the same intent.",
      "- Read the component source file, not only components/README.md.",
      "- Before using or modifying any component from template/components, read the component source file, not only README.",
      "- Treat exported TypeScript props as the component API contract.",
      "- Do not invent prop names from component names or README descriptions.",
      "- Every JSX component call must provide required props with the correct shape.",
      "- Modify shared components or theme only when multiple pages need the same new visual unit or another clear reason exists.",
    ].join("\n"),
    "",
    [
      "TSX hard rules:",
      "- Each slide must be a fixed 1280x720 canvas, with no scrolling and no required interaction.",
      "- Every slide TSX must export Schema, default React component, layoutId, layoutName, and layoutDescription.",
      "- Use zod Schema defaults and parse data before rendering.",
      "- Keep business content in the current data JSON where practical. Use TSX mainly for layout, component composition, hierarchy, data mapping, and stable visual structure.",
      "- Manifest entries must point to ./slides/*.tsx and ./data/*.json.",
      "- Local component imports must use the .js suffix, for example ../components/Foo.js.",
      "- Do not modify blueprints/ or reference-slides/. They are read-only references.",
      "- Keep key titles, body copy, labels, KPIs, and chart explanations as real DOM text, not images or canvas.",
      "- Chart-heavy or graphic-heavy regions may use data-pptx-export=\"screenshot\"; keep surrounding titles and explanations as normal text.",
      "- Follow template/slides/README.md for PPTX export stability guidance.",
      "- Edit only the current page TSX/data by default. Change shared components or theme only when clearly necessary.",
    ].join("\n"),
    "",
    [
      "Numeric and chart rules:",
      "Numeric and chart authoring rules:",
      "- Do not invent, estimate, approximate, or complete plausible-looking numbers. This includes revenue, cash flow, profit, margins, ROE, growth rates, percentages, target ranges, rankings, market share, store counts, user counts, customer counts, years, currency values, chart series values, and table data.",
      "- Do not invent, estimate, approximate, or make up plausible-looking numbers.",
      "- If an evidence source does not provide a concrete number, do not create one for polish, realism, visual balance, or blueprint field needs.",
      "- If a chart, table, or KPI layout is useful but source data is missing, use explicit placeholders: KPI values should be TBD / 待补充 / 待确认; chart series values may be all zero; chart titles, notes, or nearby text must clearly say 数据待补充 / 示意 / 待确认.",
      "- If source data is missing, set chart series values to all zeros and label the chart as 数据待补充 / 示意 / 待确认.",
      "- Without source data, do not use realistic-looking time or metric labels such as FY20-FY23, recent years, quarterly labels, or target lines. Prefer neutral labels such as Phase 1, Phase 2, Phase 3 or Item 1, Item 2.",
      "- Without source data, do not use real-looking time labels such as FY20-FY23.",
      "- chart ticks, minValue, and maxValue may be visual scale controls, but they must not imply real measured ranges unless evidence explicitly supports them.",
      "- Do not describe placeholder numbers as design decisions in final summary notes. If placeholders are used, say that source data is pending.",
    ].join("\n"),
    "",
    [
      "Final response must be a JSON object and must include these fields:",
      JSON.stringify({
        status: "ready_for_render",
        changed_files: [relativeSlidePath, relativeDataPath],
        summary: "...",
        needs_render: true,
        research_evidence_read: true,
        visual_assets_used: ["image-id"],
        visual_assets_skipped_reason: "",
        components_used: ["ComponentName"],
        notes: [],
      }, null, 2),
    ].join("\n"),
  ]
    .filter(Boolean)
    .join("\n");
}

function resolveReviewExpectedOutputLanguage(
  outline: WorkspaceOutline,
): string | null {
  const outlineLanguage = normalizeOutputLanguage(outline.output_language);
  if (outlineLanguage !== AUTO_OUTPUT_LANGUAGE) {
    return outlineLanguage;
  }

  const settingLanguage = normalizeOutputLanguage(outline.source?.setting?.output_language);
  return settingLanguage !== AUTO_OUTPUT_LANGUAGE ? settingLanguage : null;
}

export function targetPageFilesChanged(
  before: GetWorkspacePageFileFingerprintsResult,
  after: GetWorkspacePageFileFingerprintsResult,
) {
  return before.slide.sha256 !== after.slide.sha256 ||
    before.data.sha256 !== after.data.sha256;
}

export function targetPageNoChangeMessage(locale: Locale, page: PagePlanItem) {
  return locale === "zh"
    ? `页面生成失败：Agent 多次完成响应但没有实际修改当前页 TSX 或 data 文件（${page.title || page.page_id}）。`
    : `Page generation failed: the Agent completed multiple times without modifying the current page TSX or data file (${page.title || page.page_id}).`;
}

export function targetPageFingerprintReadErrorMessage(locale: Locale, page: PagePlanItem, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  return locale === "zh"
    ? `页面生成失败：无法读取当前页 TSX 或 data 文件用于 hash 校验（${page.title || page.page_id}）：${detail}`
    : `Page generation failed: unable to read the current page TSX or data file for hash validation (${page.title || page.page_id}): ${detail}`;
}

export function buildPageContentReviewPrompt(input: {
  workspaceDir: string;
  page: PagePlanItem;
  pagePlan: PagePlan;
  outline: WorkspaceOutline;
  pageRefinementRequest?: string;
}) {
  const expectedOutputLanguage = resolveReviewExpectedOutputLanguage(input.outline);
  const pageRefinementRequest = input.pageRefinementRequest?.trim() ?? "";
  const languageInstruction = expectedOutputLanguage
    ? [
        `Expected output language: ${expectedOutputLanguage}`,
        "Fail with a language issue when the current page's main visible textual content is not in the expected output language.",
      ].join("\n")
    : "No explicit expected output language is available. Language check passes by default; do not fail this review for language.";

  return [
    "You are a Page Content Review agent for one generated PPT slide.",
    "Review only the current page's user-facing textual content: visible slide text plus speaker notes when they are part of the generated page data. Do not judge visual layout quality.",
    "Read these files before judging, in this order:",
    `1. Current data JSON: ${input.workspaceDir}/template/${input.page.data_path.replace(/^\.\//, "")}`,
    `2. Current slide TSX for visibility/schema interpretation: ${input.workspaceDir}/template/${input.page.slide_path.replace(/^\.\//, "")}`,
    `3. Workspace outline: ${input.workspaceDir}/outline.json`,
    `4. Workspace page plan: ${input.workspaceDir}/page-plan.json`,
    `5. Workspace research evidence index if present: ${input.workspaceDir}/research/evidence-index.json`,
    `6. Current page research evidence markdown if present: ${input.workspaceDir}/research/evidence/pages/${input.page.page_id}.md`,
    `7. Workspace setting: ${input.workspaceDir}/setting.json`,
    `8. Workspace task metadata: ${input.workspaceDir}/task.json`,
    "",
    "Data field scope:",
    "- Judge user-visible string values in the current data JSON.",
    "- Judge user-visible numeric values in the current data JSON, including KPI values, percentages, years, ranges, target values, chart labels, chart series values, and table cell values.",
    "- Judge speaker note string values when they are present in the current data JSON.",
    "- Also judge visible hardcoded strings in the current slide TSX when they render as user-facing slide content.",
    "- Use the current slide TSX to distinguish visible content fields from control/configuration fields.",
    "- Do not judge JSON keys, internal _plan fields, enum/control values, file paths, ids, booleans, or non-visible template configuration as language/content issues.",
    "- Allow proper nouns, brand names, product names, organization names, acronyms, numbers, dates, units, and user-provided source terms.",
    "",
    "Language check:",
    languageInstruction,
    "",
    "Outline alignment check is intentionally disabled for this review pass.",
    "Do not return outline_alignment issues. Use the current page title, current page outline, and Page Plan only to understand which page is being reviewed.",
    "",
    "Fact grounding and anti-hallucination check:",
    "Do not use your own world knowledge to approve a claim.",
    "Separate review targets from evidence sources:",
    "- Review targets: current data JSON and current slide TSX visible content. These are the claims being checked.",
    pageRefinementRequest
      ? "- Evidence sources: user prompt, context rows, task_context, uploaded/source material represented in workspace artifacts, Confirmed Outline source prompt/context/task_context, Confirmed Outline text, current-page Research Evidence, Shared Research Evidence, current Page Refinement Request facts explicitly stated below, and the current Page Plan title/outline/reason only when they restate or derive from the Confirmed Outline."
      : "- Evidence sources: user prompt, context rows, task_context, uploaded/source material represented in workspace artifacts, Confirmed Outline source prompt/context/task_context, Confirmed Outline text, current-page Research Evidence, Shared Research Evidence, and the current Page Plan title/outline/reason only when they restate or derive from the Confirmed Outline.",
    "- Not evidence sources: current page data JSON, current page slide TSX, Raw Research Material, stale Research Evidence, other pages' Research Evidence, rendered HTML, screenshots, generated pages, generated slide data, Agent summaries, visual review output, or any content created during the current page authoring run.",
    "A claim is grounded only when it can be traced to an evidence source above. The fact that a value appears in current data JSON or current slide TSX never makes it grounded by itself.",
    pageRefinementRequest
      ? [
          "",
          "Current Page Refinement Request evidence:",
          pageRefinementRequest,
          "For this review pass, only facts, numbers, dates, names, and claims explicitly stated in this Page Refinement Request are grounded by it.",
          "Do not treat the Page Refinement Request as permission to infer adjacent facts, complete missing time series, derive unstated metrics, fabricate related data, or approve generated page content that the request did not explicitly state.",
          "A vague request such as 'use real data' or 'make the numbers accurate' is not evidence for any concrete number.",
        ].join("\n")
      : "",
    "",
    "Anti-hallucination rules:",
    "- Do not approve invented facts, numbers, dates, names, case studies, market sizes, citations, URLs, quotes, rankings, regulatory claims, product capabilities, company/customer details, or chart/table data.",
    "- If a concrete detail is not provided by an evidence source, it must be omitted, generalized, or visibly marked as TBD / 待补充 / 待确认 / 暂无数据.",
    "- Analytical conclusions must be clearly derived from evidence sources. Do not present assumptions, examples, estimates, or illustrative placeholders as real facts.",
    "- Do not approve fabricated evidence just because it makes the slide look complete.",
    "- If the requested content requires external knowledge and no source material is available, the slide should say that source material is needed or use a neutral placeholder.",
    "",
    "Treat these as unsupported unless explicitly present in the evidence sources: numbers, dates, market sizes, growth rates, customer names, case studies, product capabilities, URLs, citations, quotes, rankings, regulatory/legal claims, geography-specific facts, and claims about competitors or named organizations.",
    "Numeric and chart data rules:",
    "- Pay special attention to chart and table data: labels, year labels, category labels, series[].values, percentages, currency values, KPI values, target values, ranges, rankings, growth rates, min/max values when they imply real scale, and chart titles/subtitles that claim a real trend.",
    "- Chart data is not grounded merely because the selected blueprint expects a chart or because the page outline mentions performance, growth, revenue, cash flow, customers, or digital transformation.",
    "- Do not approve plausible-looking placeholder numbers such as FY values, percentages, revenue, cash flow, ROE, store counts, market share, or growth rates unless an evidence source provides them.",
    "- Chart ticks, minValue, and maxValue can be treated as visual scale controls only when they do not assert a real value range. If they combine with real labels or titles to imply actual data, review them as numeric claims.",
    "- All-zero chart/table series can pass only when the visible chart title, subtitle, note, or nearby text clearly marks the data as TBD / 待补充 / 示意.",
    "Clear placeholders such as TBD, 待补充, 待确认, 暂无数据, or 数据待补充 are acceptable grounding treatments when the workspace lacks source material. Do not report them as grounding issues solely because the page openly marks a fact or chart as pending.",
    "Chart or table placeholder values such as all-zero series can pass grounding when the visible chart title, subtitle, note, or nearby text clearly marks the data as TBD / 待补充 / 示意. If you need to mention them, use type placeholder_quality with low severity, not type grounding.",
    "Unsupported concrete facts, numbers, dates, years, chart data, or named-organization claims that are not present in workspace artifacts must be reported as type grounding, must set pass=false, and must include a concrete rewrite_request. Never downgrade unsupported concrete facts to placeholder_quality or low-severity advisory issues.",
    "Never ask the authoring agent to replace placeholders with real facts, numbers, dates, or chart data unless you can point to the exact workspace artifact that provides those facts. Without such a source, rewrite_request must ask to remove, soften, generalize, or mark the content as TBD / 待补充.",
    "Generic business phrasing can pass if it is clearly not presented as a concrete fact.",
    "For each grounding issue, evidence should quote the problematic text or value and include the data field path or TSX location when available.",
    "For each grounding issue, reason must state which evidence sources were checked and that none provide the claim.",
    "rewrite_request must be actionable for the authoring agent, scoped to the current page, and should name the exact text or field to change when possible.",
    "Return only one JSON object matching this shape:",
    '{"pass":true,"score":8,"issues":[{"type":"language","severity":"high","evidence":"...","reason":"...","fix_hint":"..."},{"type":"grounding","severity":"high","evidence":"...","reason":"...","fix_hint":"..."},{"type":"placeholder_quality","severity":"low","evidence":"...","reason":"...","fix_hint":"..."}],"rewrite_request":"","confidence":"medium"}',
    "Do not include markdown, code fences, explanations, or any extra text.",
    "",
    "Use score 0-10. pass=true requires score >= 7, confidence not low, no language or grounding issues.",
    "placeholder_quality issues are advisory and may pass when score and confidence are sufficient. language and grounding issues require pass=false and a concrete rewrite_request.",
    `Current page title: ${input.page.title}`,
    `Current page outline: ${input.page.outline}`,
    `Full outline JSON: ${JSON.stringify(input.outline)}`,
    `Full page plan JSON: ${JSON.stringify(input.pagePlan)}`,
  ].join("\n");
}

export function buildPageVisualReviewPrompt(input: {
  page: PagePlanItem;
  screenshotPath: string;
  preview: RenderWorkspacePagePreviewResult;
}) {
  return [
    "You are a Page Visual Review agent for one generated PPT slide.",
    "Review only the generated PPT slide screenshot for visual quality.",
    "Do not judge output language, outline alignment, factual grounding, unsupported claims, or content correctness.",
    "Do not fail a slide merely because some content is explicitly marked TBD / 待补充; judge only whether the placeholder is visually clear, readable, and does not break the layout.",
    "First use `upload_local_file` on the screenshot path, then inspect that uploaded image with `analyze_image` before making a visual judgment.",
    "If image analysis is unavailable or inconclusive, use the rendered HTML path as fallback context and still return a JSON review.",
    "Return only one JSON object matching this shape:",
    '{"pass":true,"score":8,"issues":[],"revision_request":"","confidence":"medium"}',
    "Do not include markdown, code fences, explanations, or any extra text.",
    "",
    `Screenshot path: ${input.screenshotPath}`,
    `Page title for identification only: ${input.page.title}`,
    `Rendered HTML path: ${input.preview.html_path}`,
    "",
    "Pass only if the slide looks like a complete PPT page, has no obvious overlap/cutoff/blank errors, uses readable text, renders all intended visual regions, and fits the selected template style.",
    "Use score 0-10. pass=true requires score >= 7.",
  ].join("\n");
}

export function visualReviewPassed(review: AgentPageVisualReviewResult) {
  return review.pass && review.score >= 7 && review.confidence !== "low";
  // return true; // 先关闭自评结果中的置信度判断，后续根据实际情况再调整
}

export function contentReviewIssueBlocksPass(issue: AgentPageContentReviewResult["issues"][number]) {
  return issue.type !== "placeholder_quality";
}

export function contentReviewPassed(review: AgentPageContentReviewResult) {
  const hasFailingIssue = review.issues.some(contentReviewIssueBlocksPass);
  return review.pass && review.score >= 7 && review.confidence !== "low" && !hasFailingIssue;
}
