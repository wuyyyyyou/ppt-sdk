import path from "node:path";
import { readFile } from "node:fs/promises";

export type ThemeTokenBundle = {
  version: number;
  mode: "light" | "dark";
  colors: Record<string, string>;
  shadows: Record<string, string>;
};

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

async function readJsonFileIfExists(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function camelToKebab(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
    .toLowerCase();
}

function hexToRgb(value: string): string {
  const normalized = value.slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `${red}, ${green}, ${blue}`;
}

function validateTokenRecord(
  value: unknown,
  sourcePath: string,
): ThemeTokenBundle {
  if (!isPlainRecord(value)) {
    throw new Error(`Theme token file must be a JSON object: ${sourcePath}`);
  }

  const version = value.version;
  if (version !== 1) {
    throw new Error(`Theme token file must use version 1: ${sourcePath}`);
  }

  const mode = value.mode;
  if (mode !== "light" && mode !== "dark") {
    throw new Error(`Theme token file mode must be "light" or "dark": ${sourcePath}`);
  }

  if (!isPlainRecord(value.colors)) {
    throw new Error(`Theme token file must contain colors object: ${sourcePath}`);
  }

  if (!isPlainRecord(value.shadows)) {
    throw new Error(`Theme token file must contain shadows object: ${sourcePath}`);
  }

  const colors: Record<string, string> = {};
  for (const [key, color] of Object.entries(value.colors)) {
    if (typeof color !== "string" || !HEX_COLOR_PATTERN.test(color)) {
      throw new Error(`Theme token color "${key}" must be #RRGGBB: ${sourcePath}`);
    }
    colors[key] = color;
  }

  const shadows: Record<string, string> = {};
  for (const [key, shadow] of Object.entries(value.shadows)) {
    if (typeof shadow !== "string" || shadow.trim().length === 0) {
      throw new Error(`Theme token shadow "${key}" must be a non-empty string: ${sourcePath}`);
    }
    shadows[key] = shadow;
  }

  return {
    version,
    mode,
    colors,
    shadows,
  };
}

export async function readThemeTokenBundle(
  templateDir: string,
): Promise<ThemeTokenBundle | null> {
  const tokenPath = path.join(templateDir, "theme", "token.json");
  const defaultTokenPath = path.join(templateDir, "theme", "token.default.json");
  const token = await readJsonFileIfExists(tokenPath);
  if (token !== null) {
    return validateTokenRecord(token, tokenPath);
  }

  const defaultToken = await readJsonFileIfExists(defaultTokenPath);
  if (defaultToken !== null) {
    return validateTokenRecord(defaultToken, defaultTokenPath);
  }

  return null;
}

export function buildThemeTokenCssVariables(
  token: ThemeTokenBundle,
): Record<string, string> {
  const variables: Record<string, string> = {
    "--theme-mode": token.mode,
  };

  for (const [key, value] of Object.entries(token.colors)) {
    const variableName = `--theme-color-${camelToKebab(key)}`;
    variables[variableName] = value;
    variables[`${variableName}-rgb`] = hexToRgb(value);
  }

  for (const [key, value] of Object.entries(token.shadows)) {
    variables[`--theme-shadow-${camelToKebab(key)}`] = value;
  }

  return variables;
}
