import path from "node:path";
import { access } from "node:fs/promises";

import { resolveBundledBrowserExecutable } from "./bundled-browser-runtime.js";

export interface BrowserRuntimeElementHandleLike {
  evaluate: <T>(pageFunction: (...args: any[]) => T, ...args: any[]) => Promise<T>;
}

export interface BrowserRuntimePageLike {
  $: (selector: string) => Promise<BrowserRuntimeElementHandleLike | null>;
}

export interface BrowserRuntimeBrowserLike {
  newPage: () => Promise<unknown>;
  close: () => Promise<void>;
  process?: () => BrowserRuntimeProcessLike | null;
}

export interface BrowserRuntimePageCloseLike {
  close: () => Promise<void>;
}

export interface BrowserRuntimeProcessLike {
  exitCode: number | null;
  signalCode: NodeJS.Signals | null;
  kill: (signal: NodeJS.Signals) => boolean;
}

export interface CloseManagedBrowserInput {
  purpose: string;
  browser: Pick<BrowserRuntimeBrowserLike, "close" | "process">;
  page?: BrowserRuntimePageCloseLike | null;
  pageCloseTimeoutMs?: number;
  browserCloseTimeoutMs?: number;
  terminateGraceMs?: number;
  killGraceMs?: number;
}

export interface LaunchManagedBrowserInput {
  purpose: string;
  launchOptions?: Record<string, unknown>;
  dumpio?: boolean;
  bundledBrowserResolver?: () => Promise<string | null>;
}

export interface WaitForRenderReadyInput {
  selector: string;
  timeoutMs: number;
  kindLabel: string;
  readyValue?: string;
  errorValue?: string;
  statusAttribute?: string;
  messageAttribute?: string;
  pollIntervalMs?: number;
}

const DEFAULT_BROWSER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-web-security",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-features=TranslateUI",
  "--disable-ipc-flooding-protection",
];

const CHROME_EXECUTABLE_ENV_KEYS = [
  "PRESENTON_CHROME_EXECUTABLE_PATH",
  "PUPPETEER_EXECUTABLE_PATH",
  "CHROME_PATH",
  "GOOGLE_CHROME_BIN",
];

const DEFAULT_PAGE_CLOSE_TIMEOUT_MS = 2_000;
const DEFAULT_BROWSER_CLOSE_TIMEOUT_MS = 5_000;
const DEFAULT_BROWSER_TERMINATE_GRACE_MS = 2_000;
const DEFAULT_BROWSER_KILL_GRACE_MS = 1_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

type PromiseSettlement = "fulfilled" | "rejected" | "timed-out";

async function settleWithin(
  operation: () => Promise<unknown>,
  timeoutMs: number,
): Promise<PromiseSettlement> {
  return new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve("timed-out");
    }, timeoutMs);

    Promise.resolve().then(operation).then(
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve("fulfilled");
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve("rejected");
      },
    );
  });
}

function hasBrowserProcessExited(browserProcess: BrowserRuntimeProcessLike): boolean {
  return browserProcess.exitCode !== null || browserProcess.signalCode !== null;
}

async function waitForBrowserProcessExit(
  browserProcess: BrowserRuntimeProcessLike,
  timeoutMs: number,
): Promise<boolean> {
  const startedAt = Date.now();
  while (!hasBrowserProcessExited(browserProcess) && Date.now() - startedAt < timeoutMs) {
    await delay(Math.min(25, Math.max(1, timeoutMs)));
  }
  return hasBrowserProcessExited(browserProcess);
}

async function forceTerminateBrowserProcess(
  browserProcess: BrowserRuntimeProcessLike,
  input: Pick<CloseManagedBrowserInput, "purpose" | "terminateGraceMs" | "killGraceMs">,
): Promise<void> {
  if (hasBrowserProcessExited(browserProcess)) return;

  const terminateGraceMs = input.terminateGraceMs ?? DEFAULT_BROWSER_TERMINATE_GRACE_MS;
  const killGraceMs = input.killGraceMs ?? DEFAULT_BROWSER_KILL_GRACE_MS;
  process.stderr.write(
    `[browser-runtime] Graceful Chrome shutdown timed out for ${input.purpose}; sending SIGTERM\n`,
  );
  browserProcess.kill("SIGTERM");
  if (await waitForBrowserProcessExit(browserProcess, terminateGraceMs)) return;

  process.stderr.write(
    `[browser-runtime] Chrome did not exit after SIGTERM for ${input.purpose}; sending SIGKILL\n`,
  );
  browserProcess.kill("SIGKILL");
  await waitForBrowserProcessExit(browserProcess, killGraceMs);
}

export async function closeManagedPage(
  page: BrowserRuntimePageCloseLike,
  input: { purpose: string; timeoutMs?: number },
): Promise<void> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_PAGE_CLOSE_TIMEOUT_MS;
  const settlement = await settleWithin(() => page.close(), timeoutMs);
  if (settlement === "timed-out") {
    throw new Error(`${input.purpose} page.close() timed out after ${timeoutMs}ms`);
  }
  if (settlement === "rejected") {
    process.stderr.write(`[browser-runtime] page.close() failed for ${input.purpose}\n`);
  }
}

export async function closeManagedBrowser(input: CloseManagedBrowserInput): Promise<void> {
  const browserProcess = input.browser.process?.() ?? null;
  const pageCloseTimeoutMs = input.pageCloseTimeoutMs ?? DEFAULT_PAGE_CLOSE_TIMEOUT_MS;
  const browserCloseTimeoutMs = input.browserCloseTimeoutMs ?? DEFAULT_BROWSER_CLOSE_TIMEOUT_MS;

  let pageSettlement: PromiseSettlement = "fulfilled";
  if (input.page) {
    pageSettlement = await settleWithin(() => input.page!.close(), pageCloseTimeoutMs);
    if (pageSettlement !== "fulfilled") {
      process.stderr.write(
        `[browser-runtime] page.close() ${pageSettlement} for ${input.purpose}; closing the browser\n`,
      );
    }
  }

  const browserSettlement = await settleWithin(
    () => input.browser.close(),
    browserCloseTimeoutMs,
  );
  if (browserSettlement === "fulfilled") return;

  if (browserProcess && !hasBrowserProcessExited(browserProcess)) {
    await forceTerminateBrowserProcess(browserProcess, input);
    return;
  }

  if (pageSettlement === "timed-out" || browserSettlement === "timed-out") {
    process.stderr.write(
      `[browser-runtime] Chrome shutdown timed out for ${input.purpose}, but no live browser process handle was available\n`,
    );
  }
}

function getNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getPlatformChromeExecutableCandidates(): string[] {
  if (process.platform === "darwin") {
    const homeDir = getNonEmptyString(process.env.HOME);
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      homeDir
        ? path.join(
          homeDir,
          "Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        )
        : null,
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    ].filter((candidate): candidate is string => Boolean(candidate));
  }

  if (process.platform === "win32") {
    const localAppData = getNonEmptyString(process.env.LOCALAPPDATA);
    const programFiles = getNonEmptyString(process.env.PROGRAMFILES);
    const programFilesX86 = getNonEmptyString(process.env["PROGRAMFILES(X86)"]);
    return [
      localAppData
        ? path.join(localAppData, "Google/Chrome/Application/chrome.exe")
        : null,
      programFiles
        ? path.join(programFiles, "Google/Chrome/Application/chrome.exe")
        : null,
      programFilesX86
        ? path.join(programFilesX86, "Google/Chrome/Application/chrome.exe")
        : null,
    ].filter((candidate): candidate is string => Boolean(candidate));
  }

  return [
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
}

export function getConfiguredChromeExecutable(): { key: string; value: string } | null {
  for (const key of CHROME_EXECUTABLE_ENV_KEYS) {
    const value = getNonEmptyString(process.env[key]);
    if (value) {
      return { key, value };
    }
  }

  return null;
}

export async function findFirstAccessiblePath(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next known location.
    }
  }

  return null;
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createBrowserLaunchError(
  purpose: string,
  attempts: string[],
  fallbackError: unknown,
): Error {
  const details = attempts.length > 0
    ? ` ${attempts.join(" ")}`
    : "";
  return new Error(
    `Could not launch a managed browser for ${purpose}.${details} Puppeteer default launch also failed: ${formatErrorMessage(fallbackError)}`,
    { cause: fallbackError instanceof Error ? fallbackError : undefined },
  );
}

export async function launchManagedBrowser(
  puppeteer: any,
  input: LaunchManagedBrowserInput,
): Promise<BrowserRuntimeBrowserLike> {
  const explicitExecutablePath = getNonEmptyString(input.launchOptions?.executablePath);
  const explicitChannel = getNonEmptyString(input.launchOptions?.channel);
  const normalizedLaunchOptions = {
    headless: true,
    dumpio: input.dumpio ?? false,
    args: DEFAULT_BROWSER_ARGS,
    ...input.launchOptions,
  };

  if (explicitExecutablePath || explicitChannel) {
    try {
      return (await puppeteer.launch(normalizedLaunchOptions)) as BrowserRuntimeBrowserLike;
    } catch (error) {
      const targetLabel = explicitExecutablePath
        ? `executablePath "${explicitExecutablePath}"`
        : `channel "${explicitChannel}"`;
      throw new Error(
        `Failed to launch browser for ${input.purpose} using explicit ${targetLabel}: ${formatErrorMessage(error)}`,
        { cause: error instanceof Error ? error : undefined },
      );
    }
  }

  const configuredExecutable = getConfiguredChromeExecutable();
  if (configuredExecutable) {
    try {
      return (await puppeteer.launch({
        ...normalizedLaunchOptions,
        executablePath: configuredExecutable.value,
      })) as BrowserRuntimeBrowserLike;
    } catch (error) {
      throw new Error(
        `Failed to launch browser for ${input.purpose} using ${configuredExecutable.key}="${configuredExecutable.value}": ${formatErrorMessage(error)}`,
        { cause: error instanceof Error ? error : undefined },
      );
    }
  }

  let bundledExecutablePath: string | null;
  try {
    bundledExecutablePath = await (
      input.bundledBrowserResolver ?? resolveBundledBrowserExecutable
    )();
  } catch (error) {
    throw new Error(
      `Could not resolve the bundled browser for ${input.purpose}: ${formatErrorMessage(error)}`,
      { cause: error instanceof Error ? error : undefined },
    );
  }

  if (bundledExecutablePath) {
    try {
      return (await puppeteer.launch({
        ...normalizedLaunchOptions,
        executablePath: bundledExecutablePath,
      })) as BrowserRuntimeBrowserLike;
    } catch (error) {
      throw new Error(
        `Failed to launch the bundled browser for ${input.purpose} at "${bundledExecutablePath}": ${formatErrorMessage(error)}`,
        { cause: error instanceof Error ? error : undefined },
      );
    }
  }

  const systemCandidates = [...new Set(getPlatformChromeExecutableCandidates())];
  const systemExecutablePath = await findFirstAccessiblePath(systemCandidates);
  const attempts: string[] = [];

  if (systemExecutablePath) {
    try {
      return (await puppeteer.launch({
        ...normalizedLaunchOptions,
        executablePath: systemExecutablePath,
      })) as BrowserRuntimeBrowserLike;
    } catch (error) {
      attempts.push(
        `Tried system Chrome at "${systemExecutablePath}" first, but launch failed: ${formatErrorMessage(error)}.`,
      );
    }
  } else {
    attempts.push(
      `No system Chrome executable was found in known locations: ${systemCandidates.join(", ")}.`,
    );
  }

  try {
    return (await puppeteer.launch(normalizedLaunchOptions)) as BrowserRuntimeBrowserLike;
  } catch (error) {
    throw createBrowserLaunchError(input.purpose, attempts, error);
  }
}

export async function waitForRenderReady(
  page: BrowserRuntimePageLike,
  input: WaitForRenderReadyInput,
): Promise<BrowserRuntimeElementHandleLike> {
  const startedAt = Date.now();
  const readyValue = input.readyValue ?? "ready";
  const errorValue = input.errorValue ?? "error";
  const statusAttribute = input.statusAttribute ?? "data-presenton-render-status";
  const messageAttribute = input.messageAttribute ?? "data-presenton-render-message";
  const pollIntervalMs = input.pollIntervalMs ?? 50;

  while (Date.now() - startedAt <= input.timeoutMs) {
    const element = await page.$(input.selector);
    if (!element) {
      await delay(pollIntervalMs);
      continue;
    }

    const status = await element.evaluate(
      (el, attributeName) => el.getAttribute(String(attributeName)),
      statusAttribute,
    );

    if (status === readyValue) {
      return element;
    }

    if (status === errorValue) {
      const message = await element.evaluate(
        (el, attributeName) => el.getAttribute(String(attributeName)),
        messageAttribute,
      );
      throw new Error(
        message
          ? `${input.kindLabel} render failed: ${message}`
          : `${input.kindLabel} render failed with status=${errorValue}`,
      );
    }

    await delay(pollIntervalMs);
  }

  throw new Error(
    `Timed out waiting for ${input.kindLabel.toLowerCase()} render ready: ${input.selector} within ${input.timeoutMs}ms`,
  );
}
