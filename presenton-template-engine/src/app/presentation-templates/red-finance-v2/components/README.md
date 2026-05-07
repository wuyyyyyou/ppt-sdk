# Red Finance V2 组件索引

本目录存放 `red-finance-v2` 模板组的可复用视觉组件。组件只负责稳定的视觉单元和导出友好的结构；页面级布局、业务文案和数据默认值应优先放在 `slides/*.tsx` 与 `data/*.json` 中。

## 使用原则

- 页面主结构放在 `slides/*.tsx`，不要把整页业务逻辑塞进组件。
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
- `FinanceSectionHeading` 用于内容区小节标题，不用于页面主标题。

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
- `ComparisonPanel`：结构化文本对比，适合国家、渠道、方案、市场等多段比较。

### 5. 图形组件

- `FinanceBarChart`、`FinanceLineChart`、`FinanceRadarChart` 基于 Recharts，只负责图表本体。
- `FinanceDonutChart` 使用 SVG 实现环形占比图，适合市值分布、收入构成、渠道占比等场景。
- 图形组件通常搭配 `ChartCardShell` 和 `MeasuredChartArea` 使用；不要把图表标题、结论段落写进图表组件。

### 6. 结构化组件

- `StableMatrixGrid` 是可编辑矩阵/表格原语，适合竞争对比、能力矩阵、场景映射，不适合大数据表、排序分页表。
- `TimelineBoard` 是横向路线图，适合阶段计划、年度推进、执行路径。
- `VerticalMilestoneTimeline` 是纵向时间叙事，内部复用 `HorizontalFeatureCard`，适合行业发展、政策演进、产品演化。

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
- 改某一页的默认内容：优先改 `data/*.json` 和对应 `Schema`。
- 改多个页面共享的视觉单元：再改 `components/*.tsx`。
- 改颜色、字体、阴影、边框：优先改 `theme/tokens.ts`。
- 不要在组件里硬编码业务文案，默认内容应来自 slide schema 或 data。
- 不要新增与 `IconTextCard`、`HorizontalFeatureCard`、`PillarBulletCard`、`StableMatrixGrid` 语义高度重叠的特化组件。
- 多行正文不要塞进 `StableInlineRow`；它只适合单行稳定对齐。
- 纯装饰可以截图化；核心标题、表格文字、KPI 数值和说明文字应保持可编辑。
