import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import CanvasDarkAnalyticsBackdrop from "../../src/app/presentation-templates/chart-analytics-canvas/components/DarkAnalyticsBackdrop.tsx";
import V1DarkAnalyticsBackdrop from "../../src/app/presentation-templates/chart-analytics-v1/components/DarkAnalyticsBackdrop.tsx";

test("chart analytics dark backdrops export as a single background screenshot", () => {
  for (const Component of [CanvasDarkAnalyticsBackdrop, V1DarkAnalyticsBackdrop]) {
    const markup = renderToStaticMarkup(React.createElement(Component, {
      imageUrl: "https://example.com/background.jpg",
    }));

    assert.match(markup, /absolute inset-0/);
  }
});
