# Chart Analytics Canvas 组件索引

本目录完整迁移自 `the original Dark Analytics Charts components`，用于 `chart-analytics-canvas` 的 component-first / canvas-first 生成流程。组件保留原模板的深色分析封面、浅色内容画布、蓝/青/靛色强调、卡片化图表、对比矩阵、时间线和图片证据展示能力。

`chart-analytics-canvas` 的蓝图只提供大方向 canvas。最终页面不应停留在占位结构上，而应由 AI Agent 根据页面意图在 `slides/*.tsx` 中组合本目录组件。

## 使用原则

- 先选 `blueprints/*.tsx` canvas，再在 `slides/*.tsx` 中替换 slot guide。
- 页面主结构、组件编排、列宽、数据映射放在 `slides/*.tsx`。
- JSON 只放内容数据，不放“用哪个组件、几列布局、slot 属于谁”这类页面结构决策。
- 不要把 source HTML、`the original Dark Analytics Charts template` 的具体业务页面、或未清理的整页截图硬塞进 canvas。
- 标题、KPI 数值、矩阵文字、时间线事件、图表标题、来源说明必须尽量保持真实文本节点。
- 图表本体可以使用组件内既有截图导出边界；图表外的解释、legend、结论仍保持可编辑文本。
- 颜色、字体、阴影等视觉语言优先来自 `theme/tokens.ts`。

## Canvas 到组件的工作流

1. `CoverCanvas`：保留暗色背景、series label、headline、meta footer；在视觉 slot 中放证据图、轻量 KPI、范围标签或报告主题视觉。
2. `ContentCanvas`：普通内容页默认起点；主体 slot 可组合卡片、KPI、图片、矩阵、表格式说明或短叙事。
3. `ComparisonCanvas`：两实体或三实体比较；每个 lane 用指标卡、矩阵、图片证据或小图表保持可比性。
4. `ChartEvidenceCanvas`：主图表、主图片、时间线或证据锚点页面；左侧放一个主视觉，右侧放解释、source caveat 和行动含义。
5. `ClosingCanvas`：低密度 thank-you/contact/next-step；不要塞入新分析。

## 组件总览

| Module | 类型 | 主要用途 | 适用 slot |
| --- | --- | --- | --- |
| `AnalyticsCanvas` | 页面框架 | 固定 1280x720 画布、深色/浅色背景和基础字体 | `page-shell` |
| `DarkAnalyticsBackdrop` | 背景层 | 图片洗底、深色遮罩、蓝色叠色和顶部强调线 | `dark-background` |
| `ExpandedLabel` | 标题原语 | PPT-safe 大字距 eyebrow / 系列标签 | `eyebrow-label` |
| `ComparisonDivider` | 标题原语 | PPT-safe `vs` 对比分隔行 | `comparison-divider` |
| `ComparisonHeroTitle` | 标题组合 | 上下双主体大标题 + divider | `comparison-title` |
| `ReportMetaFooter` | 页脚原语 | 暗色页左/右元信息 | `footer-meta` |
| `ExecutiveHeader` | 内容页页眉 | 深色报告页眉、eyebrow、标题、右侧元信息和图标 | `body-header` |
| `AnalyticsSourceFooter` | 内容页脚 | 来源、保密标签、页码 | `source-footer` |
| `AnalyticsCardShell` | 卡片容器 | 白色或深色分析卡片、边框、阴影、顶部强调色 | `card-shell` |
| `MetricHighlightCard` | 指标组合 | 大数字 KPI + 进度条、双值块或状态徽章 | `metric-card` |
| `ProgressMeter` | 度量原语 | 固定高度进度条 | `metric`, `status` |
| `StatusBadge` | 状态原语 | 短状态标签 | `badge` |
| `ChartPanelShell` | 图表容器 | 图表标题、副标题、legend 和稳定内容区 | `chart-shell` |
| `AnalyticsGroupedBarChart` | 图表组件 | 分组柱状图，自带截图导出边界 | `chart` |
| `AnalyticsLineChart` | 图表组件 | 多系列折线图，自带截图导出边界 | `chart` |
| `AnalyticsDonutChart` | 图表组件 | 环形构成图，自带截图导出边界 | `composition-donut` |
| `AnalyticsImageShowcasePanel` | 图片展示 | 主图片、标题、说明、来源、加载失败占位 | `image-showcase` |
| `TrendStatCard` | 指标组合 | 主体标签、状态徽章、两项关键指标和短解释 | `trend-stat-card` |
| `DarkInsightCard` | 深色洞察卡 | 标签、标题、短解释和背景图标水印 | `dark-insight-panel` |
| `StructureLegendBar` | 图例组合 | 居中胶囊图例，可编辑 label 文本 | `legend` |
| `StructureComparisonCard` | 指标+图表组合 | 实体身份、总量、环形结构图、底部强调指标 | `composition-comparison` |
| `AnalyticsIcons` | 图标原语 | 当前主题线性图标集合 | `icon` |
| `OutlookPanel` | 深色洞察面板 | 时间段列表 + 底部进度指标 | `dark-insight-panel` |
| `CircularComparisonMetricCard` | 双主体环形指标卡 | 一个指标下两组环形进度和结论 | `paired-ring-metrics` |
| `AdvantageBarList` | 双向优势条列表 | 左右主体从条形两端伸展 | `advantage-bars` |
| `StrategicInsightPanel` | 战略洞察组合 | 深色洞察卡 + 底部关键统计卡 | `strategic-insight-summary` |
| `ComparisonMatrixBoard` | 双实体矩阵 | 左侧维度列 + 两个实体列 + 行级观点 | `comparison-matrix` |
| `HorizontalMilestoneTimeline` | 横向时间轴 | 贯穿轴、节点、里程碑卡片 | `horizontal-timeline` |
| `SummaryInsightCard` | 纵向总结卡 | 图标、编号、标题、短解释和 2-3 条结论 | `takeaway-card` |
| `SummaryOutcomeCard` | 横向总结卡 | 图标、短结论、标签组或 kicker | `summary-outcome` |

## Slot 类型与文本容量

| Slot 类型 | 推荐组件 | 文本容量 | 导出注意事项 |
| --- | --- | --- | --- |
| `page-shell` | `AnalyticsCanvas` | 不承载正文 | 不整页截图 |
| `dark-background` | `DarkAnalyticsBackdrop` | 不承载正文 | 图片可为空，保留暗色占位 |
| `eyebrow-label` | `ExpandedLabel` | 48 字以内 | 保持文本节点，不用 letter-spacing |
| `body-header` | `ExecutiveHeader` | 标题约 72 字以内 | 标题过长时派生 slide 调整字号或换行 |
| `source-footer` | `AnalyticsSourceFooter` | source 120 字以内 | 来源、页码、密级保持文本 |
| `metric-card` | `MetricHighlightCard`, `TrendStatCard`, `CircularComparisonMetricCard` | 数值短文本 + 1-2 句解释 | 数值必须保持可编辑 |
| `chart` | `ChartPanelShell` + chart modules | 轴标签短文本 | 图表组件内部可截图，标题和解释放截图外 |
| `image-showcase` | `AnalyticsImageShowcasePanel` | 标题 2 行、说明 2 行 | 不使用 data URL；无图片时显示占位状态 |
| `comparison` | `ComparisonMatrixBoard`, `AdvantageBarList`, `StructureComparisonCard` | 2 个主体最佳，矩阵 6 行以内 | 对齐同类字段，避免长段落单元格 |
| `timeline` | `HorizontalMilestoneTimeline` | 4-6 个节点，每节点短标题和一句说明 | 时间线连接线可截图，文字保留 |
| `callout` | `DarkInsightCard`, `StrategicInsightPanel`, `SummaryOutcomeCard` | 120-180 字以内 | 不放未来源化事实 |
| `summary` | `SummaryInsightCard`, `SummaryOutcomeCard` | 3 条以内结论 | 结论应来自已展示证据或用户材料 |

## AI 修改规则

- 改某一页布局、slot、列宽、组件组合：改 `slides/*.tsx`。
- 改某一页默认内容：改对应 data JSON 和 schema 默认值。
- 改多个页面共享视觉单元：改 `components/*.tsx` 并同步本 README。
- 改色彩、字体、阴影、边框：优先改 `theme/tokens.ts`。
- 优先复用现有组件；只有出现跨页稳定新语义时才新增组件。
- 如果页面看起来像 `the original Dark Analytics Charts template` 的成品业务页换了文案，说明没有完成 canvas-first 目标。
