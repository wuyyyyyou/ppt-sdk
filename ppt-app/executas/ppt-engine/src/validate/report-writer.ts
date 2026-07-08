import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import type { ValidationReport } from "./types.js";

export interface PersistedValidationReport extends ValidationReport {
  generatedAt: string;
  manifestPath?: string | null;
  name?: string | null;
}

export async function writeValidationReport(input: {
  report: ValidationReport;
  outputPath: string;
  manifestPath?: string | null;
  name?: string | null;
}): Promise<{
  outputPath: string;
  report: PersistedValidationReport;
}> {
  const persistedReport: PersistedValidationReport = {
    ...input.report,
    generatedAt: new Date().toISOString(),
    manifestPath: input.manifestPath ?? null,
    name: input.name ?? null,
  };

  await mkdir(path.dirname(input.outputPath), { recursive: true });
  await writeFile(
    input.outputPath,
    `${JSON.stringify(persistedReport, null, 2)}\n`,
    "utf8",
  );

  return {
    outputPath: input.outputPath,
    report: persistedReport,
  };
}
