import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { runStaticRules } from "../../src/validate/index.ts";

const VALID_SLIDE_MODULE = `export const Schema = {
  parse(value) {
    return value ?? { title: "Title" };
  },
};

export const layoutId = "example-slide";
export const layoutName = "Example Slide";
export const layoutDescription = "Example slide for validation tests.";

const ExampleSlide = ({ data }) => {
  const parsed = Schema.parse(data ?? {});
  return parsed.title;
};

export default ExampleSlide;
`;

const MISSING_SCHEMA_SLIDE_MODULE = `export const layoutId = "broken-slide";
export const layoutName = "Broken Slide";
export const layoutDescription = "Broken slide missing Schema.";

export default function BrokenSlide() {
  return "broken";
}
`;

async function withDeckFixture(
  builder: (deckDir: string, rootDir: string) => Promise<string>,
  fn: (manifestPath: string) => Promise<void>,
) {
  const tempRoot = path.join(process.cwd(), "test", ".tmp");
  await mkdir(tempRoot, { recursive: true });
  const rootDir = await mkdtemp(path.join(tempRoot, "presenton-ve-static-"));
  const deckDir = path.join(rootDir, "deck");

  try {
    await mkdir(deckDir, { recursive: true });
    const manifestPath = await builder(deckDir, rootDir);
    await fn(manifestPath);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

async function writeBaseDeckFiles(deckDir: string, input?: {
  includeGroupJson?: boolean;
  slideSourcePath?: string;
  slideTsx?: string;
  manifestOverrides?: Record<string, unknown>;
}) {
  await mkdir(path.join(deckDir, "slides"), { recursive: true });

  if (input?.includeGroupJson !== false) {
    await writeFile(
      path.join(deckDir, "group.json"),
      `${JSON.stringify({
        group_id: "deck-group",
        group_name: "Deck Group",
        group_description: "Validation fixture group",
        ordered: false,
        default: false,
      }, null, 2)}\n`,
      "utf8",
    );
  }

  const slidePath = input?.slideSourcePath ?? "./slides/ExampleSlide.ts";
  if (!slidePath.includes("../outside/")) {
    await writeFile(
      path.join(deckDir, "slides", "ExampleSlide.ts"),
      input?.slideTsx ?? VALID_SLIDE_MODULE,
      "utf8",
    );
  }

  const manifest = {
    title: "Validation Fixture",
    slides: [
      {
        id: "slide-1",
        source: {
          type: "local",
          path: slidePath,
        },
        data: {
          title: "Fixture title",
        },
      },
    ],
    ...(input?.manifestOverrides ?? {}),
  };

  const manifestPath = path.join(deckDir, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifestPath;
}

test("valid local manifest deck passes VE-02 static rules", async () => {
  await withDeckFixture(
    (deckDir) => writeBaseDeckFiles(deckDir),
    async (manifestPath) => {
      const diagnostics = await runStaticRules({ manifestPath });
      assert.deepEqual(diagnostics, []);
    },
  );
});

test("missing group.json reports STATIC-001", async () => {
  await withDeckFixture(
    (deckDir) => writeBaseDeckFiles(deckDir, { includeGroupJson: false }),
    async (manifestPath) => {
      const diagnostics = await runStaticRules({ manifestPath });
      assert.deepEqual(
        diagnostics.map((diagnostic) => diagnostic.ruleId),
        ["STATIC-001"],
      );
    },
  );
});

test("duplicate slide ids report STATIC-002", async () => {
  await withDeckFixture(
    async (deckDir) => {
      const manifestPath = await writeBaseDeckFiles(deckDir);
      await writeFile(
        manifestPath,
        `${JSON.stringify({
          title: "Duplicate IDs",
          slides: [
            {
              id: "dup",
              source: { type: "local", path: "./slides/ExampleSlide.ts" },
            },
            {
              id: "dup",
              source: { type: "local", path: "./slides/ExampleSlide.ts" },
            },
          ],
        }, null, 2)}\n`,
        "utf8",
      );
      return manifestPath;
    },
    async (manifestPath) => {
      const diagnostics = await runStaticRules({ manifestPath });
      assert.ok(diagnostics.some((diagnostic) => diagnostic.ruleId === "STATIC-002"));
    },
  );
});

test("path outside manifest root reports STATIC-003", async () => {
  await withDeckFixture(
    async (deckDir, rootDir) => {
      const outsideDir = path.join(rootDir, "outside");
      await mkdir(outsideDir, { recursive: true });
      await writeFile(path.join(outsideDir, "ExampleSlide.ts"), VALID_SLIDE_MODULE, "utf8");
      return writeBaseDeckFiles(deckDir, {
        slideSourcePath: "../outside/ExampleSlide.ts",
      });
    },
    async (manifestPath) => {
      const diagnostics = await runStaticRules({ manifestPath });
      assert.ok(diagnostics.some((diagnostic) => diagnostic.ruleId === "STATIC-003"));
    },
  );
});

test("missing required local template exports report STATIC-004", async () => {
  await withDeckFixture(
    (deckDir) => writeBaseDeckFiles(deckDir, {
      slideTsx: MISSING_SCHEMA_SLIDE_MODULE,
    }),
    async (manifestPath) => {
      const diagnostics = await runStaticRules({ manifestPath });
      assert.ok(diagnostics.some((diagnostic) => diagnostic.ruleId === "STATIC-004"));
    },
  );
});

test("shared module entries report STATIC-010", async () => {
  await withDeckFixture(
    async (deckDir) => {
      await mkdir(path.join(deckDir, "shared"), { recursive: true });
      await writeFile(path.join(deckDir, "shared", "theme.ts"), "export const theme = {};\n", "utf8");
      return writeBaseDeckFiles(deckDir, {
        slideSourcePath: "./shared/theme.ts",
      });
    },
    async (manifestPath) => {
      const diagnostics = await runStaticRules({ manifestPath });
      assert.ok(diagnostics.some((diagnostic) => diagnostic.ruleId === "STATIC-010"));
    },
  );
});
