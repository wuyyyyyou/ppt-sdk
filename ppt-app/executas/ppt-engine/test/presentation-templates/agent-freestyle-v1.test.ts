import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

import { templates } from "../../src/app/presentation-templates/generated-registry.ts";
import {
  Schema,
  sampleData,
} from "../../src/app/presentation-templates/agent-freestyle-v1/slides/BlankSlide.tsx";

const templateRoot = new URL(
  "../../src/app/presentation-templates/agent-freestyle-v1/",
  import.meta.url,
);

async function pathExists(relativePath: string) {
  try {
    await access(new URL(relativePath, templateRoot));
    return true;
  } catch {
    return false;
  }
}

test("agent-freestyle-v1 registers only the neutral blank canvas", () => {
  const group = templates.find((item) => item.id === "agent-freestyle-v1");

  assert.ok(group);
  assert.equal(group.layouts.length, 1);
  assert.equal(group.layouts[0]?.layoutId, "agent-freestyle-v1:blank-slide");
  assert.deepEqual(sampleData, {});
  assert.deepEqual(Schema.parse({}), {});
});

test("agent-freestyle-v1 has no blueprint or catalog design layer", async () => {
  assert.equal(await pathExists("blueprints/"), false);
  assert.equal(await pathExists("reference-slides/"), false);
  assert.equal(await pathExists("catalog.json"), false);
});

test("agent-freestyle-v1 exposes only the technical canvas component", async () => {
  const componentFiles = (await readdir(new URL("components/", templateRoot)))
    .filter((entry) => entry.endsWith(".tsx"));

  assert.deepEqual(componentFiles, ["SlideCanvas.tsx"]);

  const slideGuide = await readFile(new URL("slides/README.md", templateRoot), "utf8");
  assert.match(slideGuide, /业务内容、文案和页面结构可以直接写在当前页 TSX 中/);
  assert.match(slideGuide, /不需要创建对应的数据 JSON/);
  assert.match(slideGuide, /只需默认导出一个 React 组件/);
  assert.match(slideGuide, /不使用蓝图/);
});
