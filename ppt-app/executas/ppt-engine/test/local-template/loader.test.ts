import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  assertLocalTemplateModule,
  importLocalTemplateModule,
} from "../../src/local-template/loader.ts";

test("imports a TSX local template without template-local node_modules", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "presenton-local-template-loader-"));

  try {
    await mkdir(path.join(rootDir, "slides", "shared"), { recursive: true });
    await writeFile(
      path.join(rootDir, "slides", "shared", "suffix.ts"),
      "export const suffix = 'runtime';\n",
      "utf8",
    );
    await writeFile(
      path.join(rootDir, "slides", "Slide.tsx"),
      [
        'import React from "react";',
        'import * as z from "zod";',
        'import { suffix } from "./shared/suffix";',
        "",
        "export const Schema = z.object({",
        '  title: z.string().default("Title"),',
        "});",
        'export const layoutId = "loader-fixture";',
        'export const layoutName = "Loader Fixture";',
        'export const layoutDescription = "Loads through bundled runtime dependencies.";',
        "",
        "export default function Slide({ data }) {",
        "  const parsed = Schema.parse(data ?? {});",
        "  return <div>{parsed.title}-{suffix}</div>;",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );

    const moduleValue = await importLocalTemplateModule(
      path.join(rootDir, "slides", "Slide.tsx"),
      rootDir,
    );

    assertLocalTemplateModule(moduleValue, path.join(rootDir, "slides", "Slide.tsx"));
    assert.equal(moduleValue.layoutId, "loader-fixture");
    assert.deepEqual(moduleValue.Schema.parse({}), { title: "Title" });
    assert.equal(typeof moduleValue.default, "function");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("imports a Recharts local template through runtime React shims", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "presenton-local-template-loader-"));

  try {
    await mkdir(path.join(rootDir, "slides"), { recursive: true });
    await writeFile(
      path.join(rootDir, "slides", "ChartSlide.tsx"),
      [
        'import React from "react";',
        'import * as z from "zod";',
        'import { Bar, BarChart } from "recharts";',
        "",
        "export const Schema = z.object({",
        '  title: z.string().default("Chart"),',
        "});",
        'export const layoutId = "recharts-fixture";',
        'export const layoutName = "Recharts Fixture";',
        'export const layoutDescription = "Loads Recharts through bundled runtime dependencies.";',
        "",
        "export default function ChartSlide({ data }) {",
        "  const parsed = Schema.parse(data ?? {});",
        "  return (",
        "    <div>",
        "      <h1>{parsed.title}</h1>",
        '      <BarChart width={320} height={180} data={[{ name: "A", value: 10 }]}>',
        '        <Bar dataKey="value" />',
        "      </BarChart>",
        "    </div>",
        "  );",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );

    const moduleValue = await importLocalTemplateModule(
      path.join(rootDir, "slides", "ChartSlide.tsx"),
      rootDir,
    );

    assertLocalTemplateModule(moduleValue, path.join(rootDir, "slides", "ChartSlide.tsx"));
    assert.equal(moduleValue.layoutId, "recharts-fixture");
    assert.deepEqual(moduleValue.Schema.parse({}), { title: "Chart" });
    assert.equal(typeof moduleValue.default, "function");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("imports a use-resize-observer local template through runtime React shims", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "presenton-local-template-loader-"));

  try {
    await mkdir(path.join(rootDir, "slides"), { recursive: true });
    await writeFile(
      path.join(rootDir, "slides", "MeasuredSlide.tsx"),
      [
        'import React from "react";',
        'import * as z from "zod";',
        'import useResizeObserver from "use-resize-observer";',
        "",
        "export const Schema = z.object({",
        '  title: z.string().default("Measured"),',
        "});",
        'export const layoutId = "resize-observer-fixture";',
        'export const layoutName = "Resize Observer Fixture";',
        'export const layoutDescription = "Loads use-resize-observer through bundled runtime dependencies.";',
        "",
        "export default function MeasuredSlide({ data }) {",
        "  const parsed = Schema.parse(data ?? {});",
        "  const { ref, width = 0 } = useResizeObserver();",
        "  return <div ref={ref}>{parsed.title}-{width}</div>;",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );

    const moduleValue = await importLocalTemplateModule(
      path.join(rootDir, "slides", "MeasuredSlide.tsx"),
      rootDir,
    );

    assertLocalTemplateModule(moduleValue, path.join(rootDir, "slides", "MeasuredSlide.tsx"));
    assert.equal(moduleValue.layoutId, "resize-observer-fixture");
    assert.deepEqual(moduleValue.Schema.parse({}), { title: "Measured" });
    assert.equal(typeof moduleValue.default, "function");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("reports unsupported template runtime imports clearly", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "presenton-local-template-loader-"));

  try {
    await mkdir(path.join(rootDir, "slides"), { recursive: true });
    await writeFile(
      path.join(rootDir, "slides", "Slide.tsx"),
      [
        'import leftPad from "left-pad";',
        'import * as z from "zod";',
        "",
        "void leftPad;",
        'export const Schema = z.object({ title: z.string().default("Title") });',
        'export const layoutId = "unsupported-import";',
        'export const layoutName = "Unsupported Import";',
        'export const layoutDescription = "Fails on unsupported imports.";',
        "export default function Slide() { return <div />; }",
        "",
      ].join("\n"),
      "utf8",
    );

    await assert.rejects(
      () => importLocalTemplateModule(path.join(rootDir, "slides", "Slide.tsx"), rootDir),
      /not included in the Presenton template runtime/,
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
