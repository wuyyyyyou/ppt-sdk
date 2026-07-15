# Agent 项目指南

这是本仓库面向 coding agent 的入口说明。旧的 `CLAUDE.md`、`Agent.md`、`AGENT.md` 不再使用。

## 先读这些

- [`CONTEXT.md`](CONTEXT.md)
- [`docs/adr/`](docs/adr/)
- [`ppt-app/README.md`](ppt-app/README.md)
- [`ppt-app/executas/ppt-engine/README.md`](ppt-app/executas/ppt-engine/README.md)
- [`ppt-app/executas/ppt-gener/README.md`](ppt-app/executas/ppt-gener/README.md)

如果 `CONTEXT.md` 或 `docs/adr/` 暂时不存在，静默跳过即可。不要同时创建 `context.md` 和 `CONTEXT.md`；在大小写不敏感文件系统上它们会指向同一路径。

## 仓库概览

当前主线是 [`ppt-app/`](ppt-app/)：把现有 PPT 生成链路包装成可交互的 Anna App 工作台。

相关子项目都收敛在 `ppt-app/executas/` 下：

- [`ppt-app/executas/ppt-engine/`](ppt-app/executas/ppt-engine/)：Authoring Kit 与 Page Source 工作区能力、模板发现、HTML 渲染、PPTX model 转换和任务状态机。
- [`ppt-app/executas/ppt-gener/`](ppt-app/executas/ppt-gener/)：把 `PptxPresentationModel` 写成最终 `.pptx`。
- [`ppt-app/executas/anna-search/`](ppt-app/executas/anna-search/)：Anna App 内置搜索 Executa。

完整链路仍然是：

```text
manifest.json -> deck.html -> ppt-model.json -> .pptx
```

## 当前代码架构

### `ppt-app`

- `src/app/`：应用入口、路由和整体壳子。
- `src/features/`：按业务域切分的功能层，主要有 `deck-workspace`、`outline`、`requirements`、`templates`、`review`、`export`、`task`、`pages`。
- `src/api/`：前端后端适配层，React 页面只通过 `PptBackend` 调用。
- `src/runtime/`：Anna runtime 连接与模式识别。
- `src/ai/`、`src/agent/`：LLM 提示词、解析和 agent 相关逻辑。
- `src/state/`：本地状态管理。

### `ppt-app/executas/ppt-engine`

- `src/app/presentation-templates/`：内置模板、蓝图和主题。
- `src/app/authoring-kit/`：新创作主路径使用的 Foundation Modules、Reference Library 和 Page Source Bootstrap 资源。
- `src/authoring-kit-workspace/`：Authoring Kit 安装、稳定页面标识、Page Source 初始化和最小 manifest 重建。
- `src/app-workspace/`：工作区 artifact 读写和聚合。
- `src/html-to-pptx-model/`：HTML / DOM 到 PPTX model 的抽取与转换。
- `src/render/`：Deck / slide 渲染与运行时 bundle。
- `src/task-state-machine/`：任务状态机、恢复、查询与持久化。
- `src/discovery/`、`src/local-template/`、`src/browser/`、`src/http/`、`src/cli.ts`：发现、本地模板、浏览器渲染、HTTP 和 CLI 入口。

### `ppt-app/executas/ppt-gener`

- `src/presenton_sdk_pptx_generator/`：Python 端的最终 `.pptx` 生成逻辑。
- `example_plugin.py`：Anna Executa 插件入口。

## 关键边界

- React 页面组件只调用 `PptBackend`。
- Anna Runtime / standalone 的差异只放在 adapter 层。
- 工作区文件读写和 gate 判断放在 `ppt-engine` app-facing tools。
- `ppt-gener` 保持单一职责，只生成最终 `.pptx`。
- 前端不能直接读写本地文件系统。
- 不要把前端的 `tools.invoke` 写成插件内部 JSON-RPC envelope。

## Tool ID 不变量

`ppt-app` App manifest 使用 `bundled:<handle>` 引用 Executa，前端只从
`window.__ANNA_TOOL_IDS__` 读取运行时生成的真实 tool id；缺失 sidecar 或 handle
应直接失败，不要回退到 `.env` 或硬编码真实 id。

以下位置必须通过 [`ppt-app/scripts/sync-tool-manifests.mjs`](ppt-app/scripts/sync-tool-manifests.mjs)
保持同步：

- [`ppt-app/manifest.json`](ppt-app/manifest.json) 的 `required_executas[].tool_id`：固定为 `bundled:ppt-engine`、`bundled:ppt-gener`、`bundled:anna-search`
- [`ppt-app/manifest.json`](ppt-app/manifest.json) 的 `required_executas[].min_version`：来自各 Executa manifest 的 `version`
- [`ppt-app/manifest.json`](ppt-app/manifest.json) 的 `ui.host_api.tools`：固定为 `required:bundled:<handle>`
- [`ppt-app/app.json`](ppt-app/app.json) 的 `bundled_executas`
- [`ppt-app/executas/*/executa.json`](ppt-app/executas/) 的真实 `tool_id`
- [`ppt-app/executas/*/executa.json`](ppt-app/executas/) 的发布元数据 `name`、`version`、`description`
- 真实插件 `describe` 返回的 manifest `display_name` 和 `version`

各 Executa 的 `manifest.json` 是 JSON-RPC `describe` 返回的 tool protocol manifest，
不再承载真实 `tool_id`；真实 `tool_id` 只放在对应 `executa.json`。

当前真实 ID：

```text
ppt-engine:  tool-lightvoss-ppt-engine-kqhra9hy
ppt-gener:   tool-lightvoss-ppt-gener-2r765c57
anna-search: tool-lightvoss-anna-search-7ym3jyqv
```

## 开发与运行

- 默认不要自己启动 `npm run dev` 或 `anna-app dev`。
- 一般由用户自己在本机启动 dev server，并打开 `http://localhost:5180/`。
- 如果需要看 UI 或复现 bug，优先用 Chrome DevTools MCP 操作用户已经打开的 `http://localhost:5180/`。
- 如果发现用户没有启动 dev server，就直接提醒用户启动，不要代为拉起。
- 不要重新引入独立 Vite dev server proxy 路径。
- 当前环境无法直接启动 Chrome / Puppeteer；如果必须运行相关渲染或截图测试，需要按提权流程请求用户授权。

`ppt-app` 里常用命令是：

```bash
cd ppt-app && npm run build
cd ppt-app && npm run check
cd ppt-app && npm run validate
cd ppt-app && npm run dev:mock-llm
cd ppt-app && npm run dev:mock-llm:retry
```

`npm run dev` 仍然是正式的本地入口，但只在用户明确要求时配合使用。

`ppt-engine` 里常用命令是：

```bash
cd ppt-app/executas/ppt-engine && npm run build
cd ppt-app/executas/ppt-engine && npm run build:full
cd ppt-app/executas/ppt-engine && npm run check
cd ppt-app/executas/ppt-engine && npm run test:unit
cd ppt-app/executas/ppt-engine && npm run start
cd ppt-app/executas/ppt-engine && npm run start:plugin
```

`ppt-gener` 里常用命令是：

```bash
cd ppt-app/executas/ppt-gener && uv sync
cd ppt-app/executas/ppt-gener && printf '%s\n' '{"jsonrpc":"2.0","method":"describe","id":1}' | uv run --project . python example_plugin.py
```

## 构建与验证顺序

如果改动涉及下游产物，优先按这个顺序：

1. `cd ppt-app/executas/ppt-engine && npm run build`
2. 如果模板预览图变了，再跑 `cd ppt-app/executas/ppt-engine && npm run build:full`
3. `cd ppt-app && npm run build`
4. `cd ppt-app && npm run validate`

如果修改了 `ppt-app/executas/ppt-engine/src/**`，要先重建 engine，因为 `example_plugin.js` 从 `dist/index.js` 导入。

如果改动只在 `ppt-app/src/**`，通常先跑 `npm run check`，再根据需要跑 `npm run build` 或 `npm run validate`。

## 测试

- `ppt-app/executas/ppt-engine/test/**/*.test.ts` 是主要的单测入口，命令是 `npm run test:unit`。
- `ppt-app` 目前主要靠 `npm run check`、`npm run build` 和 `npm run validate` 做回归。
- `ppt-app/executas/ppt-gener` 主要靠插件启动和 `build_binary.sh --test` 做冒烟验证。
- 新增测试时，优先沿用现有目录和命名：`*.test.ts`。

## 模板与预览

- 模板选择器使用静态图片 URL，不使用 data URL。
- 预览图来源：`ppt-app/executas/ppt-engine/dist/template-previews/groups/<group>/*.png`
- 前端同步目标：`ppt-app/public/template-previews/<group>/`
- `ppt-app/scripts/sync-template-previews.mjs` 已接到 `predev` / `prebuild`。
- 普通 `npm run build` 不会重新生成预览图；模板预览变更时用 `npm run build:full`。

## Anna Runtime 与 tool 返回值

- Anna runtime 目前还不能原生理解 `__file_transport` pointer response。
- `ppt-app/executas/ppt-engine/app_stdio.js` 会把 pointer file 内联回 stdout，原生支持 pointer 之前不要删除它。
- 适配器有 1 MB 内联上限。超过上限的 tool response 应返回 URL / path / artifact ID。
- 长期规则：超过约 64 KB 的 tool response 尽量返回引用，不要返回字节本身。

## 常见坑

- `ppt-app/executas/ppt-engine` runtime/SDK 产物采用 ESM-only 构建；路径解析优先使用 `import.meta.url`，不要为这些产物重新引入 CJS 输出兼容。`scripts/sea-bootstrap.cjs` 是 Node SEA 启动器例外，不代表包级 CommonJS 支持。
- GitHub Actions 的 Windows runner 可能把文本文件 checkout 成 CRLF。同步脚本如果解析 `pyproject.toml`、`uv.lock`、manifest 等文本文件，不能把 `\n` 当作唯一换行；要么先归一化行尾，要么用 `\r?\n`，并加 CRLF 回归测试。否则 Windows job 里 `npm run sync:tool-manifests && git diff --exit-code` 会因为误改文件失败。
- Windows release zip 不要依赖 PowerShell `Compress-Archive` 保留空目录。`ppt-engine` 的 Anna Binary archive 需要顶层 `bin/`、`lib/`、`data/`，其中 `lib/`、`data/` 可能为空；Windows zip 打包必须显式创建目录 entry，不能用 placeholder 文件污染包内容。
- Puppeteer 相关命令可能需要本机 Chrome / Chrome for Testing。
- AI agent 编辑 `<workspace>/template/` 里的 TSX 时，不要复用静态图片选择器路径，也不要把未受信任的运行时代码放进 `ppt-app` 自己的 bundle 里渲染。
- `AGENTS.md` 是本仓库 canonical 的 agent guidance；不要把新约束写回别的旧指导文件。

## 术语与文档

- 默认使用中文友好的表达；新增或更新的 markdown 文档，尤其是 `.scratch/` 下的 issue 和 PRD，应尽量使用中文。

issue 和 PRD 放在 `.scratch/` 里的 markdown 文件中。相关说明见：

- [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md)
- [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md)
- [`docs/agents/domain.md`](docs/agents/domain.md)
