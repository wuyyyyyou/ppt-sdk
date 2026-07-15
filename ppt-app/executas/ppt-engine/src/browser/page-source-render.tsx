import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import type { BrowserRenderContext } from "../render/types.js";

export type PageSourceComponent = React.ComponentType;
export type PageSourceResolver = (pageId: string) => PageSourceComponent | undefined;

declare global {
  interface Window {
    __PRESENTON_RENDER_CONTEXT__?: BrowserRenderContext;
    __PRESENTON_RENDER_CONTEXTS__?: BrowserRenderContext[];
    __PRESENTON_REMOTE_SVG_PENDING__?: number;
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
    const imagesReady = Array.from(container.querySelectorAll("img"))
      .every((image) => image.complete);
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

function renderPageSource(
  container: HTMLElement,
  context: BrowserRenderContext,
  resolvePageSource: PageSourceResolver,
) {
  const PageSource = resolvePageSource(context.layoutId);
  const root = createRoot(container);
  flushSync(() => {
    root.render(
      <div
        data-layout={context.layoutId}
        data-page-id={context.layoutId}
        style={{ width: "1280px", minHeight: "720px" }}
      >
        {PageSource
          ? <PageSource />
          : <ErrorFallback message={`Page Source "${context.layoutId}" was not bundled`} />}
      </div>,
    );
  });
}

export function renderPageSourceSlideWithErrorBoundary(
  resolvePageSource: PageSourceResolver,
) {
  const container = document.getElementById("presentation-slides-wrapper");
  try {
    if (!container) {
      throw new Error('Missing mount node "#presentation-slides-wrapper"');
    }
    const context = window.__PRESENTON_RENDER_CONTEXT__;
    if (!context) {
      throw new Error("Missing browser render context");
    }
    markStatus(container, "loading");
    document.title = context.title;
    renderPageSource(container, context, resolvePageSource);
    waitForReady(container);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown browser render error";
    if (container) {
      markStatus(container, "error", message);
      const root = createRoot(container);
      flushSync(() => root.render(<ErrorFallback message={message} />));
    }
  }
}

export function renderPageSourceDeckWithErrorBoundary(
  resolvePageSource: PageSourceResolver,
) {
  const container = document.getElementById("presentation-slides-wrapper");
  try {
    if (!container) {
      throw new Error('Missing mount node "#presentation-slides-wrapper"');
    }
    markStatus(container, "loading");
    const contexts = window.__PRESENTON_RENDER_CONTEXTS__ ?? [];
    contexts.forEach((context, index) => {
      const slot = container.querySelector<HTMLElement>(
        `[data-presenton-deck-slot="${index}"]`,
      );
      if (!slot) {
        throw new Error(`Missing deck slot for slide ${index}`);
      }
      renderPageSource(slot, context, resolvePageSource);
    });
    waitForReady(container);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown browser render error";
    if (container) {
      markStatus(container, "error", message);
      const root = createRoot(container);
      flushSync(() => root.render(<ErrorFallback message={message} />));
    }
  }
}
