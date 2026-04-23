# PPT Render Export

这个 skill 只负责 deck 进入渲染、审阅、模型生成和最终导出的后半段流程。

它负责回答的问题是：

- 什么时候可以生成 HTML
- 为什么 HTML 必须先成为正式审阅稿
- HTML 审阅通过后，如何进入 model 和 PPTX 阶段
- 每个阶段应该产出什么文件
- 每个阶段应该检查什么风险信号

它不负责：

- 模板选择
- `manifest.json` 的装配规则
- TSX 的编写细节
- 工具参数全表
- 未完成能力的校验工作流

如需这些内容，分别加载：

- `ppt-workflow`
- `ppt-template-selection`
- `ppt-manifest-rules`
- `ppt-tsx-rules`
- `ppt-tsx-export-safety`
- `ppt-tool-reference`

参数名、返回字段和具体调用形态，以 `ppt-tool-reference` 为准。

本 skill 只定义：

1. 何时进入渲染与导出阶段
2. 每个阶段的门禁
3. 阶段之间的先后顺序
4. 每个阶段应记录哪些产物与风险

## 一、适用时机

在以下场景应加载本 skill：

1. deck 源定义已经完成，准备生成 HTML
2. 需要把 HTML 作为正式审阅稿交给用户确认
3. HTML 已确认，准备生成 PPTX 中间模型 JSON
4. 已有模型 JSON，准备生成最终 `.pptx`
5. 需要检查渲染与导出阶段的产物是否完整

## 二、当前标准链路

当前标准链路是：

```text
manifest.json
  -> ppt-engine.buildDeckHtmlFromManifest
  -> deck HTML（标准输入应是整套 deck 的 `deck_output_path`）
  -> 用户审阅确认
  -> ppt-engine.convertDeckHtmlToPptxModel
  -> model JSON
  -> ppt-gener.generatePptx
  -> final `.pptx`
```

结论：

1. `ppt-engine` 负责 `manifest -> HTML -> model`
2. `ppt-gener` 负责 `model -> .pptx`
3. 当前标准工作流里没有独立的 `ppt-model`

## 三、总门禁

必须严格遵守以下门禁：

1. deck 源定义未完成，不得生成正式 HTML 审阅稿
2. HTML 未获得用户确认，不得生成 model JSON
3. model JSON 未成功生成，不得生成最终 PPTX
4. 任一阶段失败时，不得跳过失败阶段强行继续

最重要的规则是：

1. HTML 是正式审阅稿，不是临时副产物
2. HTML 审阅通过，才允许进入导出阶段

## 四、阶段 1：生成 HTML 审阅稿

### 1. 前置条件

在生成 HTML 前，至少应满足：

1. 模板组已经确认
2. 工作副本已经准备好
3. `manifest.json` 已完成当前轮装配
4. 若本轮任务涉及 TSX，相关 TSX 已完成当前轮修改

### 2. 使用的工具

应调用：

1. `ppt-engine.buildDeckHtmlFromManifest`

### 3. 标准做法

默认应生成整套 deck HTML，而不是只生成单页。

原因：

1. 用户需要审阅整套 deck 的结构、页序和风格一致性
2. 单页模式只适合定点排查，不适合正式交付前确认

因此：

1. 正式审阅阶段默认使用整套 deck 模式
2. `single_page=true` 只用于局部排查或快速回归某一页

### 4. 这一阶段的主要产物

`buildDeckHtmlFromManifest` 通常会产出：

1. 整份 deck HTML
2. 每一页单独的 HTML 文件

应重点记录：

1. `deck_output_path`
2. `deck_generated`
3. `output_dir`
4. `slide_files`
5. `slide_count`
6. `manifest_path`

需要特别注意：

1. 正式导出链路里，后续 `html_path` 应优先直接使用这里的 `deck_output_path`
2. 如果本次调用是 `single_page=true`，则 `deck_generated` 可能为 `false`
3. 当 `deck_generated=false` 时，这次结果只能用于局部排查，不能直接当成整套 deck 的正式导出输入

### 5. HTML 审阅应该确认什么

向用户展示 HTML 审阅稿时，至少要围绕这些点确认：

1. 结构是否正确
2. 每页内容是否正确
3. 文案是否需要调整
4. 页面顺序是否合理
5. 哪些页面需要重做
6. 视觉表达是否达到预期
7. 是否仍有明显的布局失衡或信息拥挤问题

### 6. HTML 阶段失败时怎么处理

HTML 构建失败时，优先回退排查：

1. `manifest.json`
2. 页面入口
3. 工作副本结构
4. 本地 slide 路径
5. 依赖是否已准备完成

不要在 HTML 构建失败时直接跳到 model 或 PPTX 阶段。

## 五、阶段 2：HTML 审阅

HTML 审阅不是走流程式地“看一眼继续”，而是正式门禁。

### 1. 必须确认后才能继续

只有在用户明确表示：

1. HTML 可以进入导出阶段
2. 不需要继续修改结构或内容

时，才允许进入 model 阶段。

### 2. 如果用户提出修改

如果用户反馈会影响以下任一项，就必须回退：

1. 页面顺序
2. 页面内容
3. 页面来源
4. 页面结构
5. 模板选择
6. TSX 布局实现

回退后：

1. 修改 deck 源定义
2. 重新生成 HTML
3. 再次进入审阅

## 六、阶段 3：生成 model JSON

### 1. 前置条件

必须同时满足：

1. HTML 已成功生成
2. 用户已明确确认 HTML 可以进入导出阶段

### 2. 使用的工具

应调用：

1. `ppt-engine.convertDeckHtmlToPptxModel`

### 3. 输入与输出

这一步读取的是：

1. `html_path`
   - 标准情况下，应直接使用上一阶段返回的 `deck_output_path`

这一步产出的是：

1. `output_path` 对应的 model JSON

不要混淆：

1. 这一步的输入不是 manifest
2. 这一步的标准输入是已经生成好的整套 deck HTML
3. 单页 HTML 只适合局部排查，不应替代正式导出时的 `html_path`

### 4. `screenshots_dir` 的使用建议

如果需要保留导出排查信息，通常应显式提供：

1. `screenshots_dir`

原因：

1. 它能帮助保留模型提取阶段的截图兜底相关产物
2. 便于后续排查哪些区域可能被栅格化或截图化处理

但也要避免误判：

1. 提供了 `screenshots_dir` 不代表一定发生了严重失真
2. 目录中存在截图类产物时，应把它当成风险信号，而不是自动判定整套导出失败

### 5. 这一阶段应记录的结果

至少记录：

1. `output_path`
2. `html_path`
3. `slide_count`
4. `name`
5. `screenshots_dir`

### 6. 这一阶段的环境前提

这一步运行时通常需要本机存在可用的：

1. Chrome
2. 或 Chrome for Testing

如果这里失败，优先排查浏览器环境，而不是急着修改 deck 内容。

### 7. model 阶段失败时怎么处理

优先排查：

1. `html_path` 是否正确
2. HTML 是否完整
3. 浏览器环境是否可用
4. 页面结构是否过于复杂
5. 是否有明显不稳定的视觉写法

## 七、阶段 4：生成最终 PPTX

### 1. 前置条件

必须同时满足：

1. model JSON 已成功生成
2. `model_path` 可读
3. 输出路径可写

### 2. 使用的工具

应调用：

1. `ppt-gener.generatePptx`

### 3. 输入与输出

输入：

1. `model_path`

输出：

1. `output_path` 对应的 `.pptx`

不要混淆：

1. 这一步不读取 manifest
2. 这一步不读取 deck HTML
3. 它只负责 `model -> .pptx`

### 4. 这一阶段应记录的结果

通常应记录：

1. `path`
2. `filename`
3. `format`
4. `slide_count`
5. `presentation_name`

### 5. PPTX 阶段失败时怎么处理

优先排查：

1. `model_path` 是否正确
2. model JSON 是否完整
3. 输出路径是否可写
4. 是否存在底层生成器依赖问题

## 八、标准产物清单

一次完整导出后，至少应存在以下产物：

1. deck HTML
2. 单页 HTML 文件集合
3. model JSON
4. 最终 `.pptx`

按 `ppt-workflow` 的目录约定，中间产物通常留在 `RUN_DIR`，最终交付物通常写到 `DELIVERABLES_DIR`。

结构上通常可以理解为：

```text
RUN_DIR/
  engine/
    <name>-deck.html
    ...
  model/
    <name>-model.json
    screenshots/

DELIVERABLES_DIR/
  <name>.pptx
```

## 九、默认策略与例外

### 默认策略

1. 正式审阅稿默认生成整套 deck HTML
2. HTML 通过前，不生成 model 和 PPTX
3. model 阶段默认保留足够的排查产物
4. 最终交付前，确认文件真实存在

### 例外策略

以下情况可以只跑单页 HTML：

1. 长 deck 中只定点排查某一页
2. 已确认整套 deck，只回归某页局部改动
3. 当前只是验证某个 layout 的局部问题

但即使如此：

1. 正式导出前仍应回到整套 deck 的正式 HTML 审阅

## 十、风险信号

渲染与导出阶段至少要关注这些风险：

### 1. 页数不一致

如果出现：

1. HTML 页数
2. model 页数
3. PPTX 页数

三者明显不一致，就必须停下来排查。

### 2. 截图 / 栅格化风险

如果模型提取阶段保留了截图相关产物，或日志表明某些区域通过截图兜底处理，应向用户说明：

1. 哪些区域可能不再是完全可编辑文本
2. 哪些图形可能是栅格化结果

不要把这类风险静默吞掉。
也不要仅凭“存在截图目录”就自动判定最终结果不可交付；关键是判断它是否影响用户要求的可编辑性和视觉准确度。

### 3. HTML 正常但 PPTX 失真

如果 HTML 预览正常，但 PPTX 结果明显偏差，优先怀疑：

1. TSX 导出兼容性问题
2. 图形主导模块未正确截图
3. 关键文本使用了不稳定样式

此时应回到：

1. `ppt-tsx-rules`
2. `ppt-tsx-export-safety`

重新修正页面源定义。

## 十一、禁止事项

1. 不要在 HTML 未确认前直接生成 PPTX
2. 不要把 model JSON 当成主要审阅稿
3. 不要把单页调试模式当成整套 deck 正式确认
4. 不要在失败阶段跳步强行继续
5. 不要把未完成的校验能力写进当前标准工作流

## 十二、最终汇报应包含什么

一次完整导出成功后，至少应向用户汇报：

1. HTML 路径
2. model JSON 路径
3. 最终 PPTX 路径
4. 页数信息
5. 当前已知风险
6. 是否存在截图兜底或未验证项

## 十三、最终记忆

渲染与导出的正确顺序必须始终是：

```text
先生成 HTML
  -> 先做 HTML 审阅
  -> HTML 通过后再生成 model
  -> model 成功后再生成 PPTX
```

这条链路的核心不是“尽快导出”，而是“先让 deck 以 HTML 形式被正确审阅，再把已经确认过的内容推进到最终 PPTX”。
