# `presenton-html-to-pptx-model-executa`

这个目录是从旧的 `html-to-pptx-model` 代码迁移出来的独立业务插件包。

它现在同时承担两层角色：

- vendored Presenton html-to-pptx-model 代码
- Anna Executa 插件入口

## Executa 插件

插件入口文件：

- `example_plugin.js`

当前只暴露一个工具：

- `convertDeckHtmlToPptxModel`

### 安装依赖

```bash
cd /Users/leyouming/company_program/anna/anna-executa-examples/presenton-html-to-pptx-model
npm install
```

### 启动插件

```bash
cd /Users/leyouming/company_program/anna/anna-executa-examples/presenton-html-to-pptx-model
node example_plugin.js
```

### 最小协议测试

```bash
echo '{"jsonrpc":"2.0","method":"describe","id":1}' | node example_plugin.js 2>/dev/null
```

### 打包二进制

当前提供的是基于 Node.js SEA 的一键打包脚本，产出为当前平台单文件二进制：

```bash
cd /Users/leyouming/company_program/anna/anna-executa-examples/presenton-html-to-pptx-model
npm install
./build_binary.sh --test
```

生成产物：

- `bundle/presenton-html-to-pptx-model-plugin`

说明：

- 这是当前平台构建。例如你在 macOS 上执行，产出的是 macOS 可执行文件。
- 二进制首次运行时会自动把内嵌的 `dist` 和运行时依赖释放到系统临时目录，再启动插件。
- 运行 `convertDeckHtmlToPptxModel` 时仍然需要本机有可用的 Chrome / Chrome for Testing。
- 如果后续要支持 Windows / Linux，建议在对应平台机器或 CI runner 上分别执行同一份 `build_binary.sh`。

### `convertDeckHtmlToPptxModel`

这个工具读取 `html_path` 指向的 deck HTML 文件，生成 `PptxPresentationModel`，并把结果写到 `output_path`。

支持的主要参数：

- `html_path`
- `output_path`
- `cwd`
- `name`
- `settle_time_ms`
- `screenshots_dir`

工具不会直接返回整份大 JSON，只返回输出文件路径和摘要信息。

注意：

- 这个插件运行时会动态使用 `puppeteer`
- 首次安装或首次运行时，可能需要浏览器二进制可用

如果本地还没有可用的 Chrome for Testing，可以执行：

```bash
cd /Users/leyouming/company_program/anna/anna-executa-examples/presenton-html-to-pptx-model
npx puppeteer browsers install chrome
```

## Vendored SDK

下面保留原始 SDK 说明，便于后续继续维护底层转换源码：

Presenton 的独立 SDK，用来把“已经渲染好的整套 deck HTML / 浏览器页面 DOM”转换成 `PptxPresentationModel`。

它复用了 Presenton 当前导出链路里的核心思路：

- 固定 `1280x720` 画布
- 从 `#presentation-slides-wrapper` 递归提取 DOM / computed styles
- 将文本、形状、图片、分割线映射成 PPTX model
- 对 `svg` / `canvas` / `table` 等复杂节点走截图兜底

当前 SDK 只负责：

- `deck HTML -> PptxPresentationModel`

它不负责：

- `.pptx` 文件写入
- 模板渲染
- 主题生成

## 安装

```bash
npm install @presenton-sdk/html-to-pptx-model
```

如果你希望直接调用 `convertDeckHtmlToPptxModel(...)` 自动拉起浏览器，还需要安装：

```bash
npm install puppeteer
```

如果你已经自己管理浏览器页面，也可以把现成的 `page` 传进 SDK，此时不要求 SDK 自己依赖 `puppeteer`。

## 最常用用法

```ts
import { convertDeckHtmlToPptxModel } from "@presenton-sdk/html-to-pptx-model";

const model = await convertDeckHtmlToPptxModel({
  name: "demo-deck",
  html: `
    <!doctype html>
    <html>
      <body>
        <div id="presentation-slides-wrapper">
          <div>
            <div style="width:1280px;height:720px;background:#ffffff;position:relative;">
              <h1 style="position:absolute;left:64px;top:72px;font-size:40px;color:#111827;">
                Presenton SDK
              </h1>
            </div>
          </div>
        </div>
      </body>
    </html>
  `,
});

console.log(JSON.stringify(model, null, 2));
```

## API

### `convertDeckHtmlToPptxModel(input)`

输入一整份 deck HTML，返回 `PptxPresentationModel`。

默认行为：

- 自动创建浏览器页面
- `page.setContent(html)`
- 从 `#presentation-slides-wrapper` 下读取 slide
- 生成 `PptxPresentationModel`

如果已传入 `page`，SDK 不会关闭这个页面。

### `convertDeckPageToPptxModel(input)`

适合你已经有现成浏览器页的场景，例如：

- 先自己注入脚本
- 先自己做模板渲染
- 先自己等待图表完成渲染

### `extractDeckPageToSlideAttributes(input)`

调试接口。只提取每一页的 `ElementAttributes[]` 和 `backgroundColor`，不做最终 PPTX model 映射。

### `convertElementAttributesToPptxSlides(slidesAttributes)`

把中间态 `SlideAttributesResult[]` 转成 `PptxSlideModel[]`。

### `convertSlideElementAttributesToPptxSlideModel(slideAttributes)`

只转换单页。

## 约定

默认 deck 结构与 Presenton 当前导出页一致：

- deck 容器：`#presentation-slides-wrapper`
- slide 节点选择器：`:scope > div > div`
- speaker note 容器属性：`data-speaker-note`

这三个选择器都可以覆盖。
