# Red Finance Canvas 组件索引

本目录存放 `red-finance-canvas` 模板组的可复用视觉组件。组件只负责稳定的视觉单元和导出友好的结构；页面级布局、组件编排和数据映射应优先放在 `slides/*.tsx` 中，业务内容数据可以放在 `data/*.json` 中。

`red-finance-canvas` 只提供封面、普通内容页和章节聚焦页三类 canvas 起点。最终页面不应停留在 canvas 占位结构上，而应根据 page plan、受众、证据类型和内容密度组合本目录里的组件。

## 使用原则

- 页面主结构放在 `slides/*.tsx`，不要把整页业务逻辑塞进组件。
- 新页面通常先从 `blueprints/CoverCanvas.tsx`、`blueprints/ContentCanvas.tsx` 或 `blueprints/SectionFocusCanvas.tsx` 选择起点，再复制或派生到 `slides/*.tsx` 中直接替换 slot guide。
- 每页编辑前先根据页面语义选组件家族，不要只填充 canvas 默认字段。
- 多页复用的视觉单元放在 `components/*.tsx`，保持轻量、纯渲染。
- 颜色、字体、阴影等常量优先来自 `theme/tokens.ts`。
- 关键文字保持真实文本节点，避免整块截图化。
- 图表和复杂 SVG 可截图兜底，但旁边的标题、说明、结论仍应保持可编辑文本。

## 组件总览

| 组件 | 分层 | 主要用途 | 常见依赖 |
| --- | --- | --- | --- |
| `FinanceCanvas` | 画布基础 | 固定 1280x720 页面画布、背景、基础字体 | `theme/tokens` |
| `FinanceContentFrame` | 页面框架 | 普通内容页标题、meta、内容区、页脚、页码 | `FinanceCanvas`, `IconText` |
| `FinanceSectionFocusFrame` | 页面框架 | 章节过渡页、战略聚焦页的左右分栏画板 | `FinanceCanvas` |
| `CoverBarDecoration` | 装饰 | 封面右侧金融柱状氛围图 | `theme/tokens` |
| `FinanceIcon` | 基础原语 | 金融主题自包含 SVG 图标 | `theme/tokens` |
| `StableInlineRow` | 基础原语 | 稳定的单行横向对齐 | - |
| `IconText` | 基础原语 | 图标 + 单行文本 | `StableInlineRow` |
| `StatusPill` | 基础原语 | 状态、阶段、风险等级等短标签 | `IconText` |
| `KpiMetricItem` | 基础原语 | 数值 + 指标说明的紧凑 KPI | `StableInlineRow` |
| `FinanceSectionHeading` | 基础原语 | 红色短竖条 + 小节标题 | `theme/tokens` |
| `SectionPanelShell` | 容器壳 | 通用浅色内容面板 | `theme/tokens` |
| `ChartCardShell` | 容器壳 | 图表标题、副标题、标签和内容壳 | - |
| `MeasuredChartArea` | 图表辅助 | 测量容器尺寸后再渲染图表 | `use-resize-observer` |
| `AgendaCard` | 卡片 | 目录页章节卡片 | `FinanceIcon` |
| `InfoListItem` | 卡片 | 图标 + 标题 + 描述的信息条 | `FinanceIcon` |
| `InsightCallout` | 卡片 | 图标 + 关键结论提示条 | `FinanceIcon` |
| `IconTextCard` | 卡片 | 图标文字短卡、总结卡 | `FinanceIcon` |
| `HorizontalFeatureCard` | 卡片 | 横向功能/能力/KPI 说明卡 | `FinanceIcon` |
| `PillarBulletCard` | 卡片 | 编号 + 图标 + 标题 + 多条抓手 | `SectionPanelShell`, `StableInlineRow`, `FinanceIcon` |
| `DualValueMetricCard` | 卡片 | 左右双值对比指标卡 | `IconText` |
| `ProgressStatusCard` | 卡片 | 单主体进度状态卡 | `theme/tokens` |
| `ComparisonPanel` | 卡片 | 多段结构化对比面板 | `IconText` |
| `FinanceBarChart` | 图形 | 金融柱状图 | `Recharts` |
| `FinanceLineChart` | 图形 | 金融折线图 | `Recharts` |
| `FinanceRadarChart` | 图形 | 多系列能力/风险雷达图 | `Recharts` |
| `FinanceDonutChart` | 图形 | SVG 环形占比图 | `theme/tokens` |
| `StableMatrixGrid` | 结构化组件 | 可编辑矩阵/对比表 | `theme/tokens` |
| `TimelineBoard` | 结构化组件 | 横向路线图阶段面板 | `theme/tokens` |
| `VerticalMilestoneTimeline` | 结构化组件 | 纵向里程碑时间线 | `HorizontalFeatureCard` |

## 分层说明

### 1. 页面框架与画布

- `FinanceCanvas` 是最低层画布。封面等特殊页可直接使用；普通内容页不要重复手写画布。
- `FinanceContentFrame` 是普通内容页首选框架，统一标题、右上角 meta、内容区、页脚和页码。
- `FinanceSectionFocusFrame` 用于章节过渡、战略聚焦、主题切换等非标准内容页。
- `CoverBarDecoration` 是封面装饰，不承载真实数据；如果需要真实柱状图，使用 `FinanceBarChart`。

### 2. 基础原语

- `FinanceIcon` 提供金融主题图标，适合按钮、卡片、meta、列表项等辅助视觉。
- `StableInlineRow` 解决导出时单行元素垂直漂移问题，适合 `图标 + 文本`、`数字 + 单位` 等组合。
- `IconText` 是 `图标 + 单行文本` 的语义封装，适合品牌、日期、作者、密级、短标签。
- `StatusPill` 用于状态、阶段、风险等级等短 badge。
- `KpiMetricItem` 用于紧凑 KPI，不负责外层卡片背景。
- `FinanceSectionHeading` 用于内容区小节标题，不用于页面主标题；窄列里可用 `subtitleLayout="stacked"` 让副标题落到标题下方，避免左右挤压。

### 3. 容器壳

- `SectionPanelShell` 是通用浅色面板壳，适合作为复杂卡片或页面局部面板的底座。
- `ChartCardShell` 只负责图表外壳和标题区，不负责具体图表。
- `MeasuredChartArea` 是图表尺寸桥接层，通常放在 `ChartCardShell` 内，再渲染具体图表。

### 4. 卡片组件

- `AgendaCard`：目录项，表达 `编号 + 标题 + 图标`。
- `InfoListItem`：纵向信息列表项，表达 `图标 + 标题 + 描述`。
- `InsightCallout`：单条重点启示或风险提示。
- `IconTextCard`：轻量图标文字卡，适合趋势、要点、总结类短内容。
- `HorizontalFeatureCard`：中密度横向说明卡，适合能力场景、技术应用、架构分层、KPI 摘要。
- `PillarBulletCard`：战略支柱或能力模块卡，内部承载多条 bullet。
- `DualValueMetricCard`：两个主体或两个状态的指标对比。
- `ProgressStatusCard`：单主体进度、成熟度、覆盖度状态。
- `ComparisonPanel`：结构化文本对比，适合国家、渠道、方案、市场等多段比较；面板需要吃满固定高度时可用 `sectionLayout="fill"` 均分 section。

### 5. 图形组件

- `FinanceBarChart`、`FinanceLineChart`、`FinanceRadarChart` 基于 Recharts，只负责图表本体。
- `FinanceDonutChart` 使用 SVG 实现环形占比图，适合市值分布、收入构成、渠道占比等场景。
- 图形组件通常搭配 `ChartCardShell` 和 `MeasuredChartArea` 使用；不要把图表标题、结论段落写进图表组件。

### 6. 结构化组件

- `StableMatrixGrid` 是可编辑矩阵/表格原语，适合竞争对比、能力矩阵、场景映射，不适合大数据表、排序分页表。
- `TimelineBoard` 是横向路线图，适合阶段计划、年度推进、执行路径。
- `VerticalMilestoneTimeline` 是纵向时间叙事，内部复用 `HorizontalFeatureCard`，适合行业发展、政策演进、产品演化。

## Slot 类型与组件家族

`red-finance-canvas` 的 Agent 先选 `blueprints/*.tsx` canvas 起点，再在最终 `slides/*.tsx` 中直接组合组件。组件选择必须从页面语义出发，不要只凭组件名拼接。

| Slot 类型 | 推荐组件家族 | 典型组件 | 不适合 |
| --- | --- | --- | --- |
| `page-title` | `page-shell`, `heading` | `FinanceContentFrame`, `FinanceSectionHeading` | 长正文、图表 |
| `section-heading` | `page-shell`, `heading` | `FinanceSectionFocusFrame`, `FinanceSectionHeading` | KPI 网格、大表格 |
| `narrative-text` | `card`, `heading` | `InfoListItem`, `InsightCallout`, `HorizontalFeatureCard` | 图表本体、时间线连接线 |
| `bullet-list` | `card` | `PillarBulletCard`, `InfoListItem`, `HorizontalFeatureCard` | 超过 4 条 bullet 的长列表 |
| `metric` | `primitive`, `kpi`, `card` | `KpiMetricItem`, `DualValueMetricCard`, `ProgressStatusCard` | 长解释文本 |
| `kpi-strip` | `primitive`, `kpi` | `KpiMetricItem`, `DualValueMetricCard` | 多段叙事 |
| `chart` | `chart` | `ChartCardShell`, `MeasuredChartArea`, `FinanceBarChart`, `FinanceLineChart` | 非数据装饰 |
| `matrix` | `matrix` | `StableMatrixGrid` | 纯趋势图、长段正文 |
| `comparison` | `matrix`, `card` | `StableMatrixGrid`, `ComparisonPanel`, `DualValueMetricCard` | 单一观点页 |
| `timeline` | `timeline` | `TimelineBoard`, `VerticalMilestoneTimeline` | 无先后顺序的分类 |
| `callout` | `card` | `InsightCallout`, `SectionPanelShell` | 大段正文 |
| `decoration` | `decoration` | `CoverBarDecoration` | 承载关键事实 |
| `footer-meta` | `page-shell`, `primitive` | `FinanceContentFrame`, `IconText` | 正文内容 |

## 组件边界

| 组件 | 适合 slot | 不适合 slot | 文本容量 | 截图策略 | 跨页复用 |
| --- | --- | --- | --- | --- | --- |
| `FinanceCanvas` | `page-title`, `decoration` | `narrative-text`, `chart` | 不承载正文 | 不整页截图 | 是 |
| `FinanceContentFrame` | `page-title`, `footer-meta` | `chart`, `matrix` | 标题 28 字以内 | 框架不单独截图 | 是 |
| `FinanceSectionFocusFrame` | `section-heading` | `metric`, `matrix` | 标题 32 字以内，导语 96 字以内 | 框架不单独截图 | 是 |
| `FinanceSectionHeading` | `section-heading`, `narrative-text` | `bullet-list`, `chart` | 标题 28 字以内 | 必须保持文本 | 是 |
| `IconText` | `footer-meta`, `metric` | `narrative-text` | 单行 80 字以内 | 必须保持文本 | 是 |
| `InfoListItem` | `narrative-text`, `bullet-list` | `chart`, `matrix` | 标题 28 字以内，正文 96 字以内 | 必须保持文本 | 是 |
| `InsightCallout` | `callout`, `narrative-text` | `chart`, `matrix` | 120 字以内 | 必须保持文本 | 是 |
| `IconTextCard` | `card`, `bullet-list` | `chart`, `timeline` | 标题 24 字以内，正文 84 字以内 | 必须保持文本 | 是 |
| `HorizontalFeatureCard` | `card`, `actions`, `timeline` | `chart` | 标题 28 字以内，正文 96 字以内 | 必须保持文本 | 是 |
| `PillarBulletCard` | `bullet-list`, `card` | `chart`, `timeline` | 4 条 bullet 以内 | 必须保持文本 | 是 |
| `DualValueMetricCard` | `metric`, `comparison` | `narrative-text` | 双值 + 短标签 | 数值必须保持文本 | 是 |
| `ProgressStatusCard` | `metric`, `kpi-strip` | `narrative-text` | 标题 24 字以内 | 进度条可截图，文字保留 | 是 |
| `ComparisonPanel` | `comparison`, `narrative-text` | `chart`, `timeline` | 4 段以内 | 必须保持文本 | 是 |
| `ChartCardShell` | `chart` | `narrative-text` | 标题 36 字以内 | 图表区域可截图 | 是 |
| `MeasuredChartArea` | `chart` | 其他 slot | 不承载文本 | 可截图 | 是 |
| `FinanceBarChart` / `FinanceLineChart` / `FinanceRadarChart` / `FinanceDonutChart` | `chart` | `narrative-text` | 标签短文本 | 图表本体可截图 | 是 |
| `StableMatrixGrid` | `matrix`, `comparison` | `chart`, `timeline` | 6 行以内，单元格短文本 | 尽量保持文本 | 是 |
| `TimelineBoard` / `VerticalMilestoneTimeline` | `timeline` | `matrix`, `chart` | 6 阶段以内 | 连接线可截图，文字保留 | 是 |
| `CoverBarDecoration` | `decoration` | 任何事实 slot | 不承载文本 | 可截图 | 是 |

## 依赖关系

常见组合方式：

```text
FinanceCanvas
├─ FinanceContentFrame
│  └─ IconText
│     └─ StableInlineRow
└─ FinanceSectionFocusFrame

ChartCardShell
└─ MeasuredChartArea
   ├─ FinanceBarChart
   ├─ FinanceLineChart
   ├─ FinanceRadarChart
   └─ FinanceDonutChart

SectionPanelShell
└─ PillarBulletCard
   └─ StableInlineRow

HorizontalFeatureCard
└─ VerticalMilestoneTimeline

IconText
├─ StatusPill
├─ DualValueMetricCard
└─ ComparisonPanel
```

依赖选择规则：

- 需要整页框架：先选 `FinanceContentFrame` 或 `FinanceSectionFocusFrame`。
- 需要稳定单行对齐：先选 `StableInlineRow`，有明确图标文本语义时选 `IconText`。
- 需要图表：`ChartCardShell` 负责外壳，`MeasuredChartArea` 负责尺寸，具体图表只负责绘制。
- 需要卡片：优先复用已有卡片；只有出现新的稳定语义时才新增组件。
- 需要表格/矩阵：优先用 `StableMatrixGrid`，不要在 slide 中临时拼一套表格样式。

## AI 修改规则

- 改某一页的布局、列宽、数据映射：优先改 `slides/*.tsx`。
- JSON 只能解决内容替换，不能解决结构不合适、越界或组件组合错误。
- 改某一页的默认内容：优先改 `data/*.json` 和对应 `Schema`。
- 改多个页面共享的视觉单元：再改 `components/*.tsx`。
- 改颜色、字体、阴影、边框：优先改 `theme/tokens.ts`。
- 不要在组件里硬编码业务文案，默认内容应来自 slide schema 或 data。
- 不要新增与 `IconTextCard`、`HorizontalFeatureCard`、`PillarBulletCard`、`StableMatrixGrid` 语义高度重叠的特化组件。
- 多行正文不要塞进 `StableInlineRow`；它只适合单行稳定对齐。
- 纯装饰可以截图化；核心标题、表格文字、KPI 数值和说明文字应保持可编辑。
