import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import { getLayoutByLayoutId } from "../app/presentation-templates/index.js";
import type { BrowserRenderContext } from "../render/types.js";
import type { TemplateWithData } from "../app/presentation-templates/utils.js";

declare global {
  interface Window {
    __PRESENTON_RENDER_CONTEXT__?: BrowserRenderContext;
    __PRESENTON_REMOTE_SVG_PENDING__?: number;
    __PRESENTON_DISABLE_AUTO_RENDER__?: boolean;
    __PRESENTON_LOCAL_LAYOUTS__?: BrowserLocalLayoutRegistry;
  }
}

export type BrowserLayoutResolver = (layoutId: string) => TemplateWithData | undefined;
export type BrowserLocalLayoutRegistry = Record<string, TemplateWithData>;

const GRAPH_COLOR_KEYS = Array.from({ length: 10 }, (_, index) => index);

function readContext(): BrowserRenderContext {
  const context = window.__PRESENTON_RENDER_CONTEXT__;
  if (!context) {
    throw new Error("Missing browser render context");
  }
  return context;
}

function ensureFont(theme: BrowserRenderContext["theme"]) {
  if (!theme.fontName || !theme.fontUrl) {
    return;
  }

  const existing = document.querySelector(
    `[data-presenton-font-url="${theme.fontUrl}"]`,
  );
  if (existing) {
    return;
  }

  const isCssUrl =
    /\.css(\?|$)/i.test(theme.fontUrl) ||
    theme.fontUrl.includes("fonts.googleapis.com");

  if (isCssUrl) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = theme.fontUrl;
    link.setAttribute("data-presenton-font-url", theme.fontUrl);
    document.head.appendChild(link);
    return;
  }

  const style = document.createElement("style");
  style.setAttribute("data-presenton-font-url", theme.fontUrl);
  style.textContent = `@font-face {
    font-family: '${theme.fontName}';
    src: url('${theme.fontUrl}');
    font-style: normal;
    font-display: swap;
  }`;
  document.head.appendChild(style);
}

function applyThemeVariables(
  container: HTMLElement,
  theme: BrowserRenderContext["theme"],
) {
  const colors = theme.colors ?? {};
  const colorEntries: Array<[string, string | undefined]> = [
    ["--primary-color", colors.primary],
    ["--background-color", colors.background],
    ["--card-color", colors.card],
    ["--stroke", colors.stroke],
    ["--primary-text", colors.primary_text],
    ["--background-text", colors.background_text],
  ];

  GRAPH_COLOR_KEYS.forEach((index) => {
    colorEntries.push([
      `--graph-${index}`,
      colors[`graph_${index}`] ?? colors[`graph-${index}`],
    ]);
  });

  for (const [key, value] of colorEntries) {
    if (value) {
      container.style.setProperty(key, value);
    }
  }

  if (theme.fontName) {
    container.style.setProperty("font-family", `"${theme.fontName}"`);
    container.style.setProperty("--heading-font-family", `"${theme.fontName}"`);
    container.style.setProperty("--body-font-family", `"${theme.fontName}"`);
  }
}

function markStatus(
  container: HTMLElement,
  status: "loading" | "ready" | "error",
  message?: string,
) {
  container.setAttribute("data-presenton-render-status", status);
  if (message) {
    container.setAttribute("data-presenton-render-message", message);
  } else {
    container.removeAttribute("data-presenton-render-message");
  }
}

function waitForReady(container: HTMLElement) {
  let attempts = 0;

  const tick = () => {
    const pendingRemoteSvg = window.__PRESENTON_REMOTE_SVG_PENDING__ ?? 0;
    const images = Array.from(container.querySelectorAll("img"));
    const imagesReady = images.every((image) => image.complete);

    if (pendingRemoteSvg === 0 && imagesReady) {
      markStatus(container, "ready");
      window.dispatchEvent(new CustomEvent("presenton:render-ready"));
      return;
    }

    attempts += 1;
    if (attempts > 120) {
      markStatus(container, "ready");
      window.dispatchEvent(new CustomEvent("presenton:render-ready"));
      return;
    }

    window.setTimeout(tick, 50);
  };

  window.setTimeout(tick, 50);
}

function ErrorFallback({ message }: { message: string }) {
  return (
    <div
      style={{
        width: "1280px",
        minHeight: "720px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        padding: "24px",
        background: "#fef2f2",
        color: "#991b1b",
        fontSize: "14px",
      }}
    >
      {message}
    </div>
  );
}

function resolveBrowserLayout(
  layoutId: string,
  localResolver?: BrowserLayoutResolver,
): TemplateWithData | undefined {
  return localResolver?.(layoutId) ?? window.__PRESENTON_LOCAL_LAYOUTS__?.[layoutId] ?? getLayoutByLayoutId(layoutId);
}

function SlideDocument({
  context,
  localResolver,
}: {
  context: BrowserRenderContext;
  localResolver?: BrowserLayoutResolver;
}) {
  const layout = resolveBrowserLayout(context.layoutId, localResolver);

  if (!layout) {
    return (
      <ErrorFallback
        message={`Layout "${context.layoutId}" not found in template group "${context.templateGroup}"`}
      />
    );
  }

  const LayoutComponent = layout.component as React.ComponentType<{ data: Record<string, unknown> }>;
  const slideData = {
    ...context.slideData,
    _logo_url__: context.theme.logoUrl ?? null,
    __companyName__: context.theme.companyName ?? null,
  };

  return (
    <div className="w-full" data-speaker-note={context.speakerNote}>
      <div data-layout={context.layoutId} data-group={context.templateGroup} className="w-full">
        <LayoutComponent data={slideData} />
      </div>
    </div>
  );
}

export function renderPresentonSlide(localResolver?: BrowserLayoutResolver) {
  const container = document.getElementById("presentation-slides-wrapper");
  if (!container) {
    throw new Error('Missing mount node "#presentation-slides-wrapper"');
  }

  markStatus(container, "loading");

  const context = readContext();
  document.title = context.title;
  ensureFont(context.theme);
  applyThemeVariables(container, context.theme);

  const root = createRoot(container);
  flushSync(() => {
    root.render(<SlideDocument context={context} localResolver={localResolver} />);
  });
  waitForReady(container);
}

export function renderPresentonSlideWithErrorBoundary(localResolver?: BrowserLayoutResolver) {
  try {
    renderPresentonSlide(localResolver);
  } catch (error) {
    const container = document.getElementById("presentation-slides-wrapper");
    const message =
      error instanceof Error ? error.message : "Unknown browser render error";

    if (container) {
      markStatus(container, "error", message);
      const root = createRoot(container);
      flushSync(() => {
        root.render(<ErrorFallback message={message} />);
      });
    } else {
      console.error(message);
    }
  }
}
