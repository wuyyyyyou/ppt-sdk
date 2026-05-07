# `presenton-template-engine-executa`

这个目录是从旧的 `template-engine` 代码迁移出来的独立示例包。

它现在同时承担两层角色：

- vendored Presenton template engine 代码
- Anna Executa 插件入口

## Executa 插件

插件入口文件：

- `example_plugin.js`

当前暴露 7 个工具：

- `listDiscoveredTemplateGroupSummaries`
- `getAllDiscoveredTemplateGroups`
- `getDiscoveredTemplateGroup`
- `buildDeckHtmlFromManifest`
- `convertDeckHtmlToPptxModel`
- `validateDeckFromManifest`
- `forkTemplateGroup`

参数兼容说明：

- 对于 discovery 相关工具里的 `local_roots` 这类 `array` 参数，除了直接传 JSON 数组，也兼容传字符串形式的 JSON 数组，例如 `"[\"/path/a\",\"/path/b\"]"`。
- 如果传入的字符串无法解析为字符串数组，插件仍会返回参数错误。
- 对外工具里的路径参数只接受绝对路径；如果传入相对路径，会明确返回对应参数不是绝对路径。

### 安装依赖

```bash
cd /Users/leyouming/company_program/anna/anna-executa-examples/presenton-template-engine
npm install
```

### 启动插件

```bash
cd /Users/leyouming/company_program/anna/anna-executa-examples/presenton-template-engine
node example_plugin.js
```

### 最小协议测试

```bash
echo '{"jsonrpc":"2.0","method":"describe","id":1}' | node example_plugin.js 2>/dev/null
```

### 打包二进制

当前提供的是基于 Node.js SEA 的一键打包脚本，产出为当前平台单文件二进制：

```bash
cd /Users/leyouming/company_program/anna/anna-executa-examples/presenton-template-engine
npm install
./build_binary.sh --test
```

生成产物：

- `bundle/ppt-engine`

说明：

- 这是当前平台构建。例如你在 macOS 上执行，产出的是 macOS 可执行文件。
- 二进制首次运行时会自动把内嵌的 `dist`、运行时依赖和模板资源释放到系统临时目录，再启动插件。
- 如果后续要支持 Windows / Linux，建议在对应平台机器或 CI runner 上分别执行同一份 `build_binary.sh`。

### `buildDeckHtmlFromManifest`

这个工具支持两种输入方式：

- 传 `manifest_path` 指向 JSON 文件

工具不会返回大段 HTML 内容，而是把结果写到 `output_dir`，再返回输出文件路径和基础元数据。`manifest_path` 和 `output_dir` 必须是绝对路径。

### `convertDeckHtmlToPptxModel`

这个工具读取 `html_path` 指向的 deck HTML 文件，生成 `PptxPresentationModel`，并把结果写到 `output_path`。

支持的主要参数：

- `html_path`
- `output_path`
- `name`
- `settle_time_ms`
- `screenshots_dir`

其中 `html_path`、`output_path` 和 `screenshots_dir` 必须是绝对路径。

说明：

- 这个工具现在由 `ppt-engine` 直接对外暴露，便于 AI / task 只调用一个 Node 插件。
- 转换实现源码已经内聚在 `presenton-template-engine` 内部，不再要求外部工作流额外调用独立的 HTML-to-model 插件。
- 运行时仍然需要本机有可用的 Chrome / Chrome for Testing。

### `validateDeckFromManifest`

这个工具会对 manifest 对应的 deck 做静态校验，以及可选的浏览器渲染兼容校验。

支持的主要参数：

- `manifest_path`
- `output_dir`
- `name`
- `single_page`
- `page`
- `include_rendered_checks`
- `deck_html_path`

其中 `manifest_path`、`output_dir` 和可选的 `deck_html_path` 必须是绝对路径。

说明：

- `include_rendered_checks=true` 时会拉起浏览器做 rendered validation。
- 如果已经有现成的 deck HTML，可以通过 `deck_html_path` 复用，避免重复构建。
- `single_page=true` 时只校验 `page` 指定的那一页，适合长 deck 的定点排查。
- 单页模式会聚焦目标页本身，不会继续报告其他页上的跨页问题，例如别的页里的重复 `id`。

### `forkTemplateGroup`

这个工具会把一个内置模板组 fork 到指定目录，生成一套可本地继续修改的模板工程，输出内容包括：

- `slides/*.tsx`
- `group.json`
- `manifest.json`
- `catalog.json`，如果原模板组提供
- `data/`，如果原模板组提供

输入参数：

- `template_group`: 内置模板组 id，例如 `general`、`red-finance`
- `out_dir`: 输出目录
- `manifest_title`: 可选，生成 `manifest.json` 时使用的标题
- `overwrite`: 可选，是否覆盖非空输出目录，默认 `false`

说明：

- 这个工具 fork 的是内置模板组，不是本地发现到的自定义模板组。
- `out_dir` 必须是绝对路径。
- fork 后不再执行 `npm install`，生成的 TSX 模板由引擎二进制内置运行时解析。
- 返回结果里会包含生成后的绝对路径，以及内存中的 `manifest` 内容。

## Vendored SDK

下面保留原始 SDK 说明，便于后续继续维护模板引擎源码：

Presenton 模板注册表 SDK，同时提供一个可选的独立 HTTP 服务，以及“根据模板和结构化数据渲染单页 HTML”的能力。

## 安装

```bash
npm install @presenton-sdk/template-engine
```

## SDK 用法

```ts
import {
  buildDeckHtml,
  buildStandaloneDeckHtml,
  getAllGroupsWithTemplates,
  getTemplateGroup,
  listThemePresets,
  listTemplateGroupSummaries,
  renderSlideHtml,
} from "@presenton-sdk/template-engine";

const groupSummaries = listTemplateGroupSummaries();
const themes = listThemePresets();
const allGroups = getAllGroupsWithTemplates();
const generalGroup = getTemplateGroup("general");
const html = renderSlideHtml({
  template_group: "general",
  layout_id: "general:general-intro-slide",
  slide_data: {
    title: "Presenton SDK",
    subtitle: "Render one slide to HTML",
  },
});
const deckHtml = buildDeckHtml({
  slides: [{ html }],
});

const standaloneDeckHtml = buildStandaloneDeckHtml({
  slides: [{ html }],
});
```

## SDK API

当前 SDK 对外暴露五类能力：

- `listTemplateGroupSummaries()`
- `listThemePresets()`
- `getAllGroupsWithTemplates()`
- `getTemplateGroup(groupId)`
- `renderSlideHtml(input)`
- `buildDeckHtml(input)`
- `buildStandaloneDeckHtml(input)`

### `listTemplateGroupSummaries()`

作用：

- 返回全部模板组的摘要信息。
- 不返回每个组下面的 `layouts`、`json_schema`、`sample_data`。
- 适合做“先列出所有模板组，再让调用方选择一个组”的第一步查询。
- 相比返回完整详情，这个接口的返回体更小。

输入：

- 无参数。

输出：

- 返回 `TemplateGroupSummaryInfo[]`

示例：

```ts
import { listTemplateGroupSummaries } from "@presenton-sdk/template-engine";

const groups = listTemplateGroupSummaries();
console.log(groups);
```

### `getTemplateGroup(groupId)`

作用：

- 根据模板组 id 返回某一个模板组的完整信息。
- 返回结果中会包含该模板组下面的全部 layouts。
- 每个 layout 都会带上 `layout_id`、`layout_name`、`layout_description`、`json_schema`、`sample_data`。

输入：

- `groupId: string`

输出：

- 返回 `TemplateGroupInfo | null`
- 如果模板组存在，返回该组完整信息。
- 如果模板组不存在，返回 `null`。

示例：

```ts
import { getTemplateGroup } from "@presenton-sdk/template-engine";

const group = getTemplateGroup("general");

if (!group) {
  console.log("group not found");
} else {
  console.log(group.group_name);
  console.log(group.layouts.length);
}
```

### `getAllGroupsWithTemplates()`

作用：

- 返回全部模板组的完整信息。
- 每个模板组都会包含其全部 layouts。
- 适合确实需要一次性拉取全部模板组、全部 layout、全部 schema 的场景。

输入：

- 无参数。

输出：

- 返回 `TemplateGroupInfo[]`

示例：

```ts
import { getAllGroupsWithTemplates } from "@presenton-sdk/template-engine";

const groups = getAllGroupsWithTemplates();
console.log(groups.length);
console.log(groups[0].layouts.length);
```

### `listThemePresets()`

作用：

- 返回 Presenton 内置主题预设列表。
- 返回结果可直接作为 `renderSlideHtml({ theme })` 的输入来源之一。
- 当前返回的是静态内置主题，不包含用户自定义主题。

输入：

- 无参数。

输出：

- 返回 `ThemePresetInfo[]`

示例：

```ts
import { listThemePresets } from "@presenton-sdk/template-engine";

const themes = listThemePresets();
console.log(themes[0].theme_id);
console.log(themes[0].data.colors.primary);
```

### `renderSlideHtml(input)`

作用：

- 根据模板组、布局 ID 和结构化 `slide_data` 生成完整 HTML 文档字符串。
- 输出结果包含：
  - `<!doctype html>`
  - 固定的 1280x720 渲染容器
  - 模板挂载点 `#presentation-slides-wrapper`
  - 浏览器端渲染脚本
  - Tailwind Play CDN 脚本
- 输出目标是让浏览器或 Puppeteer 直接加载这份 HTML，然后在浏览器环境里完成最终渲染。

输入：

- `template_group: string`
- `layout_id: string`
- `slide_data: Record<string, unknown>`
- 可选：
  - `theme`
  - `speaker_note`
  - `title`

说明：

- `layout_id` 同时支持：
  - 带组前缀：`general:general-intro-slide`
  - 不带组前缀：`general-intro-slide`
- `theme` 兼容两种结构：
  - 轻量结构：`logo_url/company_name/colors/fonts`
  - Presenton 现有结构：`theme.data.colors/theme.data.fonts.textFont`
- 当前 HTML 方案优先保证浏览器/Puppeteer 可直接加载。
- 双击本地打开通常也可预览，但如果外部 CDN、字体、图片资源不可访问，最终显示会受影响。

示例：

```ts
import { renderSlideHtml } from "@presenton-sdk/template-engine";

const html = renderSlideHtml({
  template_group: "general",
  layout_id: "general:general-intro-slide",
  slide_data: {
    title: "Q2 Business Review",
    subtitle: "Generated by Presenton SDK",
  },
  theme: {
    company_name: "Presenton",
    logo_url: "https://example.com/logo.png",
    colors: {
      background: "#FFFFFF",
      background_text: "#111827",
      primary: "#4F46E5",
      graph_0: "#4F46E5",
      graph_1: "#06B6D4",
    },
  },
});

console.log(html);
```

### `buildDeckHtml(input)`

作用：

- 将多个“单页 HTML 文档”合并成一个 deck HTML 文档。
- 输出结果默认兼容 `@presenton-sdk/html-to-pptx-model` 当前的 deck 结构约定。
- 优先支持由 `renderSlideHtml(...)` 生成出来的 HTML。
- 对于结构类似的其他 HTML 文档，也会尽量提取其中可用的 slide 标记并合并。

输入：

- `slides: Array<{ html: string; speaker_note?: string }>`
- 可选：
  - `title`

说明：

- 如果输入 HTML 来自 `renderSlideHtml(...)`，SDK 会提取其中的浏览器渲染上下文，并在 deck 文档中按顺序重新渲染多页 slide。
- 如果输入 HTML 不是 `renderSlideHtml(...)` 产物，SDK 会退化为提取其 `#presentation-slides-wrapper` 或 `body` 中的静态标记并包成一页 slide。
- 这个函数不读取文件路径，只处理 HTML 字符串；这样可以保持 SDK 的纯函数边界。

示例：

```ts
import { buildDeckHtml, renderSlideHtml } from "@presenton-sdk/template-engine";

const slideHtml1 = renderSlideHtml({
  template_group: "general",
  layout_id: "general:general-intro-slide",
  slide_data: {
    title: "Slide 1",
    subtitle: "Deck demo",
  },
});

const slideHtml2 = renderSlideHtml({
  template_group: "general",
  layout_id: "general:table-of-contents-slide",
  slide_data: {
    sections: [
      { number: 1, title: "Overview", pageNumber: "01" },
      { number: 2, title: "Plan", pageNumber: "02" },
    ],
  },
});

const deckHtml = buildDeckHtml({
  title: "Merged deck",
  slides: [{ html: slideHtml1 }, { html: slideHtml2 }],
});
```

### `buildStandaloneDeckHtml(input)`

作用：

- 将多个“独立完整 HTML 文档”合并成一个更适合后续 `html-to-pptx-model` 消费的 deck HTML 文档。
- 与 `buildDeckHtml(...)` 不同，它会尽量隔离每页的样式和脚本，减少外来 HTML 之间的串页污染。
- 适合每页都自带 `<head>/<style>/<script>` 的 HTML 页面，例如第三方生成的 PPT 风格页面。

输入：

- `slides: Array<{ html: string; speaker_note?: string }>`
- 可选：
  - `title`

说明：

- 会保留外链脚本标签，例如 Chart.js。
- 会提取并保留每页的内联脚本，但会按页隔离执行，避免变量相互污染。
- 会对每页 CSS 做作用域前缀处理，并重写 DOM `id`，减少不同页面之间样式冲突。
- 输出结构仍然兼容 `@presenton-sdk/html-to-pptx-model` 当前默认 deck 约定。

示例：

```ts
import { buildStandaloneDeckHtml } from "@presenton-sdk/template-engine";

const standaloneDeckHtml = buildStandaloneDeckHtml({
  title: "Standalone deck",
  slides: [
    { html: standaloneHtml1 },
    { html: standaloneHtml2 },
  ],
});
```

### 输出结构

主要返回结构如下：

```ts
type TemplateGroupSummaryInfo = {
  group_id: string;
  group_name: string;
  group_description: string;
  ordered: boolean;
  default: boolean;
  layout_count: number;
};

type TemplateLayoutInfo = {
  layout_id: string;
  layout_name: string;
  layout_description: string;
  json_schema: Record<string, unknown>;
  sample_data?: Record<string, unknown>;
};

type TemplateGroupInfo = {
  group_id: string;
  group_name: string;
  group_description: string;
  ordered: boolean;
  default: boolean;
  layouts: TemplateLayoutInfo[];
};
```

### 什么时候该用哪个函数

- `listTemplateGroupSummaries()`：适合先获取全部模板组摘要，返回体更小。
- `getAllGroupsWithTemplates()`：适合一次性拉取全部模板组和全部 layouts 详情。
- `getTemplateGroup(groupId)`：适合在选定模板组后，再获取该组完整 layouts 信息。

## 服务端用法

通过 CLI 启动：

```bash
npx presenton-template-engine-server
```

或者在代码里启动：

```ts
import { startTemplateEngineServer } from "@presenton-sdk/template-engine/server";

await startTemplateEngineServer({ port: 3101 });
```

可用接口：

- `GET /healthz`
- `GET /template-groups`
- `GET /themes`
- `GET /template-info?groupId=general`
- `POST /render-slide`

其中：

- `GET /template-groups`：返回模板组摘要列表
- `GET /themes`：返回内置主题预设列表
- `GET /template-info?groupId=general`：返回某一个模板组的完整详情
- `POST /render-slide`：返回渲染后的完整 HTML 文档字符串

`POST /render-slide` 请求示例：

```bash
curl -X POST http://127.0.0.1:3101/render-slide \
  -H 'content-type: application/json' \
  -d '{
    "template_group": "general",
    "layout_id": "general:general-intro-slide",
    "slide_data": {
      "title": "Presenton SDK",
      "subtitle": "Render over HTTP"
    }
  }'
```

## 发布

```bash
npm install
npm run build
npm publish
```

如果你要发布到自己的 scope，下发前先修改 `package.json` 里的 `name`。

## 本地测试

运行针对 `dist` 的 SDK 和服务端 smoke test：

```bash
npm run build
npm test
```

运行针对打包产物 `.tgz` 的真实安装测试：

```bash
npm pack
npm run test:pack
```

你也可以手动指定 tarball 路径：

```bash
node test/smoke-pack-install.mjs ./presenton-sdk-template-engine-0.0.3.tgz
```
