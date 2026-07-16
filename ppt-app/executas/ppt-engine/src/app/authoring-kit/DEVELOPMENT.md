# Authoring Kit 开发指南

本文档只面向 ppt-engine 仓库中的 Authoring Kit（创作套件）维护者，不属于安装给 Workspace Page Authoring Agent（页面创作智能体）的套件内容。

## Preview Source（预览源码）

组件旁可以增加 `*.preview.tsx`，用于不创建 manifest、Page UUID 或 `slides/` 目录的快速渲染检查。

```text
foundations/
├── SlideCanvas.tsx
└── SlideCanvas.preview.tsx
```

Preview Source 应默认导出一个无必填 props、可独立渲染的 React 组件：

```tsx
import MetricCard from "./MetricCard.tsx";

export default function MetricCardPreview() {
  return (
    <div style={{ position: "relative", width: 1280, height: 720 }}>
      <MetricCard title="Revenue" value="$12.8M" />
    </div>
  );
}
```

预览引擎不会自动注入 `SlideCanvas`、背景、位置或组件容器。需要测试的样例 props、主题、尺寸和布局都应由 Preview Source 自己表达。

`.preview.tsx` 是推荐命名约定，不是 API 的强制后缀。任意受支持的本地 TSX/JSX 入口只要默认导出可渲染组件，也可以传给预览命令。

## 本地命令

基础预览：

```bash
npm run preview:tsx -- src/app/authoring-kit/foundations/SlideCanvas.preview.tsx
```

同时生成 PPTX Model：

```bash
npm run preview:tsx -- src/app/authoring-kit/foundations/SlideCanvas.preview.tsx --model
```

可用参数：

- `--model`：额外生成单页 PPTX Model JSON 和模型截图资产目录。
- `--json`：只输出机器可读的单行 JSON，供 `ppt-app` 流水线编排使用。
- `--name=<name>`：覆盖从入口文件名推导的产物名称。
- `--output=<absolute-path>`：覆盖默认输出目录，必须使用绝对路径。

命令接受相对或绝对入口路径，默认先执行与 ppt-app 页面预览相同的 TypeScript 检查。它直接运行 `src` 实现，不要求预先执行 `npm run build`，也不会启动 dev server、自动打开浏览器或进入 watch 模式。

## 输出产物

默认输出目录是 `.preview-output/<name>/`：

```text
.preview-output/slide-canvas/
├── slide-canvas.html
├── slide-canvas-browser.png
├── slide-canvas-ppt-model.json
└── slide-canvas-ppt-assets/
```

- HTML 是浏览器渲染后的静态 DOM HTML。
- `*-browser.png` 是重新打开静态 HTML 后生成的浏览器截图。
- `*-ppt-model.json` 只在使用 `--model` 时生成。
- `*-ppt-assets/` 保存 PPTX Model 中截图化元素需要的 PNG，文件名沿用转换器的随机 UUID。

重复运行会覆盖同名 HTML、PNG 和 Model；生成 Model 前只会清理该 Preview 自己的 `*-ppt-assets/`，不会清空整个输出目录。

## 运行边界

- Preview 使用与正式 Page Source 相同的 React、Recharts、Tailwind、Chrome、渲染就绪和静态化实现。
- npm 依赖必须属于正式 Page Source 运行时允许的依赖；本地相对 import 必须留在最近 `tsconfig.json` 定义的项目根目录内。
- `buildPageSourcePreview` 本身只负责构建产物，不执行完整 TypeScript 检查；`preview:tsx` 命令负责先检查再构建，与 ppt-app 的现有编排方式一致。
- `--model` 只验证到 HTML → PPTX Model，不生成最终 `.pptx`。

## 最终 PPTX 验证

需要验证最终 PowerPoint 产物时，从 `ppt-app` 目录运行跨 Executa 流水线：

```bash
npm run ppt:generate-tsx -- \
  --entry executas/ppt-engine/src/app/authoring-kit/foundations/SlideCanvas.preview.tsx \
  --rasterize 1
```

该命令依次生成静态 HTML、浏览器 PNG、PPTX Model、最终 `.pptx`，并在启用
`--rasterize` 时把最终 PPTX 重新渲染成 PNG。统一产物和分阶段日志写入仓库根目录的
`.vscode/pipeline-output/`。

在 VS Code 中打开目标 `*.tsx` 或 `*.jsx` 后，可以直接执行默认 Build Task
`PPT: Generate From Current File`。该任务也兼容当前编辑器是 `manifest.json` 的整套
Deck 流程。

## 安装与发布

`DEVELOPMENT.md` 和 `*.preview.tsx` 都是仓库开发文件：

- 不复制到 `dist/authoring-kit`；
- 不进入 SEA Authoring Kit 资产；
- 不安装到 Workspace；
- 不提供给 Page Authoring Agent 阅读。

面向 Page Authoring Agent 的正式模块和参考实现说明必须写入 Authoring Kit 的 `README.md`、`foundations/README.md` 或 `references/README.md`，不要依赖 Preview Source 作为文档。
