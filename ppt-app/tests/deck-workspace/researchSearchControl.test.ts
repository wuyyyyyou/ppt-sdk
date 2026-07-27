import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ResearchSearchControlSwitches } from "../../src/features/deck-workspace/components/ResearchSearchControlSwitches.tsx";
import {
  readResearchSearchControlSettings,
  researchSearchControlSettingsToWorkspaceSettings,
} from "../../src/features/deck-workspace/researchSearchControl.ts";
import { messages } from "../../src/i18n/messages.ts";

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

  it("renders both localized switches with their current checked state", () => {
    const html = renderToStaticMarkup(createElement(ResearchSearchControlSwitches, {
      t: messages.zh,
      settings: {
        disableWebResearch: true,
        disableImageResearch: false,
      },
      onChange: () => undefined,
    }));

    assert.match(html, /aria-checked="true"[^>]*>[\s\S]*?禁止网络资料搜索/);
    assert.match(html, /aria-checked="false"[^>]*>[\s\S]*?禁止图片搜索/);
    assert.doesNotMatch(html, /role="dialog"/);
  });
});
