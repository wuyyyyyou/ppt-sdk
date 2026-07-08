import assert from "node:assert/strict";
import { test } from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  DEFAULT_FINANCE_ICON_NAME as DEFAULT_CANVAS_ICON_NAME,
  FinanceIcon as CanvasFinanceIcon,
  isFinanceIconName as isCanvasFinanceIconName,
} from "../../src/app/presentation-templates/red-finance-canvas/components/FinanceIcons.tsx";
import {
  DEFAULT_FINANCE_ICON_NAME as DEFAULT_V3_ICON_NAME,
  FinanceIcon as V3FinanceIcon,
  isFinanceIconName as isV3FinanceIconName,
} from "../../src/app/presentation-templates/red-finance-v3/components/FinanceIcons.tsx";

test("red-finance-v3 FinanceIcon falls back for unknown icon names", () => {
  assert.equal(DEFAULT_V3_ICON_NAME, "grid");
  assert.equal(isV3FinanceIconName("grid"), true);
  assert.equal(isV3FinanceIconName("award"), false);

  const fallbackMarkup = renderToStaticMarkup(
    React.createElement(V3FinanceIcon, { name: "award" }),
  );
  const defaultMarkup = renderToStaticMarkup(
    React.createElement(V3FinanceIcon, { name: DEFAULT_V3_ICON_NAME }),
  );

  assert.match(fallbackMarkup, /<svg/);
  assert.equal(fallbackMarkup, defaultMarkup);
});

test("red-finance-canvas FinanceIcon falls back for unknown icon names", () => {
  assert.equal(DEFAULT_CANVAS_ICON_NAME, "grid");
  assert.equal(isCanvasFinanceIconName("grid"), true);
  assert.equal(isCanvasFinanceIconName("award"), false);

  const fallbackMarkup = renderToStaticMarkup(
    React.createElement(CanvasFinanceIcon, { name: "award" }),
  );
  const defaultMarkup = renderToStaticMarkup(
    React.createElement(CanvasFinanceIcon, { name: DEFAULT_CANVAS_ICON_NAME }),
  );

  assert.match(fallbackMarkup, /<svg/);
  assert.equal(fallbackMarkup, defaultMarkup);
});
