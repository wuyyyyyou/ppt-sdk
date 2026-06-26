import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TemplateSummary } from "../../src/api/types.ts";
import {
  filterSelectableTemplates,
  isSelectableTemplateGroup,
} from "../../src/features/deck-workspace/templateSelectionPolicy.ts";

function makeTemplate(groupId: string): TemplateSummary {
  return {
    group_id: groupId,
    group_name: groupId,
    group_description: "",
    ordered: true,
    default: false,
    layout_count: 1,
    preview: null,
    previews: [],
  };
}

describe("Template selection policy", () => {
  it("allows only the first-stage selectable template groups", () => {
    assert.equal(isSelectableTemplateGroup("red-finance-canvas"), true);
    assert.equal(isSelectableTemplateGroup("red-finance-v3"), true);
    assert.equal(isSelectableTemplateGroup("legacy-hidden-template"), false);
  });

  it("filters hidden templates from the selectable list", () => {
    const templates = [
      makeTemplate("red-finance-canvas"),
      makeTemplate("red-finance-v3"),
      makeTemplate("legacy-hidden-template"),
    ];

    assert.deepEqual(
      filterSelectableTemplates(templates).map((template) => template.group_id),
      ["red-finance-canvas", "red-finance-v3"],
    );
  });
});
