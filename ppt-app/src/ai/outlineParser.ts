import type { OutlineDetail } from "../data/mockDeck";
import type { GeneratedOutline } from "./types";
import { parseStructuredJson } from "./structuredJson";

export class OutlineValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(`Invalid outline JSON: ${errors.join("; ")}`);
    this.name = "OutlineValidationError";
  }
}

export function parseOutlineJson(text: string): unknown {
  return parseStructuredJson<unknown>(text);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeNonEmptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateGeneratedOutline(
  value: unknown,
  expectedSlideCount: number | null
): GeneratedOutline {
  void expectedSlideCount;
  const errors: string[] = [];

  if (!isRecord(value)) {
    throw new OutlineValidationError(["root must be a JSON object"]);
  }

  const title = normalizeNonEmptyString(value.title);
  if (!title) {
    errors.push("title must be a non-empty string");
  }

  if (!Array.isArray(value.items)) {
    errors.push("items must be an array");
  }

  const rawItems = Array.isArray(value.items) ? value.items : [];
  if (rawItems.length === 0) {
    errors.push("items must contain at least one page");
  }

  const items: OutlineDetail[] = rawItems.map((item, index) => {
    if (!isRecord(item)) {
      errors.push(`items[${index}] must be an object`);
      return { title: "", outline: "" };
    }

    const keys = Object.keys(item);
    const unsupportedKeys = keys.filter((key) => key !== "title" && key !== "outline");
    if (unsupportedKeys.length > 0) {
      errors.push(`items[${index}] has unsupported fields: ${unsupportedKeys.join(", ")}`);
    }

    const itemTitle = normalizeNonEmptyString(item.title);
    const outline = normalizeNonEmptyString(item.outline);
    if (!itemTitle) {
      errors.push(`items[${index}].title must be a non-empty string`);
    }
    if (!outline) {
      errors.push(`items[${index}].outline must be a non-empty string`);
    }

    return {
      title: itemTitle,
      outline,
    };
  });

  if (errors.length > 0) {
    throw new OutlineValidationError(errors);
  }

  return {
    title,
    items,
  };
}
