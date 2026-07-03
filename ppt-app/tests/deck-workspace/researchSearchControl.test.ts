import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  readResearchSearchControlSettings,
  researchSearchControlSettingsToWorkspaceSettings,
} from "../../src/features/deck-workspace/researchSearchControl.ts";

describe("Research Search Control settings", () => {
  it("defaults missing fields to false and only treats strict true as disabled", () => {
    assert.deepEqual(readResearchSearchControlSettings({}), {
      disableWebResearch: false,
      disableImageResearch: false,
    });
    assert.deepEqual(readResearchSearchControlSettings({
      disable_web_research: "true",
      disable_image_research: 1,
    }), {
      disableWebResearch: false,
      disableImageResearch: false,
    });
    assert.deepEqual(readResearchSearchControlSettings({
      disable_web_research: true,
      disable_image_research: true,
    }), {
      disableWebResearch: true,
      disableImageResearch: true,
    });
  });

  it("writes the confirmed workspace setting field names", () => {
    assert.deepEqual(researchSearchControlSettingsToWorkspaceSettings({
      disableWebResearch: true,
      disableImageResearch: false,
    }), {
      disable_web_research: true,
      disable_image_research: false,
    });
  });
});
