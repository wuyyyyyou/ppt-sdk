import test from "node:test";
import assert from "node:assert/strict";

import {
  launchManagedBrowser,
  waitForRenderReady,
} from "../../src/runtime/browser-runtime.ts";

class MockElementHandle {
  constructor(private readonly attributes: Record<string, string>) {}

  async evaluate<T>(pageFunction: (...args: any[]) => T, ...args: any[]) {
    return pageFunction(this as unknown as Element, ...args);
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }
}

class MockPage {
  constructor(
    private readonly selectors: Record<string, MockElementHandle | null>,
  ) {}

  async $(selector: string) {
    return this.selectors[selector] ?? null;
  }
}

async function withChromeExecutableEnvCleared<T>(fn: () => Promise<T>): Promise<T> {
  const keys = [
    "PRESENTON_CHROME_EXECUTABLE_PATH",
    "PUPPETEER_EXECUTABLE_PATH",
    "CHROME_PATH",
    "GOOGLE_CHROME_BIN",
  ];
  const original = new Map(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  try {
    return await fn();
  } finally {
    for (const key of keys) {
      const value = original.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("launchManagedBrowser prefers configured executable path", async () => {
  const original = process.env.PRESENTON_CHROME_EXECUTABLE_PATH;
  process.env.PRESENTON_CHROME_EXECUTABLE_PATH = "/tmp/presenton-chrome";

  const launchCalls: Array<Record<string, unknown>> = [];
  const puppeteer = {
    async launch(options: Record<string, unknown>) {
      launchCalls.push(options);
      return {
        newPage: async () => ({}),
        close: async () => {},
      };
    },
  };

  try {
    const browser = await launchManagedBrowser(puppeteer, {
      purpose: "test-browser-runtime",
    });

    assert.ok(browser);
    assert.equal(launchCalls.length, 1);
    assert.equal(launchCalls[0]?.executablePath, "/tmp/presenton-chrome");
    assert.equal(launchCalls[0]?.headless, true);
  } finally {
    if (original === undefined) {
      delete process.env.PRESENTON_CHROME_EXECUTABLE_PATH;
    } else {
      process.env.PRESENTON_CHROME_EXECUTABLE_PATH = original;
    }
  }
});

test("launchManagedBrowser reports explicit launch failures", async () => {
  const puppeteer = {
    async launch() {
      throw new Error("launch boom");
    },
  };

  await assert.rejects(
    () => launchManagedBrowser(puppeteer, {
      purpose: "test-browser-runtime",
      launchOptions: { executablePath: "/tmp/custom-chrome" },
    }),
    (error: Error) => {
      assert.match(
        error.message,
        /Failed to launch browser for test-browser-runtime using explicit executablePath "\/tmp\/custom-chrome"/,
      );
      return true;
    },
  );
});

test("launchManagedBrowser uses the bundled browser before system discovery", async () => {
  const launchCalls: Array<Record<string, unknown>> = [];
  const puppeteer = {
    async launch(options: Record<string, unknown>) {
      launchCalls.push(options);
      return {
        newPage: async () => ({}),
        close: async () => {},
      };
    },
  };

  await withChromeExecutableEnvCleared(() => launchManagedBrowser(puppeteer, {
    purpose: "test-bundled-browser",
    bundledBrowserResolver: async () => "/binary/lib/browser/chrome",
  }));

  assert.equal(launchCalls.length, 1);
  assert.equal(launchCalls[0]?.executablePath, "/binary/lib/browser/chrome");
});

test("launchManagedBrowser does not fall back when the bundled browser fails", async () => {
  let launchCount = 0;
  const puppeteer = {
    async launch() {
      launchCount += 1;
      throw new Error("bundled launch boom");
    },
  };

  await withChromeExecutableEnvCleared(() => assert.rejects(
    () => launchManagedBrowser(puppeteer, {
      purpose: "test-bundled-browser",
      bundledBrowserResolver: async () => "/binary/lib/browser/chrome",
    }),
    /Failed to launch the bundled browser/,
  ));
  assert.equal(launchCount, 1);
});

test("waitForRenderReady returns when the wrapper is ready", async () => {
  const page = new MockPage({
    "#presentation-slides-wrapper": new MockElementHandle({
      "data-presenton-render-status": "ready",
    }),
  });

  const element = await waitForRenderReady(page, {
    selector: "#presentation-slides-wrapper",
    timeoutMs: 100,
    kindLabel: "Deck",
  });

  const status = await element.evaluate((el) =>
    (el as unknown as { getAttribute(name: string): string | null }).getAttribute(
      "data-presenton-render-status",
    ),
  );
  assert.equal(status, "ready");
});

test("waitForRenderReady reports render errors", async () => {
  const page = new MockPage({
    "#presentation-slides-wrapper": new MockElementHandle({
      "data-presenton-render-status": "error",
      "data-presenton-render-message": "broken render",
    }),
  });

  await assert.rejects(
    () => waitForRenderReady(page, {
      selector: "#presentation-slides-wrapper",
      timeoutMs: 100,
      kindLabel: "Deck",
    }),
    (error: Error) => {
      assert.match(error.message, /Deck render failed: broken render/);
      return true;
    },
  );
});

test("waitForRenderReady reports timeouts", async () => {
  const page = new MockPage({
    "#presentation-slides-wrapper": null,
  });

  await assert.rejects(
    () => waitForRenderReady(page, {
      selector: "#presentation-slides-wrapper",
      timeoutMs: 10,
      kindLabel: "Deck",
      pollIntervalMs: 1,
    }),
    (error: Error) => {
      assert.match(
        error.message,
        /Timed out waiting for deck render ready: #presentation-slides-wrapper within 10ms/,
      );
      return true;
    },
  );
});
