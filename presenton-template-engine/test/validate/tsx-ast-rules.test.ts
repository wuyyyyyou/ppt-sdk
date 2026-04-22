import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { runStaticRules } from "../../src/validate/index.ts";

const VALID_SLIDE = `import * as z from "zod";

export const Schema = z.object({
  title: z.string().default("Title"),
  subtitle: z.string().default("Subtitle"),
});

export const layoutId = "ast-valid";
export const layoutName = "AST Valid";
export const layoutDescription = "AST validation fixture.";

export default function AstValidSlide({ data }) {
  const parsed = Schema.parse(data ?? {});
  return (
    <div className="w-[1280px] h-[720px]">
      <h1>{parsed.title}</h1>
      <p>{parsed.subtitle}</p>
    </div>
  );
}
`;

async function withDeckFixture(
  slideSource: string,
  fn: (manifestPath: string) => Promise<void>,
) {
  const tempRoot = path.join(process.cwd(), "test", ".tmp");
  await mkdir(tempRoot, { recursive: true });
  const rootDir = await mkdtemp(path.join(tempRoot, "presenton-ve-ast-"));
  const deckDir = path.join(rootDir, "deck");

  try {
    await mkdir(path.join(deckDir, "slides"), { recursive: true });
    await writeFile(
      path.join(deckDir, "group.json"),
      `${JSON.stringify({
        group_id: "deck-group",
        group_name: "Deck Group",
        group_description: "AST validation fixture group",
        ordered: false,
        default: false,
      }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(path.join(deckDir, "slides", "Slide.tsx"), slideSource, "utf8");
    const manifestPath = path.join(deckDir, "manifest.json");
    await writeFile(
      manifestPath,
      `${JSON.stringify({
        title: "AST Fixture",
        slides: [
          {
            id: "slide-1",
            source: {
              type: "local",
              path: "./slides/Slide.tsx",
            },
          },
        ],
      }, null, 2)}\n`,
      "utf8",
    );

    await fn(manifestPath);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

test("valid TSX slide satisfies VE-03 AST rules", async () => {
  await withDeckFixture(VALID_SLIDE, async (manifestPath) => {
    const diagnostics = await runStaticRules({ manifestPath });
    assert.deepEqual(diagnostics, []);
  });
});

test("missing zod-backed Schema reports STATIC-005", async () => {
  await withDeckFixture(
    VALID_SLIDE.replace('import * as z from "zod";\n\nexport const Schema = z.object({\n  title: z.string().default("Title"),\n  subtitle: z.string().default("Subtitle"),\n});', 'export const Schema = { parse(value) { return value ?? {}; } };'),
    async (manifestPath) => {
      const diagnostics = await runStaticRules({ manifestPath });
      assert.ok(diagnostics.some((diagnostic) => diagnostic.ruleId === "STATIC-005"));
    },
  );
});

test("missing Schema.parse call reports STATIC-006", async () => {
  await withDeckFixture(
    VALID_SLIDE.replace("const parsed = Schema.parse(data ?? {});", "const parsed = data ?? {};"),
    async (manifestPath) => {
      const diagnostics = await runStaticRules({ manifestPath });
      assert.ok(diagnostics.some((diagnostic) => diagnostic.ruleId === "STATIC-006"));
    },
  );
});

test("fields read outside Schema report STATIC-007", async () => {
  await withDeckFixture(
    VALID_SLIDE.replace(
      'export const Schema = z.object({\n  title: z.string().default("Title"),\n  subtitle: z.string().default("Subtitle"),\n});',
      'export const Schema = z.object({\n  title: z.string().default("Title"),\n});',
    ),
    async (manifestPath) => {
      const diagnostics = await runStaticRules({ manifestPath });
      assert.ok(diagnostics.some((diagnostic) => diagnostic.ruleId === "STATIC-007"));
    },
  );
});

test("missing fixed canvas hint reports STATIC-008 warning", async () => {
  await withDeckFixture(
    VALID_SLIDE.replace('className="w-[1280px] h-[720px]"', 'className="w-full"'),
    async (manifestPath) => {
      const diagnostics = await runStaticRules({ manifestPath });
      assert.ok(diagnostics.some((diagnostic) =>
        diagnostic.ruleId === "STATIC-008" && diagnostic.severity === "warning"
      ));
    },
  );
});

test("runtime network or unsupported imports report STATIC-009", async () => {
  await withDeckFixture(
    `import { renderToStaticMarkup } from "react-dom/server";
${VALID_SLIDE}

function loadRemoteData() {
  return fetch("https://example.com");
}

void renderToStaticMarkup;
void loadRemoteData;
`,
    async (manifestPath) => {
      const diagnostics = await runStaticRules({ manifestPath });
      assert.ok(diagnostics.some((diagnostic) => diagnostic.ruleId === "STATIC-009"));
    },
  );
});
