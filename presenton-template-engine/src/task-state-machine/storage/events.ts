import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { TaskStateMachineEventRecord } from "../types.js";

export async function appendEventRecord(
  filePath: string,
  record: TaskStateMachineEventRecord,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
}

export async function readEventRecords(filePath: string): Promise<TaskStateMachineEventRecord[]> {
  let rawText = "";
  try {
    rawText = await readFile(filePath, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
  const records: TaskStateMachineEventRecord[] = [];

  for (const line of rawText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      continue;
    }

    records.push(parsed as TaskStateMachineEventRecord);
  }

  return records;
}
