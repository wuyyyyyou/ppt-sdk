# PPT Tool Reference

这个 skill 只负责说明当前 PPT 工具链的可用工具、子能力、参数形态、返回结果和调用约束。

它是工具事实表，不负责：

- 定义整体工作流
- 定义用户确认门禁
- 解释 `manifest.json` 结构细则
- 解释 TSX 写法与导出稳定性规约

如需这些内容，分别加载：

- `ppt-workflow`
- `ppt-template-selection`
- `ppt-manifest-rules`
- `ppt-tsx-rules`
- `ppt-tsx-export-safety`
- `ppt-render-export`

本 skill 只覆盖当前标准工作流中应使用的能力。

## 一、当前工具总览

当前标准工作流只使用两个工具：

### 1. `ppt-engine`

负责：

- 模板发现
- 模板组详情读取
- fork 内置模板组到本地工作目录
- 从 `manifest.json` 生成 deck HTML
- 从 deck HTML 生成 PPTX 中间模型 JSON

当前标准工作流中应使用的子能力：

- `listDiscoveredTemplateGroupSummaries`
- `getAllDiscoveredTemplateGroups`
- `getDiscoveredTemplateGroup`
- `forkTemplateGroup`
- `buildDeckHtmlFromManifest`
- `convertDeckHtmlToPptxModel`

### 2. `ppt-gener`

负责：

- 从 PPTX 中间模型 JSON 生成最终 `.pptx`

当前只暴露一个子能力：

- `generatePptx`

## 二、全局调用规则

1. 文件路径参数应统一传绝对路径。
2. 如果必须传相对路径，应同时提供正确的 `cwd`。
3. 在当前标准工作流里，不再使用独立的 `ppt-model` 工具。
4. 在当前标准工作流里，`buildDeckHtmlFromManifest` 必须使用 `manifest_path`，不要再传 `manifest` 对象。
5. discovery 相关工具的 `local_roots` 应优先传真正的数组，不要依赖字符串化数组。
6. 若只做标准流程，应按以下顺序使用：
   - discovery
   - `forkTemplateGroup`
   - `buildDeckHtmlFromManifest`
   - `convertDeckHtmlToPptxModel`
   - `generatePptx`

## 三、`ppt-engine` 参考

### 1. `listDiscoveredTemplateGroupSummaries`

用途：

- 获取模板组摘要列表
- 适合作为模板筛选第一步
- 返回体比全量详情更小

推荐使用场景：

- 先筛模板组
- 不想一开始展开所有 layout 细节

参数：

- `include_builtin`
  - 类型：`boolean`
  - 必填：否
  - 默认：`true`
  - 含义：是否包含内置模板组

- `local_roots`
  - 类型：`string[]`
  - 必填：否
  - 含义：额外参与发现的本地模板根目录列表

- `cwd`
  - 类型：`string`
  - 必填：否
  - 含义：解析本地模板路径时使用的工作目录

返回：

- `groups`
  - 模板组摘要数组
- `count`
  - 摘要数量

注意：

1. 这是模板发现第一步，不返回完整 layout 细节。
2. `local_roots` 实际上兼容字符串形式的 JSON 数组，但这只是兼容行为，正常调用时应传真实数组。

### 2. `getAllDiscoveredTemplateGroups`

用途：

- 获取全部已发现模板组及其完整 layout 详情

推荐使用场景：

- 确实需要全量深度比较多个模板组时

参数：

- `include_builtin`
  - 类型：`boolean`
  - 必填：否
  - 默认：`true`

- `local_roots`
  - 类型：`string[]`
  - 必填：否

- `cwd`
  - 类型：`string`
  - 必填：否

返回：

- `groups`
  - 全量模板组详情数组
- `count`
  - 模板组数量

注意：

1. 返回体可能较大，不应作为默认第一步。
2. 常规流程应先调用 `listDiscoveredTemplateGroupSummaries`，只有必要时再调用这个能力。

### 3. `getDiscoveredTemplateGroup`

用途：

- 获取单个模板组的完整详情

推荐使用场景：

- 已经有候选模板组 id，需要进一步看 layout 细节

参数：

- `group_id`
  - 类型：`string`
  - 必填：是
  - 含义：要查询的模板组 id

- `include_builtin`
  - 类型：`boolean`
  - 必填：否
  - 默认：`true`

- `local_roots`
  - 类型：`string[]`
  - 必填：否

- `cwd`
  - 类型：`string`
  - 必填：否

返回：

- `group`
  - 模板组详情对象；未找到时通常为 `null`
- `found`
  - 是否找到目标模板组

注意：

1. 这是常规模板选择第二步。
2. 应先通过摘要筛候选，再通过这个能力读取候选详情。

### 4. `forkTemplateGroup`

用途：

- 把一个内置模板组 fork 到目标工作目录
- 生成可继续编辑的本地模板工程

生成内容通常包括：

- `slides/*.tsx`
- `group.json`
- `manifest.json`
- `package.json`
- `tsconfig.json`

参数：

- `template_group`
  - 类型：`string`
  - 必填：是
  - 含义：要 fork 的内置模板组 id，例如 `general`、`red-finance`

- `out_dir`
  - 类型：`string`
  - 必填：是
  - 含义：fork 输出目录

- `manifest_title`
  - 类型：`string`
  - 必填：否
  - 含义：写入新 `manifest.json` 的标题

- `overwrite`
  - 类型：`boolean`
  - 必填：否
  - 默认：`false`
  - 含义：是否覆盖非空输出目录

- `install_dependencies`
  - 类型：`boolean`
  - 必填：否
  - 默认：`false`
  - 含义：是否在 fork 后于目标目录执行依赖安装

- `cwd`
  - 类型：`string`
  - 必填：否
  - 含义：当 `out_dir` 是相对路径时，用于解析输出目录

返回：

- fork 结果主体
- `template_group`
  - 实际 fork 的模板组 id
- `dependencies_installed`
  - 是否已安装依赖
- `install_command`
  - 若进行了依赖安装，对应的安装命令
- `package_lock_path`
  - 锁文件路径；没有时可能为空
- `node_modules_path`
  - `node_modules` 路径；没有时可能为空
- `manifest_slide_count`
  - fork 后 manifest 中的 slide 数量

使用建议：

1. 常规工作流里，选定模板组后再调用。
2. 如果后续会立即在工作副本里生成 HTML，通常应优先考虑 `install_dependencies=true`。
3. 这个能力 fork 的是内置模板组，不是任意本地自定义模板组。

### 5. `buildDeckHtmlFromManifest`

用途：

- 根据 `manifest.json` 生成整份 deck HTML
- 同时输出每一页单独的 HTML 文件

重要变化：

1. 当前标准调用方式只支持 `manifest_path`，不再支持直接传 `manifest` 对象。
2. 这个工具返回的是产物路径与摘要信息，不是大段 HTML 字符串。

参数：

- `manifest_path`
  - 类型：`string`
  - 必填：是
  - 含义：`manifest.json` 文件路径

- `cwd`
  - 类型：`string`
  - 必填：否
  - 含义：解析 `manifest_path` 和相对输出路径时使用的工作目录

- `output_dir`
  - 类型：`string`
  - 必填：是
  - 含义：生成 deck HTML 与单页 HTML 的输出目录

- `name`
  - 类型：`string`
  - 必填：否
  - 含义：输出文件基础名；未传时通常回退到 `manifest.title` 的安全文件名

- `single_page`
  - 类型：`boolean`
  - 必填：否
  - 默认：`false`
  - 含义：是否只生成单页 HTML

- `page`
  - 类型：`integer`
  - 必填：否
  - 含义：当 `single_page=true` 时，指定要生成的页码
  - 规则：页码是 1-based

返回：

- `output_dir`
  - 实际输出目录
- `deck_output_path`
  - 生成整份 deck HTML 时的文件路径；若未生成整份 deck，则可能为 `null`
- `deck_file_name`
  - deck HTML 文件名；未生成整份 deck 时可能为 `null`
- `deck_generated`
  - 是否生成了整份 deck HTML
- `single_page`
  - 本次是否为单页模式
- `page`
  - 本次页码
- `slide_files`
  - 单页 HTML 文件数组，每项包括：
    - `file_name`
    - `output_path`
    - `slide_id`
    - `layout_id`
- `slide_count`
  - 页数
- `title`
  - deck 标题
- `manifest_path`
  - 实际使用的 manifest 路径

使用建议：

1. 标准审阅稿通常应生成整份 deck HTML，而不是只生成单页。
2. 若只是定点排查单页，可使用 `single_page=true` + `page=<1-based 页码>`。
3. 如果 deck 中包含本地 TSX slide，`cwd` 应指向工作副本根目录。

### 6. `convertDeckHtmlToPptxModel`

用途：

- 把已渲染完成的 deck HTML 转换为 `PptxPresentationModel` JSON
- 把模型 JSON 写入指定路径

参数：

- `html_path`
  - 类型：`string`
  - 必填：是
  - 含义：deck HTML 文件路径

- `output_path`
  - 类型：`string`
  - 必填：是
  - 含义：模型 JSON 输出路径

- `cwd`
  - 类型：`string`
  - 必填：否
  - 含义：解析相对输入输出路径时的工作目录

- `name`
  - 类型：`string`
  - 必填：否
  - 含义：写入模型中的 presentation name

- `settle_time_ms`
  - 类型：`integer`
  - 必填：否
  - 含义：页面 render-ready 之后，正式提取 DOM 前额外等待的毫秒数

- `screenshots_dir`
  - 类型：`string`
  - 必填：否
  - 含义：截图兜底资源输出目录

返回：

- `output_path`
  - 生成的模型 JSON 路径
- `html_path`
  - 实际读取的 deck HTML 路径
- `slide_count`
  - 模型中的 slide 数量
- `name`
  - 模型中的 presentation name
- `screenshots_dir`
  - 实际使用的截图目录；未使用时为 `null`

使用建议：

1. 这一步读取的是 HTML 文件，不是 manifest。
2. 常规工作流中，这一步应在 HTML 审阅通过后执行。
3. 如果需要保留截图兜底产物用于排查，应显式提供 `screenshots_dir`。
4. 运行时需要本机存在可用的 Chrome 或 Chrome for Testing 环境。

## 四、`ppt-gener` 参考

### `generatePptx`

用途：

- 读取 `PptxPresentationModel` JSON 文件
- 生成最终 `.pptx`

参数：

- `model_path`
  - 类型：`string`
  - 必填：是
  - 含义：模型 JSON 文件路径

- `output_path`
  - 类型：`string`
  - 必填：是
  - 含义：最终 `.pptx` 输出路径

- `cwd`
  - 类型：`string`
  - 必填：否
  - 含义：解析相对输入输出路径时的工作目录

返回：

- 结构化结果对象，通常包含：
  - `path`
  - `filename`
  - `format`
  - `slide_count`
  - `presentation_name`

注意：

1. 这一步不会返回二进制文件内容。
2. 它只负责 `model -> .pptx`，不负责模板发现、HTML 渲染或 HTML 编译。

## 五、推荐调用顺序

### 模板选择阶段

1. `listDiscoveredTemplateGroupSummaries`
2. `getDiscoveredTemplateGroup`
3. 只有必要时才 `getAllDiscoveredTemplateGroups`

### 创建工作副本阶段

1. `forkTemplateGroup`

### HTML 阶段

1. `buildDeckHtmlFromManifest`

### 模型阶段

1. `convertDeckHtmlToPptxModel`

### 最终导出阶段

1. `generatePptx`

## 六、常见误用

1. 不要再按旧链路寻找 `ppt-model`。
2. 不要给 `buildDeckHtmlFromManifest` 传 `manifest` 对象；应传 `manifest_path`。
3. 不要把 `buildDeckHtmlFromManifest` 的输出理解成 HTML 字符串；应读取其返回的输出路径。
4. 不要把 `convertDeckHtmlToPptxModel` 的输入写成 manifest 路径；它需要的是 `html_path`。
5. 不要把 `generatePptx` 的输入写成 HTML 路径；它需要的是 `model_path`。
6. 不要默认用 `getAllDiscoveredTemplateGroups` 作为第一步。
7. 不要把 `page` 当成 0-based；单页模式页码是 1-based。
8. 不要依赖字符串化数组来传 `local_roots`；正常情况下应传真正的数组。

## 七、工具分工总记忆

可以始终按这条线理解：

```text
ppt-engine:
  选模板 -> fork 工作目录 -> manifest -> deck HTML -> model JSON

ppt-gener:
  model JSON -> .pptx
```
