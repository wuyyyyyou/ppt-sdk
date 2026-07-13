#!/usr/bin/env node

import { access, readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const PIPELINE_SCRIPT = path.join(REPO_ROOT, "ppt-app", "scripts", "run-ppt-pipeline.mjs");

function usage() {
  return [
    "用法:",
    "  node codex-ppt-runs/scripts/generate-ppt.mjs --workspace <Workspace 路径>",
    "",
    "选项:",
    "  --workspace  必填，包含 template/manifest.json 的 Workspace",
    "  --name       可选，覆盖生成文件使用的演示名称",
    "  --check-only 可选，只检查文件，不运行浏览器和生成器",
    "  --help       显示帮助",
  ].join("\n");
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") return { help: true };
    if (token === "--check-only") {
      result["check-only"] = true;
      continue;
    }
    if (!token.startsWith("--")) throw new Error(`无法识别的参数: ${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`参数 --${key} 缺少值`);
    result[key] = value;
    index += 1;
  }
  return result;
}

async function readJson(filePath, label) {
  let text;
  try {
    text = await readFile(filePath, "utf8");
  } catch {
    throw new Error(`${label} 不存在或不可读: ${filePath}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} 不是有效 JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function assertFile(filePath, label) {
  try {
    await access(filePath);
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("不是文件");
  } catch {
    throw new Error(`${label} 不存在: ${filePath}`);
  }
}

function resolveTemplatePath(templateDir, relativePath, label) {
  if (typeof relativePath !== "string" || !relativePath.startsWith("./")) {
    throw new Error(`${label} 必须是以 ./ 开头的模板相对路径`);
  }
  const resolved = path.resolve(templateDir, relativePath);
  const prefix = `${path.resolve(templateDir)}${path.sep}`;
  if (!resolved.startsWith(prefix)) throw new Error(`${label} 指向模板目录之外: ${relativePath}`);
  return resolved;
}

async function validateWorkspace(workspaceDir) {
  const templateDir = path.join(workspaceDir, "template");
  const manifestPath = path.join(templateDir, "manifest.json");
  const manifest = await readJson(manifestPath, "template/manifest.json");

  if (!Array.isArray(manifest.slides) || manifest.slides.length === 0) {
    throw new Error("template/manifest.json 没有可生成的 slides");
  }

  for (const [index, slide] of manifest.slides.entries()) {
    const sourcePath = slide?.source?.path;
    const dataPath = slide?.data_path;
    if (slide?.source?.type !== "local") {
      throw new Error(`manifest.slides[${index}].source.type 必须是 local`);
    }
    const slideFile = resolveTemplatePath(templateDir, sourcePath, `manifest.slides[${index}].source.path`);
    if (!sourcePath.startsWith("./slides/") || !sourcePath.endsWith(".tsx")) {
      throw new Error(`manifest.slides[${index}] 必须引用 ./slides/*.tsx`);
    }
    await assertFile(slideFile, `第 ${index + 1} 页 TSX`);
    if (dataPath !== undefined && dataPath !== null) {
      const dataFile = resolveTemplatePath(templateDir, dataPath, `manifest.slides[${index}].data_path`);
      if (!dataPath.startsWith("./data/") || !dataPath.endsWith(".json")) {
        throw new Error(`manifest.slides[${index}].data_path 必须引用 ./data/*.json`);
      }
      await assertFile(dataFile, `第 ${index + 1} 页数据`);
    }
  }

  return {
    manifestPath,
    pageCount: manifest.slides.length,
    title: typeof manifest.title === "string" ? manifest.title : path.basename(workspaceDir),
  };
}

async function runPipeline({ workspaceDir, manifestPath, name }) {
  const args = [
    PIPELINE_SCRIPT,
    "generate",
    "--manifest",
    manifestPath,
    "--out-root",
    path.join(workspaceDir, "output", "runs"),
  ];
  if (name) args.push("--name", name);

  const child = spawn(process.execPath, args, {
    cwd: REPO_ROOT,
    env: process.env,
    stdio: "inherit",
  });
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  if (exitCode !== 0) throw new Error(`PPT 生成管线退出，状态码: ${exitCode}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (!options.workspace) throw new Error(`缺少 --workspace\n\n${usage()}`);
  const workspaceDir = path.resolve(process.cwd(), options.workspace);
  const validation = await validateWorkspace(workspaceDir);
  process.stdout.write(`Workspace 检查通过: ${validation.pageCount} 页\n`);
  process.stdout.write(`Manifest: ${validation.manifestPath}\n`);
  if (options["check-only"]) return;
  await runPipeline({
    workspaceDir,
    manifestPath: validation.manifestPath,
    name: options.name || validation.title,
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
