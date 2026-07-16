import { getBrowserRenderRuntimeBundle } from "./runtime-bundle.js";
import type { BrowserRenderContext } from "./types.js";

function escapeJsonForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function createPageSourceRenderContext(input: {
  id: string;
  title: string;
  templateGroup?: string;
}): BrowserRenderContext {
  return {
    templateGroup: input.templateGroup ?? "authoring-kit",
    layoutId: input.id,
    runtimeLayoutId: input.id,
    slideData: {},
    speakerNote: "",
    title: input.title,
    theme: {
      logoUrl: null,
      companyName: null,
      colors: {},
      variables: {},
      fontName: null,
      fontUrl: null,
    },
  };
}

export function buildPageSourceDocumentHtml(input: {
  context: BrowserRenderContext;
  runtimeBundle?: string | null;
  tailwindRuntimeBundle: string;
}): string {
  const runtimeBundle = input.runtimeBundle ?? getBrowserRenderRuntimeBundle();
  const serializedContext = escapeJsonForInlineScript(input.context);
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=1280, initial-scale=1" />',
    `  <title>${input.context.title}</title>`,
    "  <style>",
    "    html, body { margin: 0; padding: 0; width: 1280px; min-height: 720px; overflow: hidden; background: #ffffff; }",
    "    body { position: relative; font-family: system-ui, sans-serif; }",
    "    #presentation-slides-wrapper { width: 1280px; min-height: 720px; }",
    '    [data-presenton-render-status="error"] { display: flex; align-items: center; justify-content: center; color: #991b1b; background: #fef2f2; font-size: 14px; padding: 24px; box-sizing: border-box; }',
    "  </style>",
    '  <script data-presenton-runtime="tailwind">',
    input.tailwindRuntimeBundle,
    "  </script>",
    "</head>",
    "<body>",
    '  <div id="presentation-slides-wrapper" data-presenton-render-status="loading"></div>',
    "  <script>",
    `    window.__PRESENTON_RENDER_CONTEXT__ = ${serializedContext};`,
    "  </script>",
    "  <script>",
    runtimeBundle,
    "  </script>",
    "</body>",
    "</html>",
  ].join("\n");
}
