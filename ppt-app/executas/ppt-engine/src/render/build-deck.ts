import { getBrowserRenderDeckRuntimeBundle } from "./runtime-bundle.js";
import type { BrowserRenderContext, BuildDeckHtmlInput, BuildStandaloneDeckHtmlInput } from "./types.js";

const PRESENTATION_WRAPPER_ID = "presentation-slides-wrapper";

interface ParsedSlideInput {
  speakerNote: string;
  context: BrowserRenderContext | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value);
}

function escapeJsonForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function extractContextFromHtml(html: string): BrowserRenderContext | null {
  const prefix = "window.__PRESENTON_RENDER_CONTEXT__ = ";
  const assignmentStart = html.indexOf(prefix);
  if (assignmentStart === -1) {
    return null;
  }

  const jsonStart = assignmentStart + prefix.length;
  let index = jsonStart;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let started = false;

  while (index < html.length) {
    const char = html[index];

    if (!started) {
      if (char === "{") {
        started = true;
        depth = 1;
      }
      index += 1;
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      index += 1;
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        const rawJson = html.slice(jsonStart, index + 1);
        return JSON.parse(rawJson) as BrowserRenderContext;
      }
    }

    index += 1;
  }

  throw new Error("Failed to parse window.__PRESENTON_RENDER_CONTEXT__ payload");
}

function extractSpeakerNote(html: string): string {
  const match = html.match(/\bdata-speaker-note\s*=\s*["']([^"']*)["']/i);
  return match ? match[1] : "";
}

function parseSlideInput(slide: BuildDeckHtmlInput["slides"][number]): ParsedSlideInput {
  const context = extractContextFromHtml(slide.html);
  return {
    speakerNote: slide.speaker_note ?? extractSpeakerNote(slide.html),
    context,
  };
}

function buildDeckReadyScript(): string {
  return `
    (() => {
      const wrapper = document.getElementById(${JSON.stringify(PRESENTATION_WRAPPER_ID)});
      wrapper?.setAttribute("data-presenton-render-status", "ready");
      window.dispatchEvent(new CustomEvent("presenton:render-ready"));
    })();
  `.trim();
}

function buildDeckDocumentHtml(input: {
  title: string;
  parsedSlides: ParsedSlideInput[];
  runtimeBundle?: string | null;
  tailwindRuntimeBundle?: string | null;
}): string {
  const runtimeBundle = input.runtimeBundle ?? getBrowserRenderDeckRuntimeBundle();
  const contexts = input.parsedSlides
    .map((slide) => slide.context)
    .filter((context): context is BrowserRenderContext => context !== null);
  const serializedContexts = escapeJsonForInlineScript(contexts);

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=1280, initial-scale=1" />',
    `  <title>${escapeHtml(input.title)}</title>`,
    "  <style>",
    "    html, body { margin: 0; padding: 0; width: 1280px; min-height: 720px; }",
    `    #${PRESENTATION_WRAPPER_ID} { width: 1280px; margin: 0; padding: 0; }`,
    `    #${PRESENTATION_WRAPPER_ID} > [data-presenton-slide-shell="true"] {`,
    "      position: relative;",
    "      display: block;",
    "      visibility: visible;",
    "      width: 1280px;",
    "      height: 720px;",
    "      margin: 0;",
    "      padding: 0;",
    "      overflow: hidden;",
    "    }",
    "    [data-presenton-render-status=\"error\"] {",
    "      display: flex;",
    "      align-items: center;",
    "      justify-content: center;",
    "      color: #991b1b;",
    "      background: #fef2f2;",
    "      font-size: 14px;",
    "      padding: 24px;",
    "      box-sizing: border-box;",
    "    }",
    "  </style>",
    ...(input.tailwindRuntimeBundle
      ? [
        '  <script data-presenton-runtime="tailwind">',
        input.tailwindRuntimeBundle,
        "  </script>",
      ]
      : [
        "  <script>",
        "    window.tailwind = window.tailwind || {};",
        "  </script>",
        '  <script src="https://cdn.tailwindcss.com"></script>',
      ]),
    "</head>",
    "<body>",
    `  <div id="${PRESENTATION_WRAPPER_ID}" data-presenton-render-status="loading">`,
    contexts
      .map((context, index) =>
        [
          `    <div data-presenton-slide-shell="true">`,
          ...(input.parsedSlides[index]?.speakerNote
            ? [`      <template data-pptx-notes>${escapeHtml(input.parsedSlides[index]?.speakerNote ?? "")}</template>`]
            : []),
          `      <div data-presenton-deck-slot="${index}" data-layout="${escapeHtmlAttribute(context.layoutId)}" data-group="${escapeHtmlAttribute(context.templateGroup)}" style="width:1280px;min-height:720px;"></div>`,
          "    </div>",
        ].join("\n"),
      )
      .join("\n"),
    "  </div>",
    "  <script>",
    `    window.__PRESENTON_RENDER_CONTEXTS__ = ${serializedContexts};`,
    "  </script>",
    contexts.length > 0
      ? ["  <script>", runtimeBundle, "  </script>"].join("\n")
      : ["  <script>", buildDeckReadyScript(), "  </script>"].join("\n"),
    "</body>",
    "</html>",
  ].join("\n");
}

export function buildDeckHtml(input: BuildDeckHtmlInput): string {
  if (!input || typeof input !== "object") {
    throw new Error("Deck input must be an object");
  }

  if (!Array.isArray(input.slides) || input.slides.length === 0) {
    throw new Error('Field "slides" must be a non-empty array');
  }

  const parsedSlides = input.slides.map((slide, index) => {
    if (!slide || typeof slide !== "object" || typeof slide.html !== "string") {
      throw new Error(`Slide at index ${index} must contain an "html" string`);
    }

    const parsed = parseSlideInput(slide);
    if (!parsed.context) {
      throw new Error(`Slide at index ${index} does not contain a render context`);
    }
    return parsed;
  });

  const title =
    input.title ??
    "Presenton Deck";

  return buildDeckDocumentHtml({
    title,
    parsedSlides,
    runtimeBundle: input.runtimeBundle,
    tailwindRuntimeBundle: input.tailwindRuntimeBundle,
  });
}

export function buildStandaloneDeckHtml(
  input: BuildStandaloneDeckHtmlInput,
): string {
  return buildDeckHtml({
    title: input.title,
    slides: input.slides,
    runtimeBundle: input.runtimeBundle,
    tailwindRuntimeBundle: input.tailwindRuntimeBundle,
  });
}
