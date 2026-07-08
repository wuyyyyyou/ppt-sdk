import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { templates } from "../../src/app/presentation-templates/generated-registry.ts";
import {
  Schema as ContentCanvasSchema,
  sampleData as contentCanvasSampleData,
} from "../../src/app/presentation-templates/red-finance-canvas/blueprints/ContentCanvas.tsx";

const componentsReadmePath = new URL(
  "../../src/app/presentation-templates/red-finance-canvas/components/README.md",
  import.meta.url,
);

test("red-finance-canvas registers three component-first canvas layouts", () => {
  const group = templates.find((item) => item.id === "red-finance-canvas");

  assert.ok(group);
  assert.equal(group.settings.coverLayoutId, "red-finance-canvas:cover-canvas");
  assert.equal(group.settings.closingLayoutId, undefined);
  assert.deepEqual(
    group.layouts.map((layout) => layout.layoutId),
    [
      "red-finance-canvas:cover-canvas",
      "red-finance-canvas:content-canvas",
      "red-finance-canvas:section-focus-canvas",
    ],
  );
  assert.deepEqual(
    group.layouts.map((layout) => layout.layoutRole),
    ["cover", "content", "section-divider"],
  );
});

test("red-finance-canvas content canvas defaults to visible slot guidance", () => {
  assert.deepEqual(contentCanvasSampleData, ContentCanvasSchema.parse({}));
  assert.equal(contentCanvasSampleData.showSlotGuides, true);
  assert.match(contentCanvasSampleData.guideText, /components\/README\.md/);
});

test("red-finance-canvas component index describes canvas-specific workflow", () => {
  const readme = readFileSync(componentsReadmePath, "utf8");

  assert.match(readme, /red-finance-canvas/);
  assert.match(readme, /ContentCanvas\.tsx/);
  assert.match(readme, /slot guide/);
});

test("red-finance-canvas catalog blueprint sources point to blueprints", () => {
  const catalog = JSON.parse(
    readFileSync(
      new URL("../../src/app/presentation-templates/red-finance-canvas/catalog.json", import.meta.url),
      "utf8",
    ),
  ) as { blueprints: Array<{ blueprint_source: string }> };

  assert.deepEqual(
    catalog.blueprints.map((blueprint) => blueprint.blueprint_source),
    [
      "./blueprints/CoverCanvas.tsx",
      "./blueprints/ContentCanvas.tsx",
      "./blueprints/SectionFocusCanvas.tsx",
    ],
  );
});
