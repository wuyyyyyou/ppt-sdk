import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

import { templates } from "../../src/app/presentation-templates/generated-registry.ts";
import { Schema, sampleData } from "../../src/app/presentation-templates/agent-freestyle-v2/slides/BlankSlide.tsx";

const templateRoot = new URL("../../src/app/presentation-templates/agent-freestyle-v2/", import.meta.url);

async function pathExists(relativePath: string) {
  try {
    await access(new URL(relativePath, templateRoot));
    return true;
  } catch {
    return false;
  }
}

test("agent-freestyle-v2 registers one neutral starter canvas", () => {
  const group = templates.find((item) => item.id === "agent-freestyle-v2");
  assert.ok(group);
  assert.equal(group.layouts.length, 1);
  assert.equal(group.layouts[0]?.layoutId, "agent-freestyle-v2:blank-slide");
  assert.deepEqual(sampleData, {});
  assert.deepEqual(Schema.parse({}), {});
});

test("agent-freestyle-v2 has primitives and reference components without blueprints", async () => {
  assert.equal(await pathExists("blueprints/"), false);
  assert.equal(await pathExists("catalog.json"), false);

  const primitives = (await readdir(new URL("components/", templateRoot))).filter((entry) => entry.endsWith(".tsx"));
  assert.deepEqual(primitives.sort(), ["LocalImage.tsx", "MeasuredChartArea.tsx", "SlideCanvas.tsx", "SlideIcons.tsx", "StableInlineRow.tsx"]);

  const references = await readdir(new URL("reference-components/", templateRoot));
  assert.ok(references.includes("ImageShowcasePanel.tsx"));
  assert.ok(references.includes("FinanceBarChart.tsx"));
  assert.ok(references.includes("FinanceDonutChart.tsx"));
  assert.ok(references.includes("FinanceLineChart.tsx"));
  assert.ok(references.includes("FinanceRadarChart.tsx"));

  const guide = await readFile(new URL("slides/README.md", templateRoot), "utf8");
  assert.match(guide, /不需要 Schema、布局元数据或对应的数据 JSON/);
  assert.match(guide, /不预设固定阶段或文件名/);
});
