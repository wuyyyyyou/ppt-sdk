export interface ElementHandleLike {
  $$: (selector: string) => Promise<ElementHandleLike[]>;
  evaluate: <T>(pageFunction: (...args: any[]) => T, ...args: any[]) => Promise<T>;
  screenshot: (options?: { path?: string }) => Promise<unknown>;
}

export interface PageLike {
  evaluateOnNewDocument?: (
    pageFunction: (...args: any[]) => unknown,
    ...args: any[]
  ) => Promise<void>;
  setViewport?: (viewport: {
    width: number;
    height: number;
    deviceScaleFactor?: number;
  }) => Promise<void>;
  setContent: (
    html: string,
    options?: { waitUntil?: string | string[]; timeout?: number },
  ) => Promise<void>;
  $: (selector: string) => Promise<ElementHandleLike | null>;
  close?: () => Promise<void>;
}

export interface BrowserLike {
  newPage: () => Promise<PageLike>;
  close: () => Promise<void>;
}
