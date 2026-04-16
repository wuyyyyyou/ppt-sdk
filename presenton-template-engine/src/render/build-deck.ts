import { getBrowserRenderDeckRuntimeBundle } from "./runtime-bundle.js";
import type {
  BrowserRenderContext,
  BuildDeckHtmlInput,
  BuildStandaloneDeckHtmlInput,
} from "./types.js";

const PRESENTATION_WRAPPER_ID = "presentation-slides-wrapper";
const CONTEXT_ASSIGNMENT_PREFIX = "window.__PRESENTON_RENDER_CONTEXT__ = ";
const DECK_VIEWER_MODE_CLASS = "presenton-viewer-mode";
const DECK_VIEWER_SHELL_CLASS = "presenton-deck-viewer-shell";
const SLIDE_WIDTH = 1280;
const SLIDE_HEIGHT = 720;

interface ParsedSlideInput {
  speakerNote: string;
  context: BrowserRenderContext | null;
  staticMarkup: string | null;
  headStyleAndLinkTags: string[];
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeJsonForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stripScriptTags(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

function collectHeadStyleAndLinkTags(html: string): string[] {
  const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch) {
    return [];
  }

  const headHtml = headMatch[1];
  const tags = [
    ...(headHtml.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) ?? []),
    ...(headHtml.match(/<link\b[^>]*>/gi) ?? []).filter((tag) =>
      /\brel\s*=\s*["']?stylesheet["']?/i.test(tag),
    ),
  ];

  return tags.map((tag) => tag.trim()).filter(Boolean);
}

function extractDocumentTitle(html: string): string | null {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : null;
}

function extractContextFromHtml(html: string): BrowserRenderContext | null {
  const assignmentStart = html.indexOf(CONTEXT_ASSIGNMENT_PREFIX);
  if (assignmentStart === -1) {
    return null;
  }

  const jsonStart = assignmentStart + CONTEXT_ASSIGNMENT_PREFIX.length;
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

function findElementRangeById(
  html: string,
  id: string,
): { start: number; openEnd: number; end: number; tagName: string } | null {
  const pattern = new RegExp(
    `<([a-zA-Z][\\w:-]*)\\b[^>]*\\bid\\s*=\\s*(['"])${id}\\2[^>]*>`,
    "i",
  );
  const match = pattern.exec(html);
  if (!match || match.index === undefined) {
    return null;
  }

  const tagName = match[1];
  const start = match.index;
  const openEnd = start + match[0].length;
  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
  tagPattern.lastIndex = openEnd;

  let depth = 1;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagPattern.exec(html)) !== null) {
    const token = tagMatch[0];
    if (token.startsWith(`</`) || token.startsWith(`</${tagName}`)) {
      depth -= 1;
      if (depth === 0) {
        return {
          start,
          openEnd,
          end: tagMatch.index,
          tagName,
        };
      }
    } else if (!token.endsWith("/>")) {
      depth += 1;
    }
  }

  return null;
}

function extractWrapperInnerHtml(html: string): string | null {
  const range = findElementRangeById(html, PRESENTATION_WRAPPER_ID);
  if (!range) {
    return null;
  }

  return html.slice(range.openEnd, range.end).trim() || null;
}

function extractBodyInnerHtml(html: string): string | null {
  const match = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (!match) {
    return null;
  }

  return match[1].trim() || null;
}

function extractSpeakerNoteFromMarkup(markup: string): string | null {
  const match = markup.match(/\bdata-speaker-note\s*=\s*["']([^"']*)["']/i);
  return match ? match[1] : null;
}

function extractStaticMarkup(html: string): string | null {
  const wrapperInner = extractWrapperInnerHtml(html);
  if (wrapperInner) {
    const sanitized = stripScriptTags(wrapperInner).trim();
    return sanitized || null;
  }

  const bodyInner = extractBodyInnerHtml(html);
  if (!bodyInner) {
    return null;
  }

  const sanitized = stripScriptTags(bodyInner)
    .replace(
      new RegExp(
        `<div\\b[^>]*\\bid\\s*=\\s*(['"])${PRESENTATION_WRAPPER_ID}\\1[^>]*>[\\s\\S]*?<\\/div>`,
        "gi",
      ),
      "",
    )
    .trim();

  return sanitized || null;
}

function parseSlideInput(
  slide: BuildDeckHtmlInput["slides"][number],
): ParsedSlideInput {
  const context = extractContextFromHtml(slide.html);
  const staticMarkup = context ? null : extractStaticMarkup(slide.html);
  const inferredSpeakerNote =
    slide.speaker_note ??
    context?.speakerNote ??
    (staticMarkup ? extractSpeakerNoteFromMarkup(staticMarkup) : null) ??
    "";

  return {
    speakerNote: inferredSpeakerNote,
    context,
    staticMarkup,
    headStyleAndLinkTags: context ? [] : collectHeadStyleAndLinkTags(slide.html),
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
    "      overflow-x: hidden;",
    "      overflow-y: auto;",
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
    "    .presenton-deck-sidebar,",
    "    .presenton-deck-stage-toolbar {",
    "      display: none;",
    "    }",
    "    .presenton-deck-stage-panel,",
    "    .presenton-deck-stage-viewport,",
    "    .presenton-deck-stage-fit {",
    `      width: ${SLIDE_WIDTH}px;`,
    `      min-height: ${SLIDE_HEIGHT}px;`,
    "    }",
    `    #${PRESENTATION_WRAPPER_ID} {`,
    `      width: ${SLIDE_WIDTH}px;`,
    `      min-height: ${SLIDE_HEIGHT}px;`,
    "    }",
    "    .presenton-deck-slide-shell {",
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
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-thumbnail:hover {`,
    "      transform: translateY(-1px);",
    "      box-shadow: 0 14px 36px rgba(15, 23, 42, 0.12);",
    "      border-color: rgba(59, 130, 246, 0.35);",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-thumbnail[data-presenton-active-thumbnail="true"] {`,
    "      border-color: rgba(37, 99, 235, 0.42);",
    "      box-shadow: 0 16px 40px rgba(37, 99, 235, 0.16);",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-thumbnail-meta {`,
    "      display: flex;",
    "      align-items: center;",
    "      justify-content: space-between;",
    "      gap: 12px;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-thumbnail-index {`,
    "      font-size: 12px;",
    "      font-weight: 800;",
    "      letter-spacing: 0.14em;",
    "      text-transform: uppercase;",
    "      color: #2563eb;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-thumbnail-label {`,
    "      font-size: 12px;",
    "      color: #475569;",
    "      white-space: nowrap;",
    "      overflow: hidden;",
    "      text-overflow: ellipsis;",
    "      max-width: 140px;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-thumbnail-fit {`,
    "      width: 208px;",
    "      height: 117px;",
    "      overflow: hidden;",
    "      border-radius: 12px;",
    "      background: #dfe7f2;",
    "      box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.2);",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-thumbnail-canvas {`,
    `      width: ${SLIDE_WIDTH}px;`,
    `      height: ${SLIDE_HEIGHT}px;`,
    `      transform: scale(${208 / SLIDE_WIDTH});`,
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
    `      min-height: ${SLIDE_HEIGHT}px;`,
    "      transform: scale(var(--presenton-viewer-scale, 1));",
    "      transform-origin: top left;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-slide-shell {`,
    "      position: absolute;",
    "      inset: 0;",
    "      opacity: 0;",
    "      visibility: hidden;",
    "      pointer-events: none;",
    "      overflow: hidden;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-slide-shell[data-presenton-active-slide="true"] {`,
    "      opacity: 1;",
    "      visibility: visible;",
    "      pointer-events: auto;",
    "    }",
    `    html.${DECK_VIEWER_MODE_CLASS} [data-presenton-render-status="error"] {`,
    "      min-height: 100vh;",
    "    }",
    "    @media (max-width: 1080px) {",
    `      html.${DECK_VIEWER_MODE_CLASS} .${DECK_VIEWER_SHELL_CLASS} {`,
    "        grid-template-columns: 1fr;",
    "      }",
    `      html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-sidebar {`,
    "        display: none;",
    "      }",
    `      html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-stage-toolbar {`,
    "        padding-top: 18px;",
    "      }",
    `      html.${DECK_VIEWER_MODE_CLASS} .presenton-deck-stage-viewport {`,
    "        padding: 18px;",
    "      }",
    "    }",
    "    @media (prefers-reduced-motion: reduce) {",
    "      .presenton-deck-thumbnail {",
    "        transition: none;",
    "      }",
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
  ];
}

function buildDeckViewerScript(): string {
  return `
    (() => {
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
      let activeIndex = 0;
      let initialized = false;
      let resizeObserver = null;

      const getSlideShells = () =>
        wrapper
          ? Array.from(wrapper.querySelectorAll(":scope > [data-presenton-slide-shell='true']"))
          : [];

      const getSlideRoot = (slideShell) => {
        if (!slideShell) {
          return null;
        }
        return slideShell.firstElementChild;
      };

      const updateScale = () => {
        if (!html.classList.contains(${JSON.stringify(DECK_VIEWER_MODE_CLASS)})) {
          return;
        }
        if (!stageViewport || !stageFit || !wrapper) {
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
        slideShells.forEach((slideShell, index) => {
          slideShell.setAttribute(
            "data-presenton-active-slide",
            index === activeIndex ? "true" : "false",
          );
        });

        if (thumbnailList) {
          Array.from(
            thumbnailList.querySelectorAll("[data-presenton-thumbnail-button='true']"),
          ).forEach((button, index) => {
            button.setAttribute(
              "data-presenton-active-thumbnail",
              index === activeIndex ? "true" : "false",
            );
          });
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

          const slideRoot = getSlideRoot(slideShell);
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

      const shouldUseViewerMode = () => !window.navigator.webdriver;

      const maybeInit = () => {
        if (initialized || !wrapper) {
          return;
        }

        const slideShells = getSlideShells();
        if (!slideShells.length) {
          return;
        }

        const hasDeckSlots = slideShells.some((slideShell) =>
          Boolean(slideShell.querySelector("[data-presenton-deck-slot]")),
        );
        const status = wrapper.getAttribute("data-presenton-render-status");

        if (hasDeckSlots && status !== "ready") {
          return;
        }

        initialized = true;

        if (shouldUseViewerMode()) {
          enableViewerMode();
        }
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", maybeInit, { once: true });
      } else {
        queueMicrotask(maybeInit);
      }

      window.addEventListener("presenton:render-ready", maybeInit);

      if (wrapper && window.MutationObserver) {
        const observer = new MutationObserver(() => {
          if (!initialized) {
            maybeInit();
          }
        });
        observer.observe(wrapper, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["data-presenton-render-status"],
        });
      }
    })();
  `.trim();
}

function buildDeckStaticReadyScript(): string {
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
  headTags: string[];
}): string {
  const runtimeBundle = getBrowserRenderDeckRuntimeBundle();
  const contexts = input.parsedSlides
    .map((slide) => slide.context)
    .filter((context): context is BrowserRenderContext => context !== null);
  const serializedContexts = escapeJsonForInlineScript(contexts);

  const slideMarkup = input.parsedSlides
    .map((slide, index) => {
      if (slide.context) {
        return [
          `    <div class="w-full presenton-deck-slide-shell" data-presenton-slide-shell="true" data-speaker-note="${escapeHtmlAttribute(slide.speakerNote)}">`,
          `      <div data-presenton-deck-slot="${index}" data-layout="${escapeHtmlAttribute(slide.context.layoutId)}" data-group="${escapeHtmlAttribute(slide.context.templateGroup)}" style="width:1280px;min-height:720px;"></div>`,
          "    </div>",
        ].join("\n");
      }

      return [
        `    <div class="w-full presenton-deck-slide-shell" data-presenton-slide-shell="true" data-speaker-note="${escapeHtmlAttribute(slide.speakerNote)}">`,
        '      <div data-presenton-static-slide="true" style="width:1280px;min-height:720px;">',
        slide.staticMarkup ?? "",
        "      </div>",
        "    </div>",
      ].join("\n");
    })
    .join("\n");

  const optionalHeadTags = input.headTags.length > 0 ? `\n${input.headTags.join("\n")}` : "";

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=1280, initial-scale=1" />',
    `  <title>${escapeHtml(input.title)}</title>`,
    "  <style>",
    ...buildDeckSharedStyles(),
    "  </style>",
    optionalHeadTags,
    "  <script>",
    "    window.tailwind = window.tailwind || {};",
    "  </script>",
    '  <script src="https://cdn.tailwindcss.com"></script>',
    "</head>",
    "<body>",
    ...buildDeckViewerShellStart(input.title),
    `          <div id="${PRESENTATION_WRAPPER_ID}" data-presenton-render-status="loading">`,
    slideMarkup,
    "          </div>",
    ...buildDeckViewerShellEnd(),
    "  <script>",
    `    window.__PRESENTON_RENDER_CONTEXTS__ = ${serializedContexts};`,
    "  </script>",
    contexts.length > 0
      ? ["  <script>", runtimeBundle, "  </script>"].join("\n")
      : ["  <script>", buildDeckStaticReadyScript(), "  </script>"].join("\n"),
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
    if (!parsed.context && !parsed.staticMarkup) {
      throw new Error(
        `Slide at index ${index} does not contain a render context or usable slide markup`,
      );
    }
    return parsed;
  });

  const title =
    input.title ??
    extractDocumentTitle(input.slides[0].html) ??
    "Presenton Deck";
  const headTags = Array.from(
    new Set(parsedSlides.flatMap((slide) => slide.headStyleAndLinkTags)),
  );

  return buildDeckDocumentHtml({
    title,
    parsedSlides,
    headTags,
  });
}

function extractHeadHtml(html: string): string {
  const match = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  return match ? match[1] : "";
}

function extractBodyHtml(html: string): string {
  const match = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : html;
}

function extractExternalScriptTags(html: string): string[] {
  return Array.from(
    html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["'][^"']+["'][^>]*>\s*<\/script>/gi),
  ).map((match) => match[0].trim());
}

function extractHeadStyles(html: string): string[] {
  const headHtml = extractHeadHtml(html);
  return Array.from(headHtml.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)).map(
    (match) => match[1].trim(),
  );
}

function extractBodyMarkupAndScripts(bodyHtml: string): {
  markup: string;
  scripts: string[];
} {
  const scripts: string[] = [];

  const markup = bodyHtml.replace(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
    (_, attributes = "", content = "") => {
      if (/\bsrc\s*=/i.test(attributes)) {
        return "";
      }

      const source = content.trim();
      if (source) {
        scripts.push(source);
      }
      return "";
    },
  );

  return {
    markup: markup.trim(),
    scripts,
  };
}

function splitCssSelectors(selectorList: string): string[] {
  const selectors: string[] = [];
  let current = "";
  let parenDepth = 0;
  let bracketDepth = 0;

  for (const char of selectorList) {
    if (char === "(") {
      parenDepth += 1;
    } else if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
    } else if (char === "[") {
      bracketDepth += 1;
    } else if (char === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
    } else if (char === "," && parenDepth === 0 && bracketDepth === 0) {
      selectors.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (current) {
    selectors.push(current);
  }

  return selectors;
}

function prefixCssSelector(selector: string, scopeSelector: string): string {
  const trimmed = selector.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (
    trimmed === "from" ||
    trimmed === "to" ||
    /^[\d.\s%-]+$/.test(trimmed)
  ) {
    return trimmed;
  }

  const replacedRoots = trimmed
    .replace(/\bhtml\b/g, scopeSelector)
    .replace(/\bbody\b/g, scopeSelector)
    .replace(/:root/g, scopeSelector);

  if (replacedRoots === scopeSelector || replacedRoots.includes(scopeSelector)) {
    return replacedRoots;
  }

  return `${scopeSelector} ${replacedRoots}`;
}

function prefixCssSelectors(selectorList: string, scopeSelector: string): string {
  return splitCssSelectors(selectorList)
    .map((selector) => prefixCssSelector(selector, scopeSelector))
    .join(", ");
}

function findMatchingCssBrace(input: string, startIndex: number): number {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = startIndex; index < input.length; index += 1) {
    const char = input[index];
    const previous = input[index - 1];

    if (inSingleQuote) {
      if (char === "'" && previous !== "\\") {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      if (char === '"' && previous !== "\\") {
        inDoubleQuote = false;
      }
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function scopeCss(css: string, scopeSelector: string): string {
  let result = "";
  let cursor = 0;

  while (cursor < css.length) {
    const openBraceIndex = css.indexOf("{", cursor);
    if (openBraceIndex === -1) {
      result += css.slice(cursor);
      break;
    }

    const prelude = css.slice(cursor, openBraceIndex);
    const closeBraceIndex = findMatchingCssBrace(css, openBraceIndex);

    if (closeBraceIndex === -1) {
      result += css.slice(cursor);
      break;
    }

    const blockContent = css.slice(openBraceIndex + 1, closeBraceIndex);
    const trimmedPrelude = prelude.trim();

    if (trimmedPrelude.startsWith("@")) {
      if (/^@(media|supports|container|layer|document)\b/i.test(trimmedPrelude)) {
        result += `${trimmedPrelude} {${scopeCss(blockContent, scopeSelector)}}`;
      } else {
        result += `${trimmedPrelude} {${blockContent}}`;
      }
    } else {
      result += `${prefixCssSelectors(trimmedPrelude, scopeSelector)} {${blockContent}}`;
    }

    cursor = closeBraceIndex + 1;
  }

  return result;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function remapIds(
  markup: string,
  styles: string[],
  scripts: string[],
  slidePrefix: string,
): {
  markup: string;
  styles: string[];
  scripts: string[];
} {
  const ids = Array.from(
    new Set(
      Array.from(markup.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)).map(
        (match) => match[1],
      ),
    ),
  );

  let nextMarkup = markup;
  let nextStyles = styles;
  let nextScripts = scripts;

  for (const originalId of ids) {
    const nextId = `${slidePrefix}-${originalId}`;
    const idValuePattern = new RegExp(
      `(\\bid\\s*=\\s*["'])${escapeRegExp(originalId)}(["'])`,
      "g",
    );
    const hashReferencePattern = new RegExp(
      `#${escapeRegExp(originalId)}(?![\\w-])`,
      "g",
    );
    const getElementByIdPattern = new RegExp(
      `(getElementById\\(\\s*["'])${escapeRegExp(originalId)}(["']\\s*\\))`,
      "g",
    );
    const querySelectorPattern = new RegExp(
      `((?:querySelector|querySelectorAll)\\(\\s*["']#)${escapeRegExp(originalId)}(["']\\s*\\))`,
      "g",
    );

    nextMarkup = nextMarkup
      .replace(idValuePattern, `$1${nextId}$2`)
      .replace(hashReferencePattern, `#${nextId}`);

    nextStyles = nextStyles.map((style) =>
      style.replace(hashReferencePattern, `#${nextId}`),
    );

    nextScripts = nextScripts.map((script) =>
      script
        .replace(getElementByIdPattern, `$1${nextId}$2`)
        .replace(querySelectorPattern, `$1${nextId}$2`)
        .replace(hashReferencePattern, `#${nextId}`),
    );
  }

  return {
    markup: nextMarkup,
    styles: nextStyles,
    scripts: nextScripts,
  };
}

function buildStandaloneDeckReadyScript(): string {
  return `
    (async () => {
      const wrapper = document.getElementById(${JSON.stringify(PRESENTATION_WRAPPER_ID)});

      const waitForLoad = () => new Promise((resolve) => {
        if (document.readyState === "complete") {
          resolve(undefined);
          return;
        }
        window.addEventListener("load", () => resolve(undefined), { once: true });
      });

      try {
        await waitForLoad();

        if (document.fonts?.ready) {
          await document.fonts.ready.catch(() => {});
        }

        await new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)));
        });
        await new Promise((resolve) => setTimeout(resolve, 500));

        wrapper?.setAttribute("data-presenton-render-status", "ready");
        window.dispatchEvent(new CustomEvent("presenton:render-ready"));
      } catch (error) {
        wrapper?.setAttribute("data-presenton-render-status", "error");
        wrapper?.setAttribute(
          "data-presenton-render-message",
          error instanceof Error ? error.message : String(error),
        );
      }
    })();
  `.trim();
}

export function buildStandaloneDeckHtml(
  input: BuildStandaloneDeckHtmlInput,
): string {
  if (!input || typeof input !== "object") {
    throw new Error("Standalone deck input must be an object");
  }

  if (!Array.isArray(input.slides) || input.slides.length === 0) {
    throw new Error('Field "slides" must be a non-empty array');
  }

  const stylesheetLinks = new Set<string>();
  const externalScripts = new Set<string>();
  const scopedStyles: string[] = [];
  const renderedSlides: string[] = [];

  input.slides.forEach((slide, index) => {
    if (!slide || typeof slide !== "object" || typeof slide.html !== "string") {
      throw new Error(`Slide at index ${index} must contain an "html" string`);
    }

    const headHtml = extractHeadHtml(slide.html);
    const bodyHtml = extractBodyHtml(slide.html);
    const { markup: rawMarkup, scripts: rawScripts } =
      extractBodyMarkupAndScripts(bodyHtml);

    if (!rawMarkup) {
      throw new Error(`Slide at index ${index} does not contain usable body markup`);
    }

    collectHeadStyleAndLinkTags(slide.html)
      .filter((tag) => /<link\b/i.test(tag))
      .forEach((tag) => stylesheetLinks.add(tag));

    extractExternalScriptTags(slide.html).forEach((tag) => externalScripts.add(tag));

    const rawStyles = extractHeadStyles(slide.html);
    const scopeClass = `presenton-standalone-slide-scope-${index + 1}`;
    const scopeSelector = `.${scopeClass}`;
    const slidePrefix = `presenton-standalone-slide-${index + 1}`;
    const remapped = remapIds(rawMarkup, rawStyles, rawScripts, slidePrefix);
    const scopedSlideStyles = remapped.styles
      .map((style) => scopeCss(style, scopeSelector).trim())
      .filter(Boolean)
      .join("\n");

    if (scopedSlideStyles) {
      scopedStyles.push(
        `<style data-standalone-slide-scope="${slidePrefix}">\n${scopedSlideStyles}\n</style>`,
      );
    }

    const inlineScripts = remapped.scripts
      .map(
        (script, scriptIndex) => `        <script data-standalone-slide-script="${slidePrefix}-${scriptIndex + 1}">
          (() => {
${script
  .split("\n")
  .map((line) => `            ${line}`)
  .join("\n")}
          })();
        </script>`,
      )
      .join("\n");

    const speakerNote =
      slide.speaker_note ??
      extractDocumentTitle(slide.html) ??
      `Slide ${index + 1}`;

    renderedSlides.push(
      [
        `    <div class="w-full presenton-standalone-slide-shell presenton-deck-slide-shell" data-presenton-slide-shell="true" data-speaker-note="${escapeHtmlAttribute(speakerNote)}">`,
        '      <div data-presenton-static-slide="true" style="width:1280px;min-height:720px;">',
        `        <div class="presenton-standalone-slide-scope ${scopeClass}" data-presenton-standalone-slide="${index + 1}">`,
        remapped.markup,
        "        </div>",
        inlineScripts,
        "      </div>",
        "    </div>",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  });

  const title =
    input.title ??
    extractDocumentTitle(input.slides[0].html) ??
    "Presenton Standalone Deck";

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=1280, initial-scale=1" />',
    `  <title>${escapeHtml(title)}</title>`,
    "  <style>",
    ...buildDeckSharedStyles(),
    "    .presenton-standalone-slide-shell {",
    "      width: 1280px;",
    "      min-height: 720px;",
    "    }",
    "    .presenton-standalone-slide-scope {",
    "      width: 1280px;",
    "      min-height: 720px;",
    "      position: relative;",
    "      isolation: isolate;",
    "    }",
    "  </style>",
    ...Array.from(stylesheetLinks),
    ...Array.from(externalScripts),
    ...scopedStyles,
    "</head>",
    "<body>",
    ...buildDeckViewerShellStart(title),
    `          <div id="${PRESENTATION_WRAPPER_ID}" data-presenton-render-status="loading">`,
    ...renderedSlides,
    "          </div>",
    ...buildDeckViewerShellEnd(),
    "  <script>",
    buildStandaloneDeckReadyScript(),
    "  </script>",
    "  <script>",
    buildDeckViewerScript(),
    "  </script>",
    "</body>",
    "</html>",
  ].join("\n");
}
