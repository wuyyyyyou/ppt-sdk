import path from "node:path";
import { access } from "node:fs/promises";

export interface BrowserRuntimeElementHandleLike {
  evaluate: <T>(pageFunction: (...args: any[]) => T, ...args: any[]) => Promise<T>;
}

export interface BrowserRuntimePageLike {
  $: (selector: string) => Promise<BrowserRuntimeElementHandleLike | null>;
}

export interface BrowserRuntimeBrowserLike {
  newPage: () => Promise<unknown>;
  close: () => Promise<void>;
}

export interface LaunchManagedBrowserInput {
  purpose: string;
  launchOptions?: Record<string, unknown>;
  dumpio?: boolean;
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
