export const TSX_AUTHORING_RULES_SUMMARY = [
  "You are editing TSX-first PPT slides, not a normal web page.",
  "Each slide must be a fixed 1280x720 canvas and render fully without scrolling or interaction.",
  "Every slide TSX must export Schema, default React component, layoutId, layoutName, and layoutDescription.",
  "Use zod Schema defaults and parse data before rendering.",
  "Keep business content in the JSON data where practical; use TSX for layout, component composition, and stable visual structure.",
  "Manifest entries must point to ./slides/*.tsx and ./data/*.json.",
  "Do not modify blueprints/ or reference-slides/. They are read-only references.",
  "Keep key titles, bullets, KPI numbers, labels, and body copy as real DOM text, not canvas or image text.",
  "Avoid fragile mixed inline text structures such as bold span plus bare text in the same paragraph; split into separate text nodes/blocks.",
  "Do not rely on pseudo-elements for critical content or decoration.",
  "Avoid critical gradients, opacity tricks, text-stroke, text-shadow, and transform-based alignment for important text.",
  "Use explicit widths, heights, nowrap, and text alignment for single-line key text.",
  "Chart-heavy or graphic-heavy regions may use data-pptx-export=\"screenshot\"; keep surrounding titles and explanations as normal text.",
  "Use .js suffix for local component imports, for example ../components/Foo.js.",
  "Only edit the current page TSX/data by default; shared components may be changed only with a clear reason.",
].join("\n");

export const AUTHORING_COMPOSITION_STRATEGY = [
  "Authoring composition strategy:",
  "- The current slide TSX/data you receive is based on the selected blueprint. Treat the blueprint as a starting canvas, not a finished slide, not the final page structure, and not a slot template that must be preserved.",
  "- Before editing, read template/components/README.md and use it as the component index for the current template group. Understand the available components, component boundaries, suitable slot types, text capacity, and recommended combinations.",
  "- Before editing, choose the component families that best fit the current page title, outline, Page Plan reason, audience, and available grounded content. Decide how the page should be expressed with template components before changing TSX/data.",
  "- Build the page primarily by composing existing template components, especially template/components building blocks and blueprint-local patterns. Do not hand-code bespoke page sections, cards, KPI blocks, charts, or decorative structures when an existing component can express the same intent. Apply the same rule to tables and matrix-like structures.",
  "- If the blueprint's default structure does not fit the page message, actively restructure the current slides/*.tsx implementation. Add, remove, reorder, resize, or reconfigure components when it improves clarity, hierarchy, or fit.",
  "- Avoid mechanically cloning the selected blueprint structure across pages. Do not only fill the blueprint's existing fields. Each page should make page-specific composition decisions so the structure serves that page's message.",
  "- Keep business content in the current data JSON where practical, and pass it into components through props. Use TSX mainly for component composition, layout, hierarchy, data mapping, and stable visual structure.",
  "- Prefer existing shared/template components for export stability. Create page-local markup only when no suitable component exists, and create or modify shared components only when multiple pages need the same new visual unit or there is another clear reason.",
  "- If a failure report is provided, prioritize fixing the reported failure. Do not perform broad page-structure redesigns during render-fix, visual-review-fix, or content-review-fix unless the failure cannot be fixed without changing structure.",
].join("\n");

export const COMPONENT_SOURCE_CONTRACT_RULES = [
  "Component source contract rules:",
  "Before using or modifying any component from template/components:",
  "1. Read the component source file, not only components/README.md.",
  "2. Treat exported TypeScript props as the API contract.",
  "3. Do not invent prop names based on component names or README descriptions.",
  "4. For every JSX component you call, verify all required props are supplied with the correct shape.",
].join("\n");

export const AUTHORING_GROUNDING_SOURCE_RULES = [
  "Authoring grounding source rules:",
  "- Treat current slide TSX and current data JSON as editable draft content, not as sources of truth for facts or numbers.",
  "- Evidence sources for factual claims are only: user prompt, context rows, task_context, uploaded/source material represented in workspace artifacts, Confirmed Outline source prompt/context/task_context, Confirmed Outline text, and Page Plan title/outline/reason when they restate the Confirmed Outline.",
  "- Existing generated slide data, rendered HTML, screenshots, generated pages, Agent summaries, and visual review output may help with style or deck consistency, but they must not be used as evidence for new factual claims, numbers, dates, chart data, KPIs, or named-organization facts.",
  "- If current page data already contains unsupported concrete values, remove them, generalize them, or mark them as TBD / 待补充 instead of preserving them.",
  "- Analytical conclusions must be clearly derived from provided facts; do not present assumptions, examples, or illustrative placeholders as real facts.",
  "- If the user asks for content that requires external knowledge and no source material is available, use a neutral placeholder or mark the content as TBD / 待补充.",
].join("\n");

export const AUTHORING_NUMERIC_CHART_RULES = [
  "Numeric and chart authoring rules:",
  "- Do not invent, estimate, approximate, or make up plausible-looking numbers. This includes revenue, cash flow, profit, margins, ROE, growth rates, percentages, target ranges, rankings, market share, store counts, user/customer counts, years, currency values, and all chart/table series values.",
  "- If an evidence source does not provide a concrete number, do not create one for polish, realism, visual balance, or because a blueprint expects numeric content.",
  "- If a chart/table/KPI layout is useful but no source data is available, use explicit placeholders: set chart series values to all zeros, keep KPI values as TBD / 待补充 / 待确认 where possible, and make the visible chart title, subtitle, note, or nearby text clearly say 数据待补充 / 示意 / 待确认.",
  "- For charts without source data, do not use real-looking time labels such as FY20-FY23, recent years, quarterly labels, or target bands unless those labels are provided by an evidence source. Prefer neutral placeholder labels such as 阶段一, 阶段二, 阶段三 or 数据项一, 数据项二.",
  "- Chart ticks, minValue, and maxValue may be visual scale controls, but they must not imply real measured ranges unless supported. Pair placeholder charts with visible placeholder wording.",
  "- Never put invented numbers in final summary notes as if they are design decisions; if placeholders are used, say that source data is pending.",
].join("\n");
