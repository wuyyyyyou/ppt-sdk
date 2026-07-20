import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertLocalTemplateTypecheck } from "../src/local-template/typecheck.js";
import { resolveLocalTemplateProjectRoot } from "../src/local-template/loader.js";
import {
  buildPageSourcePreview,
  resolvePageSourcePreviewName,
} from "../src/render/build-page-source-preview.js";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type ParsedArguments = {
  entryPath: string;
  generatePptx: boolean;
  jsonOutput: boolean;
  name: string | null;
  outputDir: string | null;
};

function readOptionValue(argument: string, optionName: string): string | null {
  const prefix = `${optionName}=`;
  return argument.startsWith(prefix) ? argument.slice(prefix.length) : null;
}

function parseArguments(argv: string[]): ParsedArguments {
  let entryPath: string | null = null;
  let generatePptx = false;
  let jsonOutput = false;
  let name: string | null = null;
  let outputDir: string | null = null;

  for (const argument of argv) {
    if (argument === "--pptx") {
      generatePptx = true;
      continue;
    }
    if (argument === "--json") {
      jsonOutput = true;
      continue;
    }
    const outputValue = readOptionValue(argument, "--output");
    if (outputValue !== null) {
      if (!outputValue || !path.isAbsolute(outputValue)) {
        throw new Error("--output must be a non-empty absolute path");
      }
      outputDir = path.normalize(outputValue);
      continue;
    }
    const nameValue = readOptionValue(argument, "--name");
    if (nameValue !== null) {
      if (!nameValue.trim()) {
        throw new Error("--name must be a non-empty string");
      }
      name = nameValue;
      continue;
    }
    if (argument.startsWith("--")) {
      throw new Error(`Unsupported option: ${argument}`);
    }
    if (entryPath) {
      throw new Error(`Unexpected additional Preview Source path: ${argument}`);
    }
    entryPath = path.resolve(process.cwd(), argument);
  }

  if (!entryPath) {
    throw new Error(
      "Usage: npm run preview:tsx -- <preview-source> [--pptx] [--json] [--name=<name>] [--output=<absolute-path>]",
    );
  }

  return { entryPath, generatePptx, jsonOutput, name, outputDir };
}

async function main() {
  const parsed = parseArguments(process.argv.slice(2));
  const name = resolvePageSourcePreviewName(parsed.entryPath, parsed.name);
  const outputDir = parsed.outputDir ?? path.join(projectDir, ".preview-output", name);
  const projectRoot = await resolveLocalTemplateProjectRoot(parsed.entryPath);

  await assertLocalTemplateTypecheck({
    entryPath: parsed.entryPath,
    cwd: projectRoot,
    label: `Preview Source "${path.relative(projectRoot, parsed.entryPath)}"`,
  });
  const result = await buildPageSourcePreview({
    entryPath: parsed.entryPath,
    outputDir,
    name,
    generatePptx: parsed.generatePptx,
  });

  if (parsed.jsonOutput) {
    process.stdout.write(`${JSON.stringify({
      entry_path: result.entryPath,
      output_dir: result.outputDir,
      name: result.name,
      html_path: result.htmlPath,
      browser_png_path: result.screenshotPath,
      pptx_path: result.pptxPath,
    })}\n`);
    return;
  }

  const lines = [
    "Page Source preview generated:",
    `HTML: ${result.htmlPath}`,
    `PNG: ${result.screenshotPath}`,
    result.pptxPath ? `PPTX: ${result.pptxPath}` : "PPTX: not requested",
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

await main();
