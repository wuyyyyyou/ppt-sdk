# `presenton-template-engine-executa`

`presenton-template-engine` 是本仓库内部维护的 Anna Executa 工具包。它 vendored 了 Presenton template engine 能力，并提供 `ppt-engine` 插件入口。

这个包采用 ESM-only 构建和导出契约。不要为 runtime/SDK 产物重新引入 CommonJS 输出或 `require` 导出分支。`scripts/sea-bootstrap.cjs` 是 Node SEA 二进制启动器例外，不代表包级 CommonJS 支持。

## 角色

- 在 Workspace 中不存在 Authoring Kit（创作套件）时安装一份独立副本。
- 根据 Confirmed Outline（已确认大纲）准备独立 Page Source（页面源码）并重建最小 Deck Manifest（演示文稿清单）。
- 根据 Page Source manifest 渲染 Deck HTML 和页面截图。
- 将 Deck HTML 转换为 `PptxPresentationModel`。
- 提供 app-facing 工作区工具和任务状态机工具。
- 作为 Anna Executa 插件响应 JSON-RPC `describe`、`health` 和 `invoke`。

旧的模板发现、模板选择和模板 fork 能力仍暂时保留，供 PPT App 前端切换前使用，不属于新的创作主路径。

## Executa 插件

插件入口文件：

- `example_plugin.js`

插件 manifest 的唯一来源是本目录下的 `manifest.json`。`describe` 返回值、tool id 和 version 都应以该 manifest 为准。

最小协议测试：

```bash
printf '%s\n' '{"jsonrpc":"2.0","method":"describe","id":1}' | node example_plugin.js 2>/dev/null
```

参数兼容说明：

- Discovery 相关工具里的 `local_roots` 这类 `array` 参数，除了直接传 JSON 数组，也兼容传字符串形式的 JSON 数组，例如 `"[\"/path/a\",\"/path/b\"]"`。
- 如果传入的字符串无法解析为字符串数组，插件仍会返回参数错误。
- 对外工具里的路径参数只接受绝对路径；如果传入相对路径，会明确返回对应参数不是绝对路径。

## 常用命令

```bash
npm install
npm run build
npm run check
npm run test:unit
npm run start:plugin
```

如果模板预览图变更，再运行：

```bash
npm run build:full
```

## 构建产物

普通构建会生成 ESM Node artifacts、browser runtime artifacts、类型声明、Authoring Kit 资源、forkable templates 资源和保留的 template preview 资源。

`dist/` 是生成目录，不提交到 git。修改 `src/**` 后需要重新构建，插件入口会从构建后的 `dist/index.js` 加载 engine。

## 二进制打包

当前提供基于 Node.js SEA 的 Anna Binary 分发包打包脚本：

```bash
./build_binary.sh --test
```

生成产物：

- `bundle/<binary-name>-v<manifest.version>-<anna-platform-key>.tar.gz`
- `bundle/<binary-name>-v<manifest.version>-<anna-platform-key>.tar.gz.sha256`
- Windows 平台生成 `.zip` 和 `.zip.sha256`

说明：

- 这是当前平台构建。例如在 Apple Silicon macOS 上执行，产出 `darwin-arm64` 分发包。
- GitHub release workflow 会构建 `darwin-x86_64`、`darwin-arm64`、`windows-x86_64` 和 `linux-x86_64`。`ppt-engine` 暂不发布 `linux-aarch64`，其他 Executa 的平台范围不受影响。
- `bundle/` 只保留最终 archive 和 sha256，不再保留中间裸二进制。
- archive 内部包含 `bin/ppt-engine`、`lib/browser/` 下与固定 Puppeteer revision 匹配的完整 Chrome for Testing、`data/` 和顶层 binary distribution `manifest.json`。运行时不要求目标机器预装 Chrome，也不会首次联网下载浏览器。
- `manifest.json` 名称有两层含义：本目录下的 Executa tool manifest 是 `describe` 的来源；archive 顶层 manifest 是 Anna Binary 分发入口配置。
- 打包脚本的 `--test` 会解压最终 archive，校验 binary distribution manifest 和浏览器资源，在隔离的 SEA v2 缓存中并发启动多个 `describe` 进程，并通过真实 JSON-RPC 调用完成单页 HTML、PNG 和 PPTX Model 冒烟。
- release workflow 会先生成一次模板预览图 artifact，各平台二进制构建通过 `--reuse-template-previews` 复用这份静态资源；本地直接运行脚本时默认仍会重新生成预览图。
- 二进制首次运行时会把内嵌的 `dist`、运行时依赖和模板资源解包到版本化共享缓存。每个进程先写独立 staging，校验完成后原子发布，避免并发首次启动破坏正式缓存；浏览器不进入 SEA 缓存。
- `linux-x86_64` 的运行基线是 Ubuntu 22.04 兼容的 glibc Linux。Binary 提供 Chrome，但不捆绑 glibc、NSS、GTK、GBM 等系统动态库，也不支持 Alpine/musl 或缺少 Chrome 基础运行库的极简镜像。

## 主要工具能力

### Workspace Authoring

新的创作主路径使用以下工作区结构：

```text
workspace/
├── outline.json
├── manifest.json
├── authoring-kit/
│   ├── README.md
│   ├── foundations/
│   └── references/
└── slides/
    └── <page_id>.tsx
```

- Confirmed Outline 持有稳定、与页序无关的 `page_id`。
- 每个 `page_id` 始终对应一个 `./slides/<page_id>.tsx` Page Source。
- `manifest.json` 只包含顶层 `title`，以及每页的 `id`、`source`。
- Page Source 是页面可见内容和布局的唯一渲染来源，不再配套 `data/*.json`。
- `authoring-kit/` 是约定只读的共享创作基础；当前版本由 README 和 PPT App 提示词约束 Page Authoring Agent（页面创作智能体）不得修改。
- `foundations/` 提供 Page Source 可以导入的底层模块；`references/` 只供阅读、复制和改写，不应直接 import（导入）。
- Page Source 初始化使用引擎内置的稳定 Bootstrap（引导）资源，该资源不会复制到 Workspace Authoring Kit 中。

插件暴露了安装 Authoring Kit、补齐大纲页面标识、准备 Page Source、重建 manifest 和获取 Page Source 指纹的 app-facing 工具。Style Guide 的表示格式、生成方式和持久化接口由后续 PPT App 流程设计决定，不属于当前引擎渲染契约。前端切换完成前，旧 Page Plan（页面计划）和 Theme Token 工具仍会临时存在，但新路径不调用它们。

### Deck HTML 渲染

`buildDeckHtmlFromManifest` 读取 `manifest_path` 指向的 JSON 文件，把结果写到 `output_dir`，并返回输出文件路径和基础元数据。它会输出整体的 `*-deck.html`，并为每一页输出浏览器渲染后的 PNG 截图，便于多模态 Agent 检查页面视觉结果。

Page Source HTML 是从权威 Page Source 重建的机器产物，不应直接编辑。按照 [ADR-0021](../../../docs/adr/0021-persist-browser-rendered-static-html-snapshots.md)，所有 manifest 渲染入口内部先执行 Page Source，再只把浏览器完成渲染后的静态 DOM HTML 写入正式输出。

- 单页 HTML 和 Deck HTML 的可见 DOM、Tailwind 最终 CSS、Recharts SVG 等内容在文件中已经存在，重新打开时不执行 React 或 Page Source。
- 普通图片、字体和其他资源链接保持原有引用语义，不额外复制到新的资源目录。
- Deck HTML 可以保留引擎自有的小型查看器脚本；页面内部 React 交互不会进入静态产物。
- Tailwind 使用随 ppt-engine 和 SEA 二进制发布的固定 `@tailwindcss/browser` 4.3.2，正式 HTML 不加载 Tailwind CDN 或携带 Tailwind runtime。
- 截图和 HTML 到 PPTX Model 转换从重新打开的静态 HTML 生成。

`manifest_path` 和 `output_dir` 必须是绝对路径。源码模式需要本机有可用的 Chrome / Chrome for Testing；Anna Binary 模式默认使用 archive 内置浏览器，缺失或启动失败时直接报错，不隐式回退系统 Chrome。

### HTML 到 PPTX Model

`convertDeckHtmlToPptxModel` 读取 `html_path` 指向的 deck HTML 文件，生成 `PptxPresentationModel`，并把结果写到 `output_path`。

常用参数：

- `html_path`
- `output_path`
- `name`
- `settle_time_ms`
- `screenshots_dir`

其中 `html_path`、`output_path` 和 `screenshots_dir` 必须是绝对路径。源码模式仍需本机浏览器；Anna Binary 模式使用随包 Chrome for Testing。

### 模板 fork

> 过渡能力：只服务于尚未切换的旧 PPT App 流程，不是新 Workspace Authoring 主路径。

`forkTemplateGroup` 会把一个内置模板组 fork 到指定目录，生成一套可本地继续修改的模板工程。

输出内容包括：

- `slides/*.tsx`
- `group.json`
- `manifest.json`
- `catalog.json`，如果原模板组提供
- `data/`，如果原模板组提供

输入参数：

- `template_group`: 内置模板组 id
- `out_dir`: 输出目录，必须是绝对路径
- `manifest_title`: 可选，生成 `manifest.json` 时使用的标题
- `overwrite`: 可选，是否覆盖非空输出目录，默认 `false`

fork 后不执行 `npm install`。生成的 TSX 模板由引擎二进制内置运行时解析。

## 内部 API 维护说明

内部 engine API 主要分为：

- 模板摘要、模板详情和主题预设查询。
- 单页 HTML、整 Deck HTML 和 standalone Deck HTML 构建。
- 本地模板编译和 runtime bundle 生成。
- HTML / DOM 到 PPTX model 的抽取与转换。
- 工作区 artifact 读写、导出状态记录和任务状态机。

这些 API 是本仓库内部维护边界，不是公共 npm SDK 契约。新增调用方时优先通过插件 tool 或 `ppt-app` 的 `PptBackend` 适配层接入。

## 服务端入口

CLI 入口：

```bash
node dist/cli.js
```

内部 ESM 调用方也可以从 server subpath 导入 server 启动函数。该 subpath 只提供 ESM 导出，不提供 CommonJS `require` 导出。

可用接口：

- `GET /healthz`
- `GET /template-groups`
- `GET /themes`
- `GET /template-info?groupId=<groupId>`
- `POST /render-slide`

## 验证要求

修改 engine 构建、导出、路径解析或插件入口后，至少运行：

```bash
npm run build
npm run check
npm run test:unit
printf '%s\n' '{"jsonrpc":"2.0","method":"describe","id":1}' | node example_plugin.js 2>/dev/null
```

`./build_binary.sh --test` 用于二进制打包冒烟，耗时较长，可按需要由人工单独运行。
