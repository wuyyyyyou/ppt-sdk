# `presenton-template-engine-executa`

`presenton-template-engine` 是本仓库内部维护的 Anna Executa 工具包。它 vendored 了 Presenton template engine 能力，并提供 `ppt-engine` 插件入口。

这个包采用 ESM-only 构建和导出契约。不要为 runtime/SDK 产物重新引入 CommonJS 输出或 `require` 导出分支。`scripts/sea-bootstrap.cjs` 是 Node SEA 二进制启动器例外，不代表包级 CommonJS 支持。

## 角色

- 模板发现、本地模板读取和模板 fork。
- 根据 deck manifest 渲染 Deck HTML 和页面截图。
- 将 Deck HTML 转换为 `PptxPresentationModel`。
- 执行静态校验和可选浏览器渲染校验。
- 提供 app-facing 工作区工具和任务状态机工具。
- 作为 Anna Executa 插件响应 JSON-RPC `describe`、`health` 和 `invoke`。

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

普通构建会生成 ESM Node artifacts、browser runtime artifacts、类型声明、forkable templates 资源和保留的 template preview 资源。

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
- GitHub release workflow 会构建 `darwin-x86_64`、`darwin-arm64`、`windows-x86_64`、`linux-x86_64` 和 `linux-aarch64`。
- `bundle/` 只保留最终 archive 和 sha256，不再保留中间裸二进制。
- archive 内部包含 `bin/ppt-engine`、`lib/`、`data/` 和顶层 binary distribution `manifest.json`。
- `manifest.json` 名称有两层含义：本目录下的 Executa tool manifest 是 `describe` 的来源；archive 顶层 manifest 是 Anna Binary 分发入口配置。
- 打包脚本的 `--test` 会解压最终 archive，校验 binary distribution manifest，并调用 `bin/ppt-engine` 的 `describe` 做冒烟。
- release workflow 会先生成一次模板预览图 artifact，各平台二进制构建通过 `--reuse-template-previews` 复用这份静态资源；本地直接运行脚本时默认仍会重新生成预览图。
- 二进制首次运行时会自动把内嵌的 `dist`、运行时依赖和模板资源释放到系统临时目录，再启动插件。

## 主要工具能力

### Deck HTML 渲染

`buildDeckHtmlFromManifest` 读取 `manifest_path` 指向的 JSON 文件，把结果写到 `output_dir`，并返回输出文件路径和基础元数据。它会输出整体的 `*-deck.html`，并为每一页输出浏览器渲染后的 PNG 截图，便于多模态 Agent 检查页面视觉结果。

`manifest_path` 和 `output_dir` 必须是绝对路径。逐页 PNG 需要真实浏览器渲染，运行时需要本机有可用的 Chrome / Chrome for Testing。

### HTML 到 PPTX Model

`convertDeckHtmlToPptxModel` 读取 `html_path` 指向的 deck HTML 文件，生成 `PptxPresentationModel`，并把结果写到 `output_path`。

常用参数：

- `html_path`
- `output_path`
- `name`
- `settle_time_ms`
- `screenshots_dir`

其中 `html_path`、`output_path` 和 `screenshots_dir` 必须是绝对路径。转换运行时仍然需要本机有可用的 Chrome / Chrome for Testing。

### Deck 校验

`validateDeckFromManifest` 会对 manifest 对应的 deck 做静态校验，以及可选的浏览器渲染兼容校验。

常用参数：

- `manifest_path`
- `output_dir`
- `name`
- `single_page`
- `page`
- `include_rendered_checks`
- `deck_html_path`

`include_rendered_checks=true` 时会拉起浏览器做 rendered validation。如果已经有现成的 deck HTML，可以通过 `deck_html_path` 复用，避免重复构建。单页模式会聚焦目标页本身，不继续报告其他页上的跨页问题。

### 模板 fork

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
- 静态校验、渲染校验和校验报告写入。

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
