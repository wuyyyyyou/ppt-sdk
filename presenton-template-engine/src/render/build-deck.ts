import { getBrowserRenderDeckRuntimeBundle } from "./runtime-bundle.js";
import type { BrowserRenderContext, BuildDeckHtmlInput, BuildStandaloneDeckHtmlInput } from "./types.js";

const PRESENTATION_WRAPPER_ID = "presentation-slides-wrapper";
const DECK_VIEWER_MODE_CLASS = "presenton-viewer-mode";
const DECK_VIEWER_SHELL_CLASS = "presenton-deck-viewer-shell";
const SLIDE_WIDTH = 1280;
const SLIDE_HEIGHT = 720;
const THUMBNAIL_SCALE = 0.1625;
const THUMBNAIL_WIDTH = Math.round(SLIDE_WIDTH * THUMBNAIL_SCALE);
const THUMBNAIL_HEIGHT = Math.round(SLIDE_HEIGHT * THUMBNAIL_SCALE);

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

function buildDeckViewerShellStart(title: string): string[] {
  return [
    `  <div class="${DECK_VIEWER_SHELL_CLASS}" data-presenton-viewer-shell="true" data-presenton-deck-title="${escapeHtmlAttribute(title)}">`,
    '    <aside class="presenton-deck-sidebar" data-presenton-viewer-sidebar="true">',
    '      <div class="presenton-deck-sidebar-header">',
    '        <div class="presenton-deck-sidebar-eyebrow">Deck Overview</div>',
    '        <div class="presenton-deck-sidebar-title">Slides</div>',
    "      </div>",
    '      <div class="presenton-deck-thumbnail-list" data-presenton-thumbnail-list="true"></div>',
    "    </aside>",
    '    <main class="presenton-deck-stage-panel">',
    '      <div class="presenton-deck-stage-toolbar" data-presenton-stage-toolbar="true">',
    '        <div class="presenton-deck-stage-toolbar-copy">',
    '          <div class="presenton-deck-stage-label">Preview</div>',
    '          <div class="presenton-deck-stage-title" data-presenton-stage-title="true"></div>',
    "        </div>",
    '        <div class="presenton-deck-stage-counter" data-presenton-stage-counter="true"></div>',
    "      </div>",
    '      <div class="presenton-deck-stage-viewport" data-presenton-stage-viewport="true">',
    '        <div class="presenton-deck-stage-fit" data-presenton-stage-fit="true">',
  ];
}

function buildDeckViewerShellEnd(): string[] {
  return [
    "        </div>",
    "      </div>",
    "    </main>",
    "  </div>",
  ];
}

function buildDeckSharedStyles(): string[] {
  return [
    "    :root {",
    "      color-scheme: light;",
    "    }",
    "    html, body {",
    "      margin: 0;",
    "      padding: 0;",
    `      width: ${SLIDE_WIDTH}px;`,
    `      min-height: ${SLIDE_HEIGHT}px;`,
    "      overflow: hidden;",
    "      background: #ffffff;",
    "    }",
    "    body {",
    "      position: relative;",
    "      font-family: system-ui, sans-serif;",
    "    }",
    `    .${DECK_VIEWER_SHELL_CLASS} {`,
    `      width: ${SLIDE_WIDTH}px;`,
    `      min-height: ${SLIDE_HEIGHT}px;`,
    "    }",
    `    #${PRESENTATION_WRAPPER_ID} {`,
    `      width: ${SLIDE_WIDTH}px;`,
    `      min-height: ${SLIDE_HEIGHT}px;`,
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS},`,
    `    html.${DECK_VIEWER_MODE_CLASS} body {`,
    "      width: auto;",
    "      min-height: 100%;",
    "      height: 100%;",
    "      overflow: hidden;",
    "      background:",
    "        radial-gradient(circle at top, #f6f8fc 0%, #e6ecf5 44%, #dbe4ef 100%);",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} body {`,
    "      min-height: 100vh;",
    "      color: #112133;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .${DECK_VIEWER_SHELL_CLASS} {`,
    "      display: grid;",
    "      grid-template-columns: 280px minmax(0, 1fr);",
    "      width: 100%;",
    "      height: 100vh;",
    "      min-height: 100vh;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-sidebar {`,
    "      display: flex;",
    "      flex-direction: column;",
    "      gap: 16px;",
    "      min-height: 0;",
    "      padding: 24px 18px;",
    "      box-sizing: border-box;",
    "      border-right: 1px solid rgba(148, 163, 184, 0.28);",
    "      background: rgba(255, 255, 255, 0.62);",
    "      backdrop-filter: blur(18px);",
    "      overflow: hidden;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-sidebar-header {`,
    "      display: flex;",
    "      flex-direction: column;",
    "      gap: 6px;",
    "      padding: 0 4px;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-sidebar-eyebrow {`,
    "      font-size: 11px;",
    "      font-weight: 700;",
    "      letter-spacing: 0.16em;",
    "      text-transform: uppercase;",
    "      color: #64748b;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-sidebar-title {`,
    "      font-size: 20px;",
    "      font-weight: 800;",
    "      color: #0f172a;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-thumbnail-list {`,
    "      flex: 1;",
    "      min-height: 0;",
    "      overflow-y: auto;",
    "      padding-right: 4px;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-thumbnail {`,
    "      width: 100%;",
    "      display: flex;",
    "      flex-direction: column;",
    "      gap: 10px;",
    "      margin: 0 0 14px;",
    "      padding: 12px;",
    "      border: 1px solid rgba(148, 163, 184, 0.24);",
    "      border-radius: 18px;",
    "      background: rgba(255, 255, 255, 0.88);",
    "      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);",
    "      cursor: pointer;",
    "      transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;",
    "      text-align: left;",
    "      box-sizing: border-box;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-thumbnail[data-presenton-active-thumbnail="true"] {`,
    "      border-color: rgba(37, 99, 235, 0.42);",
    "      box-shadow: 0 16px 40px rgba(37, 99, 235, 0.16);",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-thumbnail-meta {`,
    "      display: flex;",
    "      flex-direction: column;",
    "      gap: 4px;",
    "      min-width: 0;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-thumbnail-index {`,
    "      font-size: 11px;",
    "      font-weight: 700;",
    "      letter-spacing: 0.08em;",
    "      text-transform: uppercase;",
    "      color: #64748b;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-thumbnail-label {`,
    "      font-size: 13px;",
    "      line-height: 1.35;",
    "      font-weight: 600;",
    "      color: #0f172a;",
    "      word-break: break-word;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-thumbnail-fit {`,
    "      position: relative;",
    `      width: ${THUMBNAIL_WIDTH}px;`,
    `      height: ${THUMBNAIL_HEIGHT}px;`,
    "      overflow: hidden;",
    "      border-radius: 12px;",
    "      background: #ffffff;",
    "      border: 1px solid rgba(148, 163, 184, 0.18);",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-thumbnail-canvas {`,
    "      position: absolute;",
    "      top: 0;",
    "      left: 0;",
    `      width: ${SLIDE_WIDTH}px;`,
    `      height: ${SLIDE_HEIGHT}px;`,
    `      transform: scale(${THUMBNAIL_SCALE});`,
    "      transform-origin: top left;",
    "      pointer-events: none;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-stage-panel {`,
    "      display: flex;",
    "      flex-direction: column;",
    "      min-width: 0;",
    "      height: 100vh;",
    "      min-height: 100vh;",
    "      overflow: hidden;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-stage-toolbar {`,
    "      display: flex;",
    "      align-items: center;",
    "      justify-content: space-between;",
    "      gap: 16px;",
    "      padding: 22px 28px 0;",
    "      box-sizing: border-box;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-stage-toolbar-copy {`,
    "      display: flex;",
    "      flex-direction: column;",
    "      gap: 6px;",
    "      min-width: 0;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-stage-label {`,
    "      font-size: 11px;",
    "      font-weight: 700;",
    "      letter-spacing: 0.16em;",
    "      text-transform: uppercase;",
    "      color: #64748b;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-stage-title {`,
    "      font-size: 22px;",
    "      font-weight: 800;",
    "      color: #0f172a;",
    "      white-space: nowrap;",
    "      overflow: hidden;",
    "      text-overflow: ellipsis;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-stage-counter {`,
    "      flex: none;",
    "      padding: 10px 14px;",
    "      border-radius: 999px;",
    "      background: rgba(255, 255, 255, 0.78);",
    "      border: 1px solid rgba(148, 163, 184, 0.24);",
    "      font-size: 13px;",
    "      font-weight: 700;",
    "      color: #334155;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-stage-viewport {`,
    "      flex: 1;",
    "      min-height: 0;",
    "      display: flex;",
    "      align-items: flex-start;",
    "      justify-content: center;",
    "      padding: 28px;",
    "      box-sizing: border-box;",
    "      overflow: auto;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-stage-fit {`,
    "      position: relative;",
    `      width: ${SLIDE_WIDTH}px;`,
    `      height: ${SLIDE_HEIGHT}px;`,
    "      flex: none;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} #${PRESENTATION_WRAPPER_ID} {`,
    "      position: absolute;",
    "      top: 0;",
    "      left: 0;",
    `      width: ${SLIDE_WIDTH}px;`,
    `      height: ${SLIDE_HEIGHT}px;`,
    "      transform: scale(var(--presenton-viewer-scale, 1));",
    "      transform-origin: top left;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} #${PRESENTATION_WRAPPER_ID} > [data-presenton-slide-shell="true"] {`,
    "      position: absolute;",
    "      inset: 0;",
    `      width: ${SLIDE_WIDTH}px;`,
    `      height: ${SLIDE_HEIGHT}px;`,
    "      overflow: hidden;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} [data-presenton-render-status="error"] {`,
    "      min-height: 100vh;",
    "    }",
  ];
}

function buildDeckViewerScript(): string {
  return `
    (() => {
      if (window.__PRESENTON_DISABLE_VIEWER_MODE__) {
        return;
      }
      const wrapper = document.getElementById(${JSON.stringify(PRESENTATION_WRAPPER_ID)});
      const html = document.documentElement;
      const shell = document.querySelector("[data-presenton-viewer-shell='true']");
      const thumbnailList = document.querySelector("[data-presenton-thumbnail-list='true']");
      const stageViewport = document.querySelector("[data-presenton-stage-viewport='true']");
      const stageFit = document.querySelector("[data-presenton-stage-fit='true']");
      const stageTitle = document.querySelector("[data-presenton-stage-title='true']");
      const stageCounter = document.querySelector("[data-presenton-stage-counter='true']");
      const slideWidth = ${SLIDE_WIDTH};
      const slideHeight = ${SLIDE_HEIGHT};
      const thumbnailScale = ${THUMBNAIL_SCALE};
      let activeIndex = 0;
      let initialized = false;
      let resizeObserver = null;

      const getSlideShells = () =>
        wrapper
          ? Array.from(wrapper.querySelectorAll(":scope > [data-presenton-slide-shell='true']"))
          : [];

      const updateScale = () => {
        if (!html.classList.contains(${JSON.stringify(DECK_VIEWER_MODE_CLASS)})) {
          return;
        }
        if (!stageViewport || !stageFit) {
          return;
        }
        const bounds = stageViewport.getBoundingClientRect();
        if (!bounds.width || !bounds.height) {
          return;
        }
        const scale = Math.max(0.1, Math.min(bounds.width / slideWidth, bounds.height / slideHeight));
        stageFit.style.width = Math.round(slideWidth * scale) + "px";
        stageFit.style.height = Math.round(slideHeight * scale) + "px";
        wrapper.style.setProperty("--presenton-viewer-scale", String(scale));
      };

      const updateActiveState = () => {
        const slideShells = getSlideShells();
        const nextActiveSlide = slideShells[activeIndex] ?? null;
        slideShells.forEach((slideShell, index) => {
          slideShell.setAttribute(
            "data-presenton-active-slide",
            index === activeIndex ? "true" : "false",
          );
          slideShell.style.display = index === activeIndex ? "block" : "none";
          slideShell.style.visibility = index === activeIndex ? "visible" : "hidden";
          slideShell.style.pointerEvents = index === activeIndex ? "auto" : "none";
        });

        if (thumbnailList) {
          const thumbnailButtons = Array.from(
            thumbnailList.querySelectorAll("[data-presenton-thumbnail-button='true']"),
          );
          thumbnailButtons.forEach((button, index) => {
            button.setAttribute(
              "data-presenton-active-thumbnail",
              index === activeIndex ? "true" : "false",
            );
          });
          const activeButton = thumbnailButtons[activeIndex];
          activeButton?.scrollIntoView({ block: "nearest" });
        }

        if (stageTitle) {
          stageTitle.textContent =
            nextActiveSlide?.getAttribute("data-speaker-note") ||
            "Slide " + String(activeIndex + 1);
        }

        if (stageCounter) {
          stageCounter.textContent = slideShells.length
            ? String(activeIndex + 1) + " / " + String(slideShells.length)
            : "";
        }
      };

      const buildThumbnails = () => {
        if (!thumbnailList) {
          return;
        }

        thumbnailList.replaceChildren();

        getSlideShells().forEach((slideShell, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "presenton-deck-thumbnail";
          button.setAttribute("data-presenton-thumbnail-button", "true");

          const meta = document.createElement("div");
          meta.className = "presenton-deck-thumbnail-meta";

          const indexNode = document.createElement("div");
          indexNode.className = "presenton-deck-thumbnail-index";
          indexNode.textContent = "Slide " + String(index + 1);

          const labelNode = document.createElement("div");
          labelNode.className = "presenton-deck-thumbnail-label";
          labelNode.textContent =
            slideShell.getAttribute("data-speaker-note") ||
            "Slide " + String(index + 1);

          meta.append(indexNode, labelNode);

          const fit = document.createElement("div");
          fit.className = "presenton-deck-thumbnail-fit";

          const canvas = document.createElement("div");
          canvas.className = "presenton-deck-thumbnail-canvas";
          canvas.style.width = slideWidth + "px";
          canvas.style.height = slideHeight + "px";
          canvas.style.transform = "scale(" + String(thumbnailScale) + ")";
          canvas.style.transformOrigin = "top left";

          const slideRoot = slideShell.firstElementChild;
          if (slideRoot) {
            canvas.appendChild(slideRoot.cloneNode(true));
          }

          fit.appendChild(canvas);
          button.append(meta, fit);

          button.addEventListener("click", () => {
            activeIndex = index;
            updateActiveState();
            updateScale();
          });

          thumbnailList.appendChild(button);
        });
      };

      const enableViewerMode = () => {
        html.classList.add(${JSON.stringify(DECK_VIEWER_MODE_CLASS)});

        if (stageTitle && shell) {
          stageTitle.textContent =
            shell.getAttribute("data-presenton-deck-title") || document.title || "Presenton Deck";
        }

        buildThumbnails();
        updateActiveState();
        updateScale();

        if (resizeObserver) {
          resizeObserver.disconnect();
        }

        if (window.ResizeObserver && stageViewport) {
          resizeObserver = new ResizeObserver(() => updateScale());
          resizeObserver.observe(stageViewport);
        }

        window.addEventListener("resize", updateScale, { passive: true });
      };

      const maybeInit = () => {
        if (initialized || !wrapper) {
          return;
        }

        const slideShells = getSlideShells();
        if (!slideShells.length) {
          return;
        }

        initialized = true;
        enableViewerMode();
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", maybeInit, { once: true });
      } else {
        queueMicrotask(maybeInit);
      }

      window.addEventListener("presenton:render-ready", maybeInit);
    })();
  `.trim();
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
}): string {
  const runtimeBundle = getBrowserRenderDeckRuntimeBundle();
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
    ...buildDeckSharedStyles(),
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
    "  <script>",
    "    window.tailwind = window.tailwind || {};",
    "  </script>",
    '  <script src="https://cdn.tailwindcss.com"></script>',
    "</head>",
    "<body>",
    ...buildDeckViewerShellStart(input.title),
    `          <div id="${PRESENTATION_WRAPPER_ID}" data-presenton-render-status="loading">`,
    contexts
      .map((context, index) =>
        [
          `    <div class="w-full presenton-deck-slide-shell" data-presenton-slide-shell="true" data-speaker-note="${escapeHtmlAttribute(input.parsedSlides[index]?.speakerNote ?? "")}">`,
          `      <div data-presenton-deck-slot="${index}" data-layout="${escapeHtmlAttribute(context.layoutId)}" data-group="${escapeHtmlAttribute(context.templateGroup)}" style="width:1280px;min-height:720px;"></div>`,
          "    </div>",
        ].join("\n"),
      )
      .join("\n"),
    "          </div>",
    ...buildDeckViewerShellEnd(),
    "  <script>",
    `    window.__PRESENTON_RENDER_CONTEXTS__ = ${serializedContexts};`,
    "  </script>",
    contexts.length > 0
      ? ["  <script>", runtimeBundle, "  </script>"].join("\n")
      : ["  <script>", buildDeckReadyScript(), "  </script>"].join("\n"),
    "  <script>",
    buildDeckViewerScript(),
    "  </script>",
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
  });
}

export function buildStandaloneDeckHtml(
  input: BuildStandaloneDeckHtmlInput,
): string {
  return buildDeckHtml({
    title: input.title,
    slides: input.slides,
  });
}
