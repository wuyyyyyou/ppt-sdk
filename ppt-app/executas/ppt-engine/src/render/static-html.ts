export type StaticHtmlDocumentKind = "deck" | "page";

export interface StaticHtmlPageLike {
  evaluate: <T>(pageFunction: (...args: any[]) => T, ...args: any[]) => Promise<T>;
  evaluateOnNewDocument?: (
    pageFunction: string | ((...args: any[]) => unknown),
    ...args: any[]
  ) => Promise<unknown>;
}

export interface WaitForRenderReadinessInput {
  timeoutMs: number;
  quietWindowMs?: number;
  requireTailwind?: boolean;
  allowFailedImages?: boolean;
}

type RenderReadinessState = {
  failedImages: string[];
  fontsReady: boolean;
  pendingImages: string[];
  pendingRequests: string[];
  pendingStylesheets: string[];
  quietForMs: number;
  tailwindReady: boolean;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeReadinessBlockers(state: RenderReadinessState | null): string {
  if (!state) return "render readiness state was unavailable";
  const blockers: string[] = [];
  if (!state.tailwindReady) blockers.push("Tailwind CSS was not generated");
  if (!state.fontsReady) blockers.push("fonts were still loading");
  if (state.pendingImages.length > 0) {
    blockers.push(`images were still loading: ${state.pendingImages.join(", ")}`);
  }
  if (state.pendingRequests.length > 0) {
    blockers.push(`requests were still pending: ${state.pendingRequests.join(", ")}`);
  }
  if (state.failedImages.length > 0) {
    blockers.push(`images failed to load: ${state.failedImages.join(", ")}`);
  }
  if (state.pendingStylesheets.length > 0) {
    blockers.push(`stylesheets were still loading: ${state.pendingStylesheets.join(", ")}`);
  }
  if (state.quietForMs <= 0) blockers.push("DOM was still changing");
  return blockers.join("; ") || "the document did not settle";
}

const RENDER_READINESS_TRACKING_SCRIPT = String.raw`
(() => {
  const state = window.__PRESENTON_RENDER_REQUESTS__ = new Map();
  let nextRequestId = 1;
  const begin = (label) => {
    const id = nextRequestId++;
    state.set(id, String(label || "<unknown request>"));
    return id;
  };
  const finish = (id) => state.delete(id);

  const originalFetch = window.fetch.bind(window);
  window.fetch = (...args) => {
    const request = args[0];
    const label = typeof request === "string" ? request : request?.url;
    const id = begin(label || "fetch");
    return originalFetch(...args).finally(() => finish(id));
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__presentonRenderUrl = url;
    return originalOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function(...args) {
    const id = begin(this.__presentonRenderUrl || "XMLHttpRequest");
    this.addEventListener("loadend", () => finish(id), { once: true });
    try {
      return originalSend.apply(this, args);
    } catch (error) {
      finish(id);
      throw error;
    }
  };
})();
`;

export async function installRenderReadinessTracking(
  page: StaticHtmlPageLike,
): Promise<void> {
  await page.evaluateOnNewDocument?.(RENDER_READINESS_TRACKING_SCRIPT);
}

export async function waitForRenderReadiness(
  page: StaticHtmlPageLike,
  input: WaitForRenderReadinessInput,
): Promise<void> {
  const quietWindowMs = input.quietWindowMs ?? 100;
  const requireTailwind = input.requireTailwind ?? true;
  const allowFailedImages = input.allowFailedImages ?? false;
  const startedAt = Date.now();
  await page.evaluate(() => {
    const renderWindow = window as typeof window & {
      __PRESENTON_LAST_RENDER_MUTATION_AT__?: number;
      __PRESENTON_RENDER_MUTATION_OBSERVER__?: MutationObserver;
    };
    renderWindow.__PRESENTON_RENDER_MUTATION_OBSERVER__?.disconnect();
    renderWindow.__PRESENTON_LAST_RENDER_MUTATION_AT__ = performance.now();
    const observer = new MutationObserver(() => {
      renderWindow.__PRESENTON_LAST_RENDER_MUTATION_AT__ = performance.now();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
    renderWindow.__PRESENTON_RENDER_MUTATION_OBSERVER__ = observer;
  });

  let lastState: RenderReadinessState | null = null;
  while (Date.now() - startedAt <= input.timeoutMs) {
    lastState = await page.evaluate((requiredQuietWindowMs, shouldRequireTailwind) => {
      const renderWindow = window as typeof window & {
        __PRESENTON_LAST_RENDER_MUTATION_AT__?: number;
        __PRESENTON_RENDER_REQUESTS__?: Map<number, string>;
      };
      const images = Array.from(document.images);
      const pendingImages = images
        .filter((image) => !image.complete)
        .map((image) => image.currentSrc || image.src || "<unknown image>");
      const failedImages = images
        .filter((image) => image.complete && image.naturalWidth === 0)
        .map((image) => image.currentSrc || image.src || "<unknown image>");
      const pendingStylesheets = Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
      )
        .filter((link) => !link.sheet)
        .map((link) => link.href || "<unknown stylesheet>");
      const tailwindReady = !shouldRequireTailwind || Array.from(document.querySelectorAll("style"))
        .some((style) => style.textContent?.includes("tailwindcss v4.3.2"));
      const fontsReady = !document.fonts || document.fonts.status === "loaded";
      const lastMutationAt = renderWindow.__PRESENTON_LAST_RENDER_MUTATION_AT__
        ?? performance.now();
      const quietForMs = performance.now() - lastMutationAt;
      return {
        failedImages,
        fontsReady,
        pendingImages,
        pendingRequests: Array.from(renderWindow.__PRESENTON_RENDER_REQUESTS__?.values() ?? []),
        pendingStylesheets,
        quietForMs: quietForMs >= requiredQuietWindowMs ? quietForMs : 0,
        tailwindReady,
      };
    }, quietWindowMs, requireTailwind);

    if (
      lastState.tailwindReady &&
      lastState.fontsReady &&
      lastState.pendingImages.length === 0 &&
      lastState.pendingRequests.length === 0 &&
      (allowFailedImages || lastState.failedImages.length === 0) &&
      lastState.pendingStylesheets.length === 0 &&
      lastState.quietForMs >= quietWindowMs
    ) {
      await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }));
      return;
    }
    await delay(50);
  }

  throw new Error(
    `Timed out waiting for Render Readiness within ${input.timeoutMs}ms: ${describeReadinessBlockers(lastState)}`,
  );
}

export async function serializeRenderedPageToStaticHtml(
  page: StaticHtmlPageLike,
  kind: StaticHtmlDocumentKind,
): Promise<string> {
  return page.evaluate(async (documentKind) => {
    const canvases = Array.from(document.querySelectorAll("canvas"));
    for (const canvas of canvases) {
      const image = document.createElement("img");
      for (const attribute of Array.from(canvas.attributes)) {
        image.setAttribute(attribute.name, attribute.value);
      }
      image.src = canvas.toDataURL("image/png");
      image.width = canvas.width;
      image.height = canvas.height;
      canvas.replaceWith(image);
    }

    for (const element of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
      for (const attributeName of ["src", "href", "poster", "srcset", "style", "xlink:href"] as const) {
        const value = element.getAttribute(attributeName);
        if (!value?.includes("blob:")) continue;
        let rewrittenValue = value;
        const blobUrls = value.match(/blob:[^\s,"')]+/g) ?? [];
        for (const blobUrl of blobUrls) {
          const response = await fetch(blobUrl);
          const blob = await response.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.addEventListener("load", () => resolve(String(reader.result)), { once: true });
            reader.addEventListener("error", () => reject(reader.error), { once: true });
            reader.readAsDataURL(blob);
          });
          rewrittenValue = rewrittenValue.replaceAll(blobUrl, dataUrl);
        }
        element.setAttribute(attributeName, rewrittenValue);
      }
    }

    for (const stylesheet of Array.from(document.styleSheets)) {
      const owner = stylesheet.ownerNode;
      if (!(owner instanceof HTMLStyleElement)) continue;
      if (owner.textContent?.includes("tailwindcss v4.3.2")) continue;
      try {
        owner.textContent = Array.from(stylesheet.cssRules)
          .map((rule) => rule.cssText)
          .join("\n");
      } catch {
        // Keep the original style text when CSSOM access is unavailable.
      }
    }

    if (document.adoptedStyleSheets.length > 0) {
      const adoptedStyle = document.createElement("style");
      adoptedStyle.setAttribute("data-presenton-snapshot-styles", "adopted");
      adoptedStyle.textContent = document.adoptedStyleSheets
        .flatMap((stylesheet) => {
          try {
            return Array.from(stylesheet.cssRules).map((rule) => rule.cssText);
          } catch {
            return [];
          }
        })
        .join("\n");
      if (adoptedStyle.textContent) document.head.append(adoptedStyle);
    }

    for (const style of Array.from(document.querySelectorAll("style"))) {
      const value = style.textContent ?? "";
      if (!value.includes("blob:")) continue;
      let rewrittenValue = value;
      const blobUrls = value.match(/blob:[^\s,"')]+/g) ?? [];
      for (const blobUrl of blobUrls) {
        const response = await fetch(blobUrl);
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.addEventListener("load", () => resolve(String(reader.result)), { once: true });
          reader.addEventListener("error", () => reject(reader.error), { once: true });
          reader.readAsDataURL(blob);
        });
        rewrittenValue = rewrittenValue.replaceAll(blobUrl, dataUrl);
      }
      style.textContent = rewrittenValue;
    }

    document.querySelectorAll("iframe").forEach((iframe) => iframe.remove());
    document.querySelectorAll('link[rel="preload"], link[rel="prefetch"]')
      .forEach((link) => link.remove());
    document.querySelectorAll('style[type="text/tailwindcss"]')
      .forEach((style) => style.remove());

    for (const script of Array.from(document.scripts)) {
      const keepViewer = documentKind === "deck" &&
        script.getAttribute("data-presenton-static-script") === "viewer";
      if (!keepViewer) script.remove();
    }

    for (const element of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
      for (const attribute of Array.from(element.attributes)) {
        if (attribute.name.toLowerCase().startsWith("on")) {
          element.removeAttribute(attribute.name);
          continue;
        }
        if (
          ["href", "src", "action", "formaction"].includes(attribute.name.toLowerCase()) &&
          attribute.value.trim().toLowerCase().startsWith("javascript:")
        ) {
          element.removeAttribute(attribute.name);
        }
      }
    }

    const tailwindStyle = Array.from(document.querySelectorAll("style"))
      .find((style) => style.textContent?.includes("tailwindcss v4.3.2"));
    tailwindStyle?.setAttribute("data-presenton-snapshot-styles", "tailwind");

    const staticStyle = document.createElement("style");
    staticStyle.setAttribute("data-presenton-snapshot-styles", "static");
    staticStyle.textContent = [
      "*, *::before, *::after {",
      "  animation: none !important;",
      "  transition: none !important;",
      "}",
    ].join("\n");
    document.head.append(staticStyle);

    const wrapper = document.getElementById("presentation-slides-wrapper");
    wrapper?.setAttribute("data-presenton-render-status", "ready");
    wrapper?.removeAttribute("data-presenton-render-message");
    document.documentElement.setAttribute("data-presenton-render-document", "static");

    return `<!doctype html>\n${document.documentElement.outerHTML}`;
  }, kind);
}
