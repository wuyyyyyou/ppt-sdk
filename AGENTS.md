# Agent 项目指南

这是本仓库面向 coding agent 的通用入口。旧的 `CLAUDE.md`、`Agent.md` 和 `AGENT.md` 不再使用。

本文件只保留稳定约束、入口路径和容易踩坑的规则。具体实现状态以代码、README 和相关 docs 为准。

## Agent skills

### Issue tracker

这个仓库的 issue 和 PRD 放在 `.scratch/` 里的 markdown 文件中。见 `docs/agents/issue-tracker.md`。

### Triage labels

五个标准 triage 角色和默认标签名一一对应。见 `docs/agents/triage-labels.md`。

### Domain docs

这是一个单上下文仓库，根目录下放 `CONTEXT.md` 和 `docs/adr/`。见 `docs/agents/domain.md`。

如果 `CONTEXT.md` 暂时不存在，静默跳过即可。不要同时创建 `context.md` 和 `CONTEXT.md`；在大小写不敏感文件系统上它们会指向同一路径。

## 当前开发重点

当前重点是 [`ppt-app/`](ppt-app/)：把现有 PPT 生成工具链包装成可交互 Anna App 的工作台。

旧的底层 PPT 生成链路仍然存在：

```text
manifest.json -> deck.html -> ppt-model.json -> .pptx
```

新功能和日常开发优先围绕 `ppt-app`、Anna App runtime、app-facing tools、工作区 artifacts 和用户审阅流程展开。

## 仓库结构

- [`ppt-app/`](ppt-app/)：Anna App 前端，Vite + React + TypeScript。前端通过 `PptBackend` 调后端能力。
- [`presenton-template-engine/`](presenton-template-engine/)：模板发现、HTML 渲染、PPTX model 转换，以及 `ppt-engine` app-facing tools。
- [`presenton-pptx-generator/`](presenton-pptx-generator/)：根据 `ppt-model.json` 生成最终 `.pptx`。
- [`anna-executa-examples/`](anna-executa-examples/)：Anna App / Executa 规范和示例。

优先阅读：

1. [`ppt-app/README.md`](ppt-app/README.md)
2. [`ppt-app/manifest.json`](ppt-app/manifest.json)
3. [`ppt-app/src/api/pptBackend.ts`](ppt-app/src/api/pptBackend.ts)
4. [`ppt-app/src/api/annaPptBackend.ts`](ppt-app/src/api/annaPptBackend.ts)
5. [`ppt-app/src/runtime/annaRuntime.ts`](ppt-app/src/runtime/annaRuntime.ts)
6. [`presenton-template-engine/example_plugin.js`](presenton-template-engine/example_plugin.js)
7. [`presenton-template-engine/src/app-workspace/`](presenton-template-engine/src/app-workspace/)

## Anna App 调用边界

Anna App tool 调用形态必须是：

```ts
await anna.tools.invoke({
  tool_id: "tool-lightvoss_5433-ppt-engine-6443rj2a",
  method: "app_list_workspaces",
  args: {}
});
```

不要把前端的 `tools.invoke` 写成插件内部 JSON-RPC envelope。底层 Executa 插件仍使用 JSON-RPC over stdio，但前端只接触 Anna Runtime SDK。

职责边界：

- React 页面组件只调用 `PptBackend`。
- Anna Runtime / standalone 差异只放在 adapter 层。
- 工作区文件读写和 gate 判断放在 `ppt-engine` app-facing tools。
- `ppt-gener` 保持单一职责，只生成最终 `.pptx`。
- 前端不能直接读写本地文件系统。

## Tool ID 不变量

`ppt-app` 本地 Anna harness 依赖 tool id 完全一致。以下位置必须同步：

- [`ppt-app/manifest.json`](ppt-app/manifest.json) 的 `required_executas[].tool_id`
- [`ppt-app/manifest.json`](ppt-app/manifest.json) 的 `ui.host_api.tools`
- [`ppt-app/src/api/annaPptBackend.ts`](ppt-app/src/api/annaPptBackend.ts) 的默认 tool id，或 `.env` 里的 `VITE_PPT_*_TOOL_ID`
- [`ppt-app/executas/*/executa.json`](ppt-app/executas/)
- 真实插件 `describe` 返回的 manifest `name`

当前本地 ID：

```text
ppt-engine: tool-lightvoss_5433-ppt-engine-6443rj2a
ppt-gener:  tool-lightvoss_5433-ppt-gener-dc7ftcep
```

## 本地运行

在 `ppt-app/` 下常用命令：

```bash
npm run build
npm run dev
npm run dev:mock-llm
npm run check
npm run validate
```

`npm run dev` 实际运行 `anna-app dev`。不要重新引入独立 Vite dev server proxy 路径。

没有登录 Anna LLM / Agent 时可以用：

```bash
npm run dev -- --no-llm
```

但 `--no-llm` 只能检查 UI 和 tool invoke，不能验证大纲生成。确定性大纲测试优先用：

```bash
npm run build
npm run dev:mock-llm
```

真实 LLM 模式需要先执行 `anna-app login`。

## 构建与验证顺序

如果某些东西看起来“过期”或“没同步”，按这个顺序构建：

1. `cd presenton-template-engine && npm run build`。如果模板预览图变了，用 `npm run build:full`。
2. `cd ppt-app && npm run build`。这一步会先自动运行 preview sync。
3. `cd ppt-app && npm run validate`，确认 manifest 和 bundle 能通过 `anna-app validate --strict`。

如果修改 `presenton-template-engine/src/**`，需要重新构建 engine，因为 `example_plugin.js` 从 `dist/index.js` 导入。

## 模板预览约束

模板选择器使用静态图片 URL，不使用 data URL。图片字节不要走 JSON-RPC 通道。

预览图来源：

```text
presenton-template-engine/dist/template-previews/groups/<group>/*.png
```

前端同步目标：

```text
ppt-app/public/template-previews/<group>/
```

`ppt-app/scripts/sync-template-previews.mjs` 已接入 `predev` / `prebuild`。普通 `npm run build` 不会重新生成预览图；模板预览变更时用 `npm run build:full`。

## Anna Runtime 与 JSON-RPC 约束

- Anna runtime 目前还不能原生理解 `__file_transport` pointer response。
- `ppt-app/executas/ppt-engine-local/ppt_engine_local.js` 是协议适配器，会读取 pointer file 并把 JSON 内联回 stdout。runtime 原生支持 pointer 之前不要删除它。
- 适配器有 1 MB 内联上限。超过上限的 tool response 应返回 URL / path / artifact ID。
- 长期规则：任何超过约 64 KB 的 tool response 都应返回引用，不要返回字节本身。

## Workflow 原则

`ppt-app` 的工作流应是 artifact-driven，不是严格线性状态机。

判断“走到哪一步”时，优先从工作区 artifacts、status JSON、输入 hash / version、更新时间和 stale 原因派生，而不是依赖单一状态字段。

用户应能随时回到上游修改需求、偏好、模板、大纲、页面内容和 HTML 审阅反馈。上游 artifact 变化后，下游产物应能被判定为 stale，并引导用户重新生成或重新确认。

## 常见坑

- `AGENTS.md` 是 canonical agent guidance。不要再把新约束写进 `CLAUDE.md`、`Agent.md` 或 `AGENT.md`。
- `MainStage` 从 `template` 开始，不是从 `brief` 开始。
- `presenton-template-engine` 同时发布 ESM / CJS bundle；`import.meta.url` 路径需要 ESM-safe resolution，`__dirname` 路径需要 CJS-safe。
- Puppeteer 运行慢且需要浏览器权限。`npm run build:template-previews` 在 sandbox 里可能需要提权；`npm run build` 不带 `:full` 会跳过 Puppeteer。
- `app_get_template_preview` 服务端还存在但前端不再调用；删除前先确认 URL-based picker 在生产稳定。
- AI agent 编辑 `<workspace>/template/` 里的 TSX 时，不要复用静态图片选择器路径，也不要把未受信任的运行时代码放进 `ppt-app` 自己的 bundle 里渲染。
