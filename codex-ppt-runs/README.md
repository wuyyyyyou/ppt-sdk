# Codex PPT 实验工作区

这个目录用于在一个 Codex 对话内完成一份 PPT，复用 `ppt-app` 的 HTML 渲染和 PPTX 生成能力，但不依赖 Anna 平台的模型。

当前处于 freestyle Demo（自由创作演示验证）阶段。流程尚未固化，不读取预设 prompts；每个阶段由用户在对话中确认后再继续。Workspace 默认使用 `agent-freestyle-v2`，提供自由画布、少量技术基础组件和参考组件源码。

## 新对话入口

在新对话中，把下面这段话和具体需求一起交给 Codex：

> 请阅读仓库根目录的 `AGENTS.md`、`CONTEXT.md`、`codex-ppt-runs/README.md` 和本次 Workspace。这是自由画布 PPT 视觉质量实验：不要使用蓝图，不以组件复用为目标，不要自行推进到下一阶段。每个阶段完成后先等待用户确认。不要启动 dev server，不要修改内置模板源码；所有改动必须发生在本次 `codex-ppt-runs/workspace/ppt-<datetime>/` 中。

## 工作原则

- 一份 PPT 使用一个对话和一个独立 Workspace（工作空间）。
- 默认使用 `agent-freestyle-v2` 创建 freestyle Workspace，不使用设计蓝图；也可以通过 `--template agent-freestyle-v1` 继续创建纯空白画布实验。
- 内置模板只用于 fork（复制派生），不得直接修改。
- 最终页面只落在 `template/slides/*.tsx`。
- 业务内容和页面结构直接写在 TSX，不需要对应的数据 JSON、Schema 或布局元数据导出。
- `template/theme.ts` 记录本次演示使用的精确基础参数；其他过程文档由用户和 Agent 按需创建。
- `template/components/` 是可直接复用的技术基础组件；`template/reference-components/` 只提供实现参考，不是固定布局或必选组件。
- 事实资料和图片需求应保存到 Workspace，不能只留在聊天上下文中。
- 图片只能作为视觉素材；图片中出现的文字和数字不能自动作为事实依据。
- 不编造事实、数字、日期、来源或看起来真实的占位数据。
- 当前实验不包含自动截图检查和自动返修；用户会手动检查每轮产物。

## 当前流程

### 1. 创建 Workspace

```bash
node codex-ppt-runs/scripts/create-workspace.mjs \
  --mode freestyle \
  --title "演示文稿标题"
```

脚本默认创建：

```text
codex-ppt-runs/workspace/ppt-YYYYMMDD-HHmmss/
```

### 2. 自由创作与按需记录

用户和 Agent 可以根据具体实验自由决定创作过程。需要保留需求、大纲、事实、Art Direction（艺术方向）、Visual Page Plan（视觉页面计划）或图片需求时，再在 Workspace 中创建合适的文档；这些过程文档没有固定文件名或格式，也不是生成 PPT 的前置条件。

### 3. 生成 HTML 和 PPTX

```bash
node codex-ppt-runs/scripts/generate-ppt.mjs \
  --workspace codex-ppt-runs/workspace/ppt-YYYYMMDD-HHmmss
```

输出保存在该 Workspace 的 `output/runs/` 下，包括 Deck HTML、PPTX Model JSON、PPTX、日志和运行摘要。脚本会在调用引擎前检查 manifest 引用、页面数量和必要文件。

## Workspace 目录

```text
ppt-YYYYMMDD-HHmmss/
├── INSTRUCTIONS.md
├── workspace.json
├── review/
├── template/
│   ├── manifest.json
│   ├── components/
│   ├── slides/
│   └── theme.ts
└── output/
```

创建 Workspace 时不预建过程文档。不要把不同 PPT 的资料或页面混入同一个 Workspace。
