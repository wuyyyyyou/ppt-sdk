const REQUIREMENTS_JSON_SHAPE = `{
  "audience": [{"label": "...", "description": "..."}],
  "purpose": [{"label": "...", "description": "..."}],
  "desired_outcome": [{"label": "...", "description": "..."}],
  "slide_count": [8],
  "output_language": ["Chinese"],
  "visual_tone": [{"label": "...", "description": "..."}]
}`;

export function buildRequirementsSystemPrompt(visualStylePreset?: { name: string; description: string } | null) {
  const visualField = visualStylePreset
    ? "- visual direction: fixed by the user-selected Visual Style Preset. Do not return visual_tone or visual_style_preset."
    : "- visual_tone: the qualitative visual character and intended viewing experience. It may reference a recognizable editorial or cultural style, but must not prescribe exact colors, fonts, templates, or page layouts.";
  const shape = visualStylePreset
    ? REQUIREMENTS_JSON_SHAPE.replace('  "visual_tone": [{"label": "...", "description": "..."}]\n', "")
    : REQUIREMENTS_JSON_SHAPE;
  return [
    "You are a senior presentation strategist.",
    "Your task is to derive a Presentation Requirements Draft solely from the user's Brief.",
    "",
    "Infer presentation requirements, not presentation content.",
    "Do not invent facts, data, dates, organizations, customers, product capabilities, cases, results, or claims that are not stated in the Brief.",
    "",
    "Return candidates for exactly these fields:",
    "- audience: who will view or use the presentation.",
    "- purpose: the use scenario and task the presentation will serve.",
    "- desired_outcome: what the audience should understand, believe, decide, or do afterward.",
    "- slide_count: the concrete number of slides.",
    "- output_language: the concrete language of the final presentation.",
    visualField,
    "",
    "Candidate rules:",
    "- Preserve every requirement explicitly stated in the Brief.",
    "- Return exactly one candidate when the Brief clearly determines a field.",
    "- Return 2 to 4 materially distinct candidates only when genuine ambiguity remains.",
    "- Put the recommended candidate first.",
    "- Do not create synonymous alternatives merely to increase the candidate count.",
    "- Every slide_count candidate must be a positive integer. Never return \"auto\".",
    "- Every output_language candidate must be concrete. Never defer language selection.",
    "- Semantic candidates contain a concise label and one concise sentence description.",
    "- Write all candidate labels and descriptions in the language primarily used by the Brief.",
    "",
    "Return one JSON object with this exact shape:",
    shape,
    "Return exact JSON only, with no Markdown, code fences, comments, or extra text.",
  ].join("\n");
}

export function buildRequirementsUserPrompt(brief: string, visualStylePreset?: { name: string; description: string } | null) {
  return [
    "Create a Presentation Requirements Draft from the Brief below.",
    "",
    "<brief>",
    brief,
    "</brief>",
    visualStylePreset ? `The user selected Visual Style Preset: ${visualStylePreset.name} — ${visualStylePreset.description}. Do not generate a Visual Tone field.` : "",
  ].join("\n");
}

export function buildRequirementsRepairPrompt(validationErrors: string[], visualStylePreset?: { name: string; description: string } | null) {
  return [
    "The previous response did not satisfy the Presentation Requirements JSON contract.",
    "",
    "Validation errors:",
    ...validationErrors.map((error) => `- ${error}`),
    "",
    "Return one complete corrected JSON object for all six fields.",
    "Do not return only the fields mentioned in the validation errors.",
    "Re-evaluate the previous response against the original Brief and all original instructions.",
    "",
    "Use this exact shape:",
    visualStylePreset
      ? REQUIREMENTS_JSON_SHAPE.replace('  "visual_tone": [{"label": "...", "description": "..."}]\n', "")
      : REQUIREMENTS_JSON_SHAPE,
    "Return JSON only.",
  ].join("\n");
}
