import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PanelHeader } from "../../src/features/deck-workspace/components/PanelHeader.tsx";
import { messages } from "../../src/i18n/messages.ts";

describe("PanelHeader", () => {
  it("removes minimize and close controls", () => {
    const html = renderToStaticMarkup(
      createElement(PanelHeader, {
        t: messages.zh,
        locale: "zh",
        setLocale: () => undefined,
        status: "草稿已就绪",
        onLibrary: () => undefined,
      }),
    );

    assert.doesNotMatch(html, /title="最小化"/);
    assert.doesNotMatch(html, /title="关闭"/);
  });
});
