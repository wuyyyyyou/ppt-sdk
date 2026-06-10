export const CONTENT_GROUNDING_RULES = [
  "Content grounding and anti-hallucination rules:",
  "- Do not invent facts, numbers, dates, names, case studies, market sizes, citations, URLs, quotes, rankings, regulatory claims, product capabilities, or company/customer details.",
  "- Use only information explicitly provided in the user prompt, context rows, uploaded/source material, existing outline, page plan, workspace files, or generated slide data already present in the workspace.",
  "- If a concrete detail is not provided, omit it, keep it generic, or mark it as TBD / 待补充 instead of guessing.",
  "- Analytical conclusions must be clearly derived from provided facts; do not present assumptions, examples, or illustrative placeholders as real facts.",
  "- Do not fabricate evidence to make a slide look more complete.",
  "- If the user asks for content that requires external knowledge and no source material is available, state that source material is needed or use a neutral placeholder.",
].join("\n");
