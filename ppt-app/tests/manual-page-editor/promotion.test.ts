import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasLayoutAffectingTransform,
  isAbsoluteContainingBlock,
  measureAccumulatedScale,
  planAbsolutePromotion,
  type ContainingBlockStyle,
  type PromotionGeometry,
  type PromotionStyle,
} from "../../src/features/manual-page-editor/manualPageEditorPromotion";

function geometry(overrides: Partial<PromotionGeometry> = {}): PromotionGeometry {
  return {
    rect: { left: 300, top: 200, width: 400, height: 120 },
    parentRect: { left: 100, top: 150 },
    parentScrollLeft: 0,
    parentScrollTop: 0,
    parentBorderLeft: 0,
    parentBorderTop: 0,
    ...overrides,
  };
}

function style(overrides: Partial<PromotionStyle> = {}): PromotionStyle {
  return {
    flex: "0 1 auto",
    gridArea: "",
    marginTop: "0px",
    marginRight: "0px",
    marginBottom: "0px",
    marginLeft: "0px",
    ...overrides,
  };
}

function containingBlock(overrides: Partial<ContainingBlockStyle> = {}): ContainingBlockStyle {
  return {
    position: "static",
    transform: "none",
    perspective: "none",
    filter: "none",
    contain: "none",
    ...overrides,
  };
}

describe("absolute promotion plan", () => {
  it("places the element where it was rendered inside its parent", () => {
    const plan = planAbsolutePromotion(geometry(), style());

    assert.equal(plan.element.left, "200px");
    assert.equal(plan.element.top, "50px");
    assert.equal(plan.element.width, "400px");
    assert.equal(plan.element.height, "120px");
    assert.equal(plan.element.position, "absolute");
  });

  it("keeps the space the element used to reserve, margins included", () => {
    // A bullet row spaced by margin-bottom would otherwise let every following
    // sibling slide up by that margin the moment it is moved.
    const plan = planAbsolutePromotion(
      geometry(),
      style({ marginBottom: "13px", marginTop: "4px", marginLeft: "8px" }),
    );

    assert.equal(plan.placeholder.width, "400px");
    assert.equal(plan.placeholder.height, "120px");
    assert.equal(plan.placeholder.marginBottom, "13px");
    assert.equal(plan.placeholder.marginTop, "4px");
    assert.equal(plan.placeholder.marginLeft, "8px");
    assert.equal(plan.placeholder.visibility, "hidden");
    assert.equal(plan.placeholder.pointerEvents, "none");
  });

  it("stops the moved element from paying its margins twice", () => {
    const plan = planAbsolutePromotion(geometry(), style({ marginBottom: "13px" }));

    assert.equal(plan.element.margin, "0");
  });

  it("measures both boxes as border boxes", () => {
    const plan = planAbsolutePromotion(geometry(), style());

    assert.equal(plan.placeholder.boxSizing, "border-box");
    assert.equal(plan.element.boxSizing, "border-box");
  });

  it("discounts the parent border, which sits outside the offset origin", () => {
    const plan = planAbsolutePromotion(
      geometry({ parentBorderLeft: 5, parentBorderTop: 3 }),
      style(),
    );

    assert.equal(plan.element.left, "195px");
    assert.equal(plan.element.top, "47px");
  });

  it("follows a scrolled parent", () => {
    const plan = planAbsolutePromotion(
      geometry({ parentScrollLeft: 40, parentScrollTop: 12 }),
      style(),
    );

    assert.equal(plan.element.left, "240px");
    assert.equal(plan.element.top, "62px");
  });

  it("carries flex and grid participation onto the placeholder", () => {
    const flexPlan = planAbsolutePromotion(geometry(), style({ flex: "1 1 0%" }));
    const gridPlan = planAbsolutePromotion(geometry(), style({ gridArea: "2 / 1 / 3 / 2" }));

    assert.equal(flexPlan.placeholder.flex, "1 1 0%");
    assert.equal(gridPlan.placeholder.gridArea, "2 / 1 / 3 / 2");
    assert.ok(!("gridArea" in flexPlan.placeholder));
  });
});

describe("containing block detection", () => {
  it("treats any positioned parent as the offset origin", () => {
    assert.equal(isAbsoluteContainingBlock(containingBlock({ position: "relative" })), true);
    assert.equal(isAbsoluteContainingBlock(containingBlock({ position: "absolute" })), true);
    assert.equal(isAbsoluteContainingBlock(containingBlock({ position: "sticky" })), true);
  });

  it("also recognises the parents that establish one without being positioned", () => {
    assert.equal(isAbsoluteContainingBlock(containingBlock({ transform: "matrix(1, 0, 0, 1, 4, 0)" })), true);
    assert.equal(isAbsoluteContainingBlock(containingBlock({ perspective: "400px" })), true);
    assert.equal(isAbsoluteContainingBlock(containingBlock({ filter: "blur(2px)" })), true);
    assert.equal(isAbsoluteContainingBlock(containingBlock({ contain: "layout paint" })), true);
  });

  // A relative element used to be promoted without ever fixing its parent, so
  // its offsets resolved against a far ancestor and it jumped on first drag.
  it("asks a plain static parent to become the origin", () => {
    assert.equal(isAbsoluteContainingBlock(containingBlock()), false);
    assert.equal(isAbsoluteContainingBlock(undefined), false);
  });
});

describe("scaled ancestors", () => {
  it("converts client rects back into the parent's own coordinate space", () => {
    // A parent scaled to 50% reports half-size client rects, but inline offsets
    // are still written in unscaled pixels.
    const plan = planAbsolutePromotion(
      geometry({
        rect: { left: 300, top: 200, width: 200, height: 60 },
        parentRect: { left: 100, top: 150 },
        parentScaleX: 0.5,
        parentScaleY: 0.5,
      }),
      style(),
    );

    assert.equal(plan.element.left, "400px");
    assert.equal(plan.element.top, "100px");
    assert.equal(plan.element.width, "400px");
    assert.equal(plan.element.height, "120px");
    assert.equal(plan.placeholder.width, "400px");
  });

  it("falls back to 1 for a missing or nonsense scale", () => {
    for (const scale of [undefined, 0, Number.NaN, -2]) {
      const plan = planAbsolutePromotion(
        geometry({ parentScaleX: scale, parentScaleY: scale }),
        style(),
      );
      assert.equal(plan.element.left, "200px");
      assert.equal(plan.element.width, "400px");
    }
  });

  it("reads the accumulated scale off the painted versus layout box", () => {
    const scaled = { offsetWidth: 400, offsetHeight: 200 } as HTMLElement;

    assert.deepEqual(measureAccumulatedScale(scaled, { width: 300, height: 50 }), { x: 0.75, y: 0.25 });
    assert.deepEqual(
      measureAccumulatedScale({ offsetWidth: 0, offsetHeight: 0 } as HTMLElement, { width: 10, height: 10 }),
      { x: 1, y: 1 },
    );
  });
});

describe("transform aware measurement", () => {
  it("only pays for a second measurement when a transform is in play", () => {
    assert.equal(hasLayoutAffectingTransform("none"), false);
    assert.equal(hasLayoutAffectingTransform(undefined), false);
    assert.equal(hasLayoutAffectingTransform(""), false);
    assert.equal(hasLayoutAffectingTransform("matrix(1, 0, 0, 1, -50, -50)"), true);
  });
});
