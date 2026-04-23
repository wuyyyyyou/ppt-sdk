import type { DeckManifestInput } from "../render/types.js";
import type { ValidationContext } from "./types.js";

type SinglePageSelectionInput = Pick<ValidationContext, "singlePage" | "page">;

export function resolveValidationSinglePageIndex(
  input: SinglePageSelectionInput,
  slideCount: number,
): number | null {
  if (!input.singlePage) {
    return null;
  }

  if (input.page === undefined || input.page === null) {
    throw new Error('Field "page" is required when "singlePage" is true');
  }

  if (!Number.isInteger(input.page)) {
    throw new Error('Field "page" must be an integer');
  }

  if (slideCount <= 0) {
    return null;
  }

  if (input.page < 1 || input.page > slideCount) {
    throw new Error(`Field "page" must be between 1 and ${slideCount}`);
  }

  return input.page - 1;
}

export function selectManifestSlidesForValidation(
  manifest: DeckManifestInput,
  input: SinglePageSelectionInput,
): DeckManifestInput {
  if (!Array.isArray(manifest.slides) || manifest.slides.length === 0) {
    return manifest;
  }

  const selectedIndex = resolveValidationSinglePageIndex(input, manifest.slides.length);
  if (selectedIndex === null) {
    return manifest;
  }

  return {
    ...manifest,
    slides: [manifest.slides[selectedIndex]!],
  };
}

export function selectCollectionPageForValidation<T>(
  items: T[],
  input: SinglePageSelectionInput,
): T[] {
  const selectedIndex = resolveValidationSinglePageIndex(input, items.length);
  if (selectedIndex === null) {
    return items;
  }

  return [items[selectedIndex]!];
}
