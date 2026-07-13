#!/usr/bin/env node

import { access, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(RUNS_DIR, "..");
const DEFAULT_WORKSPACE_ROOT = path.join(RUNS_DIR, "workspace");
const ENGINE_ENTRY = path.join(REPO_ROOT, "ppt-app", "executas", "ppt-engine", "dist", "index.js");
const DEFAULT_FREESTYLE_TEMPLATE_GROUP = "agent-freestyle-v2";
const FREESTYLE_TEMPLATE_GROUPS = new Set([
  "agent-freestyle-v1",
  "agent-freestyle-v2",
]);
const AUTHORING_MODES = new Set(["template", "freestyle"]);

function usage() {
  return [
    "用法:",
    "  node codex-ppt-runs/scripts/create-workspace.mjs --template <模板组 id> --title <标题>",
    "  node codex-ppt-runs/scripts/create-workspace.mjs --mode freestyle --title <标题>",
    "",
    "选项:",
    `  --template        模板组 id；freestyle 模式默认 ${DEFAULT_FREESTYLE_TEMPLATE_GROUP}`,
    "  --mode            可选，template 或 freestyle",
    "  --title           可选，默认使用 Workspace 名称",
    "  --workspace-root  可选，Workspace 父目录",
    "  --help            显示帮助",
  ].join("\n");
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") return { help: true };
    if (!token.startsWith("--")) throw new Error(`无法识别的参数: ${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`参数 --${key} 缺少值`);
    result[key] = value;
    index += 1;
  }
  return result;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function workspaceId(date) {
  return `ppt-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureEmptyTarget(targetPath) {
  if (!(await exists(targetPath))) return;
  const entries = await readdir(targetPath);
  if (entries.length > 0) throw new Error(`目标 Workspace 已存在且非空: ${targetPath}`);
}

async function writeJson(targetPath, value) {
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function resolveAuthoringMode(options) {
  const requestedMode = options.mode?.trim();
  if (requestedMode && !AUTHORING_MODES.has(requestedMode)) {
    throw new Error(`--mode 只支持 template 或 freestyle，收到: ${requestedMode}`);
  }

  if (requestedMode) return requestedMode;
  return FREESTYLE_TEMPLATE_GROUPS.has(options.template) ? "freestyle" : "template";
}

function resolveTemplateGroup(options, authoringMode) {
  if (options.template?.trim()) return options.template.trim();
  if (authoringMode === "freestyle") return DEFAULT_FREESTYLE_TEMPLATE_GROUP;
  throw new Error(`缺少 --template\n\n${usage()}`);
}

async function initializeTemplateWorkspace(workspaceDir) {
  await mkdir(path.join(workspaceDir, "review"), { recursive: true });
  await writeFile(
    path.join(workspaceDir, "INSTRUCTIONS.md"),
    [
      "# Workspace Instructions",
      "",
      "这是一个基于现有模板生成 PPT 的独立 Workspace。",
      "",
      "- 只能修改当前 Workspace 内的文件。",
      "- 不修改 `ppt-engine`、内置模板、`codex-ppt-runs` 脚本或其他 Workspace。",
      "- 根据与用户的讨论按需创建过程文档，不预设固定阶段、文件名或格式。",
      "- 最终页面通过 `template/manifest.json` 注册。",
      "- 首轮页面生成完成后停止，等待用户检查，不自动返修。",
      "",
    ].join("\n"),
    "utf8",
  );
}

async function initializeFreestyleWorkspace(workspaceDir, title, templateGroup) {
  const hasReferenceComponents = templateGroup === "agent-freestyle-v2";
  await mkdir(path.join(workspaceDir, "review"), { recursive: true });
  await writeFile(
    path.join(workspaceDir, "INSTRUCTIONS.md"),
    [
      "# Workspace Instructions",
      "",
      "这是一个使用 TSX 自由画布生成 PPT 的独立 Workspace。",
      "",
      "## 工作范围",
      "",
      "- 只能修改当前 Workspace 内的文件。",
      "- 不修改 `ppt-engine`、内置模板、`codex-ppt-runs` 脚本或其他 Workspace。",
      "- 不需要主动研究整个 `ppt-app` 或阅读其他演示模板。",
      "- 每个阶段完成后等待用户确认，不自行推进到下一阶段。",
      "",
      "## 页面实现",
      "",
      "- 页面固定为 `1280x720`，不得滚动或依赖交互。",
      "- 最终页面位于 `template/slides/*.tsx`。",
      "- 不使用蓝图，不需要选择预定义布局族。",
      "- 业务内容、文案和页面结构直接写入当前页 TSX，不需要创建 `template/data/*.json`。",
      "- 页面通过 `template/manifest.json` 注册，Manifest 只引用最终页面。",
      "- 使用 `template/components/SlideCanvas.tsx` 作为基础画布。",
      ...(hasReferenceComponents
        ? [
            "- `template/components/` 提供可直接复用的技术基础组件；按需使用，不要求每页使用。",
            "- `template/reference-components/` 是构图与实现参考，不是必须套用的页面模板。",
          ]
        : []),
      "- `template/theme.ts` 保存本次演示跨页共享的精确基础参数。",
      "",
      "## 页面导出契约",
      "",
      "每个最终页面只需默认导出一个 React 组件。",
      "",
      "关键标题、正文、数字和标签应尽量保留为真实 DOM 文本。复杂图表或图形区域可以使用 `data-pptx-export=\"screenshot\"`，外围解释文字仍保持为 DOM 文本。",
      "",
      "## 设计边界",
      "",
      "- 不以组件复用率作为质量目标。",
      "- 不默认使用卡片、固定页眉、统一内容框架或 Dashboard（仪表盘）布局。",
      "- 不得因实现困难，将已确认的地图、时间线、信息图或编辑式构图退化为通用列表或卡片网格。",
      "- 只有真正跨页重复且视觉语义相同的元素，才适合抽取为共享组件。",
      "- 不编造事实、数字、日期、来源或看起来真实的占位数据。",
      "",
      "## 创作过程",
      "",
      "- 不预设固定的创作阶段或过程文档。",
      "- 根据与用户的讨论，按需创建需求、大纲、事实、视觉方向、图片需求或其他记录。",
      "- 过程文档的文件名和格式由当前任务决定，不是生成 PPT 的前置条件。",
      "- 首轮页面生成完成后停止，等待用户检查，不自动返修。",
      "",
      "## 检查与生成",
      "",
      "只检查 Workspace 文件：",
      "",
      "```bash",
      `node codex-ppt-runs/scripts/generate-ppt.mjs --workspace ${workspaceDir} --check-only`,
      "```",
      "",
      "生成 HTML、页面截图、PPTX Model 和最终 PPTX：",
      "",
      "```bash",
      `node codex-ppt-runs/scripts/generate-ppt.mjs --workspace ${workspaceDir}`,
      "```",
      "",
    ].join("\n"),
    "utf8",
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const authoringMode = resolveAuthoringMode(options);
  const templateGroup = resolveTemplateGroup(options, authoringMode);
  if (authoringMode === "freestyle" && !FREESTYLE_TEMPLATE_GROUPS.has(templateGroup)) {
    throw new Error(
      `freestyle 模式支持 ${Array.from(FREESTYLE_TEMPLATE_GROUPS).join("、")}，收到: ${templateGroup}`,
    );
  }
  if (!(await exists(ENGINE_ENTRY))) {
    throw new Error("ppt-engine 尚未构建。请先运行: cd ppt-app/executas/ppt-engine && npm run build");
  }

  const root = options["workspace-root"]
    ? path.resolve(process.cwd(), options["workspace-root"])
    : DEFAULT_WORKSPACE_ROOT;
  const id = workspaceId(new Date());
  const workspaceDir = path.join(root, id);
  const templateDir = path.join(workspaceDir, "template");
  const title = options.title?.trim() || id;

  await ensureEmptyTarget(workspaceDir);
  await mkdir(path.join(workspaceDir, "output"), { recursive: true });

  const { forkTemplateGroup } = await import(ENGINE_ENTRY);
  const fork = await forkTemplateGroup({
    templateGroup,
    outDir: templateDir,
    manifestTitle: title,
    overwrite: false,
  });

  if (authoringMode === "freestyle") {
    await initializeFreestyleWorkspace(workspaceDir, title, templateGroup);
  } else {
    await initializeTemplateWorkspace(workspaceDir);
  }
  await writeJson(path.join(workspaceDir, "workspace.json"), {
    version: 1,
    workspace_id: id,
    title,
    authoring_mode: authoringMode,
    template_group: templateGroup,
    workspace_dir: workspaceDir,
    template_dir: templateDir,
    manifest_path: fork.manifestPath,
    created_at: new Date().toISOString(),
  });

  process.stdout.write(`Workspace 已创建:\n${workspaceDir}\n`);
  process.stdout.write(`创作模式: ${authoringMode}\n`);
  process.stdout.write(`模板: ${templateGroup}\n`);
  process.stdout.write(`Manifest: ${fork.manifestPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
