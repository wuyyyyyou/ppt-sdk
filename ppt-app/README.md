# PPT App

`ppt-app` 是 Anna App 形态的 PPT 生成工作台。它把前端 SPA、PPT 引擎、
PPTX 生成器和搜索工具打包在同一个 app 目录下，方便被 Anna App runtime
加载到 iframe 并通过 bundled Executa 调用本地工具。

## 项目架构

```text
ppt-app/
├── manifest.json          # Anna App manifest，声明权限、视图和 bundled Executa
├── app.json               # Marketplace metadata 和 bundled_executas 路径
├── bundle/                # Vite 构建后的静态 SPA，运行时加载到 iframe
├── public/                # 前端静态资源，包含构建时同步的模板预览图
├── src/                   # React 前端、Anna runtime adapter、业务状态和 workflow UI
├── tests/                 # 前端和 workflow 单测
├── scripts/               # app 内同步、校验和 pipeline 辅助脚本
└── executas/
    ├── ppt-engine/        # Node Executa：模板、渲染、工作区、校验、任务状态机
    ├── ppt-gener/         # Python Executa：把 PPT model 写成最终 .pptx
    └── anna-search/       # Python Executa：搜索和图片抓取工具
```

前端页面只通过 `src/api/PptBackend` 访问后端能力。Anna runtime 模式下，
工具调用走 `anna.tools.invoke(...)`；真实 tool id 由运行时生成的
`bundle/anna-tool-ids.js` 注入到 `window.__ANNA_TOOL_IDS__`。前端不要写死
真实 tool id，也不要从 `.env` 回退。

`manifest.json` 使用稳定 bundled handle：

```text
bundled:ppt-engine
bundled:ppt-gener
bundled:anna-search
```

对应关系由以下文件保持同步：

- `manifest.json` 的 `required_executas[].tool_id`
- `manifest.json` 的 `ui.host_api.tools`
- `app.json` 的 `bundled_executas`
- `executas/*/executa.json` 的真实本地 `tool_id`
- `executas/*/executa.json` 的发布元数据 `name`、`version`、`description`
- 各 Executa `describe` 返回的 manifest `display_name` 和 `version`

`executas/*/manifest.json` 只作为 JSON-RPC `describe` 的 tool protocol manifest，
不再保存真实 `tool_id`。

## 本地环境

需要先安装：

- Node.js 22+
- npm
- uv
- Anna App CLI（通常来自 `@anna-ai/cli`）
- Chrome 或 Chrome for Testing，用于 `ppt-engine` 生成模板预览截图

如果要使用真实 Anna LLM bridge，需要先登录：

```bash
anna-app login --host <nexus-url>
```

## 首次安装和构建

按下面顺序执行。

### 1. 构建 ppt-engine

```bash
cd ppt-app/executas/ppt-engine
npm install
npm run build:full
```

`build:full` 会生成 `dist/`、forkable templates 和模板预览图。模板预览截图
需要本机 Chrome / Chrome for Testing 可用。

### 2. 构建 ppt-app

```bash
cd ppt-app
npm install
npm run build
```

`ppt-app` 的 `prebuild` 会同步 tool manifest 和模板预览图，然后由 Vite 输出
`bundle/`。

### 3. Python Executa 的 uv 环境

`ppt-gener` 和 `anna-search` 不需要像 Node 项目一样手动 `npm install`。
它们的 `executa.json` 直接使用：

```bash
uv run --project . python example_plugin.py
```

首次运行时，uv 会根据当前目录的 `pyproject.toml` 和 `uv.lock` 准备虚拟环境
和依赖。只要本机已经安装 `uv` 即可。

如果想提前预热依赖缓存，可以手动执行：

```bash
cd ppt-app/executas/ppt-gener
uv sync --project .

cd ../anna-search
uv sync --project .
```

## 常用命令

```bash
cd ppt-app
npm run build
npm run check
npm run validate
npm run ppt:check-env
npm run ppt:generate-tsx -- --entry <page.preview.tsx> --rasterize 1
npm run dev
npm run dev:mock-llm
npm run dev:mock-llm:retry
```

`npm run dev` 会执行 `anna-app dev`，由 Anna App harness 发现
`executas/*/executa.json` 并按需启动对应命令。

`npm run dev:mock-llm` 使用 `fixtures/mock-outline.jsonl` 作为 mock LLM
响应，适合稳定测试 outline 生成流程。

`npm run dev:mock-llm:retry` 使用 `fixtures/mock-outline-retry.jsonl`，第一轮
返回无效 JSON，后续 repair 请求返回有效 JSON，用来测试重试逻辑。

### 从 Page Source 生成最终 PPTX

Authoring Kit（创作套件）的 `*.preview.tsx` 或可独立渲染的 Page Source（页面源码）
可以直接经过完整开发验证链路：

```bash
cd ppt-app
npm run ppt:generate-tsx -- \
  --entry executas/ppt-engine/src/app/authoring-kit/foundations/SlideCanvas.preview.tsx \
  --rasterize 1
```

流水线生成静态 HTML、浏览器 PNG、PPTX Model、最终 `.pptx`，并可把最终 PPTX
重新栅格化为 PNG，方便和浏览器渲染结果对比。产物默认写入仓库根目录的
`.vscode/pipeline-output/`。

VS Code 默认 Build Task 是 `PPT: Generate From Current File`：当前编辑器为
`*.tsx` / `*.jsx` 时运行单页链路，为 `manifest.json` 时运行现有整套 Deck 链路。

## 同步 manifest

修改任一 Executa tool protocol manifest、版本号或 `executa.json` 里的 tool id 后，运行：

```bash
cd ppt-app
npm run sync:tool-manifests
```

这个脚本会同步 app manifest、`executa.json` 发布元数据、package/pyproject
入口、marketplace metadata 和前端生成的 `src/api/toolManifests.generated.ts`。
