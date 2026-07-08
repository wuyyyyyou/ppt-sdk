import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function readJsonObject<T extends object>(filePath: string): Promise<T> {
  const rawText = await readFile(filePath, "utf8");
  let value: unknown;

  try {
    value = JSON.parse(rawText) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse JSON file ${filePath}: ${detail}`);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`JSON file must contain an object: ${filePath}`);
  }

  return value as T;
}

export async function readOptionalJsonObject<T extends object>(
  filePath: string,
): Promise<T | null> {
  try {
    return await readJsonObject<T>(filePath);
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function writeJsonObject(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
