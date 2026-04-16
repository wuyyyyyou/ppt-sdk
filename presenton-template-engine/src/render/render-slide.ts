import { templates } from "../app/presentation-templates/index.js";
import type { TemplateWithData } from "../app/presentation-templates/utils.js";
import { getBrowserRenderRuntimeBundle } from "./runtime-bundle.js";
import type {
  BrowserRenderContext,
  BrowserRenderTheme,
  RenderSlideHtmlInput,
  TemplateRenderThemeInput,
} from "./types.js";

function normalizeLayoutId(templateGroup: string, layoutId: string): string {
  if (!layoutId) {
    throw new Error('Missing required field "layout_id"');
  }

  if (layoutId.includes(":")) {
    const [groupId] = layoutId.split(":");
    if (groupId !== templateGroup) {
      throw new Error(
        `Layout "${layoutId}" does not belong to template group "${templateGroup}"`,
      );
    }
    return layoutId;
  }

  return `${templateGroup}:${layoutId}`;
}

function resolveLayout(
  templateGroup: string,
  layoutId: string,
): { groupName: string; layout: TemplateWithData } {
  const group = templates.find((item) => item.id === templateGroup);
  if (!group) {
    throw new Error(`Template group "${templateGroup}" not found`);
  }

  const fullLayoutId = normalizeLayoutId(templateGroup, layoutId);
  const layout = group.layouts.find(
    (item: TemplateWithData) => item.layoutId === fullLayoutId,
  );
  if (!layout) {
    throw new Error(
      `Layout "${layoutId}" not found in template group "${templateGroup}"`,
    );
  }

  return {
    groupName: group.name,
    layout,
  };
}

function normalizeTheme(input?: TemplateRenderThemeInput | null): BrowserRenderTheme {
  const colors = input?.colors ?? input?.data?.colors ?? {};
  const font = input?.fonts?.body ?? input?.data?.fonts?.textFont ?? null;

  return {
    logoUrl: input?.logo_url ?? null,
    companyName: input?.company_name ?? null,
    colors: { ...colors },
    fontName: font?.name ?? null,
    fontUrl: font?.url ?? null,
  };
}

function escapeJsonForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function buildDocumentHtml(context: BrowserRenderContext): string {
  const runtimeBundle = getBrowserRenderRuntimeBundle();
  const serializedContext = escapeJsonForInlineScript(context);

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=1280, initial-scale=1" />',
    `  <title>${context.title}</title>`,
    "  <style>",
    "    html, body {",
    "      margin: 0;",
    "      padding: 0;",
    "      width: 1280px;",
    "      min-height: 720px;",
    "      overflow: hidden;",
    "      background: #ffffff;",
    "    }",
    "    body {",
    "      position: relative;",
    "      font-family: system-ui, sans-serif;",
    "    }",
    "    #presentation-slides-wrapper {",
    "      width: 1280px;",
    "      min-height: 720px;",
    "    }",
    '    [data-presenton-render-status="error"] {',
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
    "  <script>",
    "    window.tailwind = window.tailwind || {};",
    "  </script>",
    '  <script src="https://cdn.tailwindcss.com"></script>',
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

export function renderSlideHtml(input: RenderSlideHtmlInput): string {
  if (!input || typeof input !== "object") {
    throw new Error("Render input must be an object");
  }

  if (!input.template_group) {
    throw new Error('Missing required field "template_group"');
  }

  if (!input.slide_data || typeof input.slide_data !== "object" || Array.isArray(input.slide_data)) {
    throw new Error('Field "slide_data" must be an object');
  }

  const { groupName, layout } = resolveLayout(input.template_group, input.layout_id);
  const theme = normalizeTheme(input.theme);
  const context: BrowserRenderContext = {
    templateGroup: input.template_group,
    layoutId: layout.layoutId,
    slideData: input.slide_data,
    speakerNote: input.speaker_note ?? "",
    title: input.title ?? `${groupName} - ${layout.layoutName}`,
    theme,
  };

  return buildDocumentHtml(context);
}
