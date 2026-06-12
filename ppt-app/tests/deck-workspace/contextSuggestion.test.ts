import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildContextRowsFromSuggestion,
  mergeSuggestedContextRows,
  normalizeSlideCountContextValue,
  shouldSuggestContextBeforeGeneration,
} from "../../src/features/deck-workspace/contextSuggestion.ts";
import type { ContextRow } from "../../src/features/deck-workspace/types.ts";
import { messages } from "../../src/i18n/messages.ts";

describe("Context Suggestion", () => {
  it("builds context rows from an AI suggestion", () => {
    const rows = buildContextRowsFromSuggestion(
      {
        audience: ["新员工"],
        goal: ["完成入职培训"],
        style: ["简约商务风"],
        theme: ["digital-indigo"],
        slides: "3",
      },
      messages.zh
    );

    assert.deepEqual(rows.map((row) => [row.id, row.value]), [
      ["audience", "新员工"],
      ["goal", "完成入职培训"],
      ["style", "简约商务风"],
      ["theme", "digital-indigo"],
      ["slides", "3"],
    ]);
    assert.equal(rows.find((row) => row.id === "slides")?.allowCustomValue, true);
  });

  it("keeps multiple plausible values as selectable options", () => {
    const rows = buildContextRowsFromSuggestion(
      {
        audience: ["管理层", "业务负责人"],
        goal: [],
        style: [],
        theme: [],
        slides: "auto",
      },
      messages.zh
    );
    const audience = rows.find((row) => row.id === "audience");

    assert.equal(audience?.type, "select");
    assert.deepEqual(audience?.options, ["管理层", "业务负责人"]);
    assert.equal(audience?.allowCustomValue, true);
  });

  it("merges suggested rows by replacing matching ids and appending new rows", () => {
    const currentRows: ContextRow[] = [
      { id: "audience", label: "受众", value: "销售团队" },
      { id: "content", label: "内容", value: "内部材料" },
    ];
    const suggestedRows: ContextRow[] = [
      { id: "audience", label: "受众", value: "新员工" },
      { id: "slides", label: "页数", value: "3" },
    ];

    const rows = mergeSuggestedContextRows(currentRows, suggestedRows);

    assert.deepEqual(rows.map((row) => [row.id, row.value]), [
      ["audience", "新员工"],
      ["content", "内部材料"],
      ["slides", "3"],
    ]);
  });

  it("normalizes invalid slide counts to auto", () => {
    assert.equal(normalizeSlideCountContextValue("3"), "3");
    assert.equal(normalizeSlideCountContextValue("auto"), "auto");
    assert.equal(normalizeSlideCountContextValue("0"), "auto");
    assert.equal(normalizeSlideCountContextValue("3 pages"), "auto");
  });

  it("requires generation-time suggestion only when context rows are empty", () => {
    assert.equal(shouldSuggestContextBeforeGeneration([]), true);
    assert.equal(
      shouldSuggestContextBeforeGeneration([
        { id: "audience", label: "受众", value: "新员工" },
      ]),
      false
    );
  });
});
