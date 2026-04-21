# PPT SDK

这个仓库把一条完整的 PPT 生成链路拆成三个相互独立、又可以串联使用的项目。

整体目标是：

1. 用模板和结构化数据生成可预览的 Deck HTML。
2. 把 Deck HTML 转换成 PPTX 中间模型 JSON。
3. 把 PPTX 中间模型 JSON 写成最终的 `.pptx` 文件。

三个项目都同时保留了 vendored SDK 代码和 Anna Executa 插件入口，便于本地开发、调试和后续打包成二进制插件。

## 项目结构

```text
ppt-sdk/
  presenton-template-engine/
  presenton-html-to-pptx-model/
  presenton-pptx-generator/
```

## 三个项目分别做什么

### `presenton-template-engine`

`presenton-template-engine` 负责模板发现、模板 fork，以及根据 manifest 生成 HTML。

它的输入通常是：

- 模板组，例如 `red-finance`、`anime-culture`
- 一个描述整套 PPT 内容的 `manifest.json`
- 每页 slide 对应的结构化数据

它的输出通常是：

- 总览 Deck HTML，例如 `red-finance-deck.html`
- 每一页单独的 HTML 文件
- fork 出来的本地模板工程

在完整链路里，它是第一步：负责把“模板 + 内容数据”变成浏览器可以渲染的 HTML。

### `presenton-html-to-pptx-model`

`presenton-html-to-pptx-model` 负责把已经渲染好的 Deck HTML 转换成 PPTX 中间模型。

它会使用浏览器环境读取 HTML 页面里的 DOM、样式、图片和布局信息，然后生成一份 `PptxPresentationModel` JSON。

它的输入通常是：

- `presenton-template-engine` 生成的 `*-deck.html`

它的输出通常是：

- `*-model.json`
- 必要时生成截图兜底资源

在完整链路里，它是第二步：负责把“HTML 页面布局”转换成“PPTX 生成器可以理解的结构化模型”。

### `presenton-pptx-generator`

`presenton-pptx-generator` 负责把 PPTX 中间模型写成真正的 `.pptx` 文件。

它的输入通常是：

- `presenton-html-to-pptx-model` 生成的 `*-model.json`

它的输出通常是：

- 最终的 `.pptx` 文件

在完整链路里，它是第三步：负责把“中间模型 JSON”落盘成可以用 PowerPoint、Keynote、WPS 等工具打开的 PPT 文件。

## 三个项目如何协同生成 PPT

完整流水线如下：

```text
manifest.json
  |
  v
presenton-template-engine
  |
  | 生成 Deck HTML
  v
*-deck.html
  |
  v
presenton-html-to-pptx-model
  |
  | 解析 HTML / DOM / 样式，生成 PPTX 中间模型
  v
*-model.json
  |
  v
presenton-pptx-generator
  |
  | 写出最终 PPTX 文件
  v
*.pptx
```

也可以理解成三个阶段：

| 阶段 | 项目 | 主要职责 | 典型输入 | 典型输出 |
| --- | --- | --- | --- | --- |
| 1 | `presenton-template-engine` | 模板渲染 | `manifest.json` | `*-deck.html` |
| 2 | `presenton-html-to-pptx-model` | HTML 转 PPTX 模型 | `*-deck.html` | `*-model.json` |
| 3 | `presenton-pptx-generator` | PPTX 模型转文件 | `*-model.json` | `*.pptx` |

## 本地调试方式

仓库已经提供 VS Code 调试配置，位于 `.vscode/launch.json`。

当前按职责分成三组：

- `Engine:*`：调试 `presenton-template-engine`
- `Model:*`：调试 `presenton-html-to-pptx-model`
- `Generator:*`：调试 `presenton-pptx-generator`

对应的调试输入文件分别放在：

- `.vscode/engine/`
- `.vscode/model/`
- `.vscode/generator/`

这些调试配置都采用同一种方式：

1. 从对应目录读取一个 JSON-RPC stdin 文件。
2. 启动对应项目的插件入口。
3. 把插件 stdout 写入对应的 `stdout.json`。

这样可以在 VS Code 中用固定启动项反复调试每个阶段。

## 推荐开发顺序

如果要从头生成一份 PPT，推荐按这个顺序调试：

1. 使用 `Engine: Deck Html` 生成 Deck HTML。
2. 使用 `Model: Convert` 把 Deck HTML 转成 PPTX model JSON。
3. 使用 `Generator: Generate PPTX` 把 model JSON 生成最终 `.pptx`。

如果要开发模板，通常主要修改：

- `presenton-template-engine/src/app/presentation-templates/`

如果要优化 HTML 到 PPTX 模型的识别效果，通常主要修改：

- `presenton-html-to-pptx-model/src/extract/`
- `presenton-html-to-pptx-model/src/convert/`

如果要优化最终 PPTX 写入效果，通常主要修改：

- `presenton-pptx-generator/src/presenton_sdk_pptx_generator/`

## 子项目说明

更细的安装、启动、打包和 API 说明，请查看各子项目 README：

- [`presenton-template-engine/README.md`](./presenton-template-engine/README.md)
- [`presenton-html-to-pptx-model/README.md`](./presenton-html-to-pptx-model/README.md)
- [`presenton-pptx-generator/README.md`](./presenton-pptx-generator/README.md)
