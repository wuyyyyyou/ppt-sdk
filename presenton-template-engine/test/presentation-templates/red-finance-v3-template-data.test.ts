import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import ChartWithNarrative, {
  Schema as ChartWithNarrativeSchema,
} from "../../src/app/presentation-templates/red-finance-v3/blueprints/ChartWithNarrative.tsx";

const demoDataPath = new URL(
  "../../src/app/presentation-templates/red-finance-v3/data/demo/chart-with-narrative.json",
  import.meta.url,
);

function readDemoData() {
  return JSON.parse(readFileSync(demoDataPath, "utf8")) as Record<string, unknown>;
}

test("red-finance-v3 blueprints treat Schema as an advisory data contract by default", () => {
  const invalidData = {
    ...readDemoData(),
    title: "x",
  };

  assert.throws(() => ChartWithNarrativeSchema.parse(invalidData));
  assert.doesNotThrow(() => ChartWithNarrative({ data: invalidData }));
});

test("chart-with-narrative defaults chart values to plain numbers", () => {
  assert.equal(ChartWithNarrativeSchema.parse({}).valueFormat, "number");
  assert.equal(ChartWithNarrativeSchema.parse({ valueFormat: "percent" }).valueFormat, "percent");
  assert.throws(() => ChartWithNarrativeSchema.parse({ valueFormat: "currency" }));
});
