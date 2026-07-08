# PPT SDK

这个仓库把 PPT 生成链路包装成一个 Anna App。当前主线是 `ppt-app/`，它自包含 app manifest、marketplace metadata、静态 SPA bundle 和 bundled Executa 源码。

完整链路仍然是：

```text
manifest.json -> deck.html -> ppt-model.json -> .pptx
```

## 项目结构

```text
ppt-sdk/
  ppt-app/
    manifest.json
    app.json
    bundle/
    scripts/
    executas/
      ppt-engine/
      ppt-gener/
      anna-search/
```

## 组件职责

- `ppt-app/src/`：Anna App 前端工作台。React 页面只通过 `PptBackend` 调用后端能力。
- `ppt-app/executas/ppt-engine/`：模板发现、模板 fork、Deck HTML 渲染、HTML 到 PPTX model 转换、校验、任务状态机和工作区工具。
- `ppt-app/executas/ppt-gener/`：把 `PptxPresentationModel` 写成最终 `.pptx`。
- `ppt-app/executas/anna-search/`：Anna App bundled search Executa。
- `ppt-app/scripts/`：tool manifest 同步、模板预览同步和 VS Code pipeline 辅助脚本。

Package/project name 暂时保留历史名称，例如 `presenton-template-engine-executa`、`presenton-pptx-generator-executa`、`anna-search-executa`。目录位置以 `ppt-app/executas/*` 为准。

## 本地调试

仓库提供 VS Code 调试配置和任务：

- `.vscode/launch.json`：单个 Executa 或单个 tool 的 JSON-RPC 调试入口。
- `.vscode/tasks.json`：从当前打开的 `manifest.json` 跑完整 pipeline。

默认 build task 是 `PPT: Generate PPTX From Current Manifest`。它会调用：

```bash
node ppt-app/scripts/run-ppt-pipeline.mjs generate --manifest <manifest.json>
```

流水线步骤：

1. `ppt-engine` 生成 Deck HTML。
2. `ppt-engine` 调用 `convertDeckHtmlToPptxModel` 生成 `*-model.json`。
3. `ppt-gener` 生成最终 `.pptx`。

输出目录：

```text
.vscode/pipeline-output/
  <presentation-slug>/
    <timestamp>/
      manifest.json
      engine/
      model/
      generator/
      logs/
      run-summary.json
```

## 常用命令

```bash
cd ppt-app/executas/ppt-engine && npm run build
cd ppt-app/executas/ppt-engine && npm run check
cd ppt-app/executas/ppt-engine && npm run test:unit
cd ppt-app && npm run check
cd ppt-app && npm run build
cd ppt-app && npm run validate
```

Python Executa 使用 `uv`：

```bash
cd ppt-app/executas/ppt-gener && uv run --project . python example_plugin.py
cd ppt-app/executas/anna-search && uv run --project . python example_plugin.py
```

默认不要由 agent 启动 dev server。需要运行 Anna App harness 时，由用户明确要求后再执行 `cd ppt-app && npm run dev`。

## 更多说明

- [`AGENTS.md`](./AGENTS.md)
- [`CONTEXT.md`](./CONTEXT.md)
- [`ppt-app/README.md`](./ppt-app/README.md)
- [`ppt-app/executas/ppt-engine/README.md`](./ppt-app/executas/ppt-engine/README.md)
- [`ppt-app/executas/ppt-gener/README.md`](./ppt-app/executas/ppt-gener/README.md)
