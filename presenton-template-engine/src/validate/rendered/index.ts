import type { StabilityRule } from "../types.js";
export {
  collectRenderedSlideInfos,
  DEFAULT_DECK_SELECTOR,
  DEFAULT_SLIDE_SELECTOR,
  disposeRenderedValidationContext,
  prepareRenderedValidationArtifacts,
  prepareRenderedValidationContext,
  waitForDeckRenderReady,
} from "./runtime.js";

export const RENDERED_RULES: StabilityRule[] = [];
