# Red Blue Comparison 组件索引

本目录存放 `red-blue-comparison-v1` 模板组的跨页复用视觉 Module。组件只负责稳定的视觉单元和导出友好的结构；页面结构、字段映射和单页编排应放在 `blueprints/*.tsx` 或派生后的 `slides/*.tsx` 中。

## 使用原则

- 组件只做纯渲染，不内置业务文案。
- 关键标题、说明、数值、标签必须保持真实文本节点。
- JSON 只承载内容，不承载页面结构决策。
- 主图表优先使用本目录已有的 Recharts 图表 Module。
- 图形主导区域优先通过 `ChartContainer exportMode="screenshot"` 或组件自身的 `data-pptx-export="screenshot"` 导出。
- 卡片装饰条使用 `CardAccentRail` 或已内置该原语的卡片 Module，不用 CSS 单边 border 表达强调边。
- 不新增只服务单页的组件；单页特殊结构直接写在对应 blueprint 或 slide 中。
- 1280x720 是稳定布局基准；固定格式元素应给出明确宽高或 min/max 约束。

## 组件总览

| Module | 类型 | 主要用途 | 适用页 |
| --- | --- | --- | --- |
| `ThemeCanvas` | 页面框架 | 固定 1280x720 画布、字体、背景和可选点阵 | 封面或特殊页 |
| `ThemeContentFrame` | 页面框架 | 内容页标题区、内容区和页脚 | 所有内容页 |
| `ThemePanelShell` | 面板外壳 | 统一卡片/图表/表格/图片面板的背景、边框、圆角和阴影 | 图表壳、证据面板、closing 联系区 |
| `ThemeTitleBlock` | 标题原语 | 标题、副标题、eyebrow、强调线和 prefix/highlight 分段标题 | 内容页标题 |
| `ComparisonHeroTitle` | 标题原语 | 导出稳定的 `A vs B` 大标题 | 封面 |
| `ThemePill` | 基础原语 | 短 meta、状态、分类标签 | header 或卡片角标 |
| `StableInlineRow` | 基础原语 | 稳定单行横向对齐 | 图标文字、meta 行 |
| `IconText` | 基础原语 | 图标 + 单行或短文本 | 卡片小标题、短说明 |
| `CardAccentRail` | 基础原语 | 导出安全的卡片上下左右装饰条 | 卡片强调边 |
| `EntityLegend` | 基础原语 | 两到三个对比主体的颜色图例 | 封面、图表说明 |
| `ThemeSoftCircle` | 装饰原语 | token 化浅色填充软圆 | 背景装饰 |
| `CoverComparisonDecorations` | 装饰组合 | 封面圆形、中心圆环、点阵背景 | `CoverComparison` |
| `BalancedComparisonDecorations` | 装饰组合 | 内容页通用 sideA / sideB / comparison 软圆组合 | 双卡对比内容页 |
| `AgendaTopicCard` | 卡片 | 编号水印、图标和短说明的议题卡 | `TopicOverview` |
| `EntityComparisonMetricCard` | 卡片 | 实体排名或横向条形指标对比 | `EconomySizeGrowth` |
| `EntitySnapshotCard` | 卡片 | 主体英雄数值、状态和 KPI 列表 | `DemographicsSnapshot` |
| `InsightMetricCard` | 卡片 | 数值摘要卡或浅色结论卡 | `AgingDependency` |
| `TrendInsightCard` | 卡片 | 趋势页右侧拐点/降幅/展望洞察卡 | `PopulationTrend` |
| `StrategicInsightCard` | 卡片 | 带强调边的短洞察说明卡 | 雷达/KPI、能力对比、结论摘要 |
| `ComparativeMetricRow` | 卡片 | 一行指标名 + 两个主体数值的紧凑对照 | KPI sidebar、能力基准对比 |
| `ChartContainer` | 图表外壳 | 图表标题、meta 和导出控制 | 所有图表页 |
| `ImageShowcasePanel` | 证据面板 | 主图片、标题、说明、来源和占位状态 | `EvidenceImageTable` |
| `ComparisonTablePanel` | 表格面板 | 3-4 列紧凑比较表、强调单元格和底部证据注释 | `EvidenceImageTable` |
| `VerticalComparisonBarChart` | 图表 | 两到三个实体垂直柱图 | 规模、量级、基准指标 |
| `SectorDonutChart` | 图表 | 截图安全的环形占比图 | 结构占比 |
| `SectorStructureCard` | 图表卡片 | 主体色条卡 + 环形图 + 图例 + 分析框 | `EconomicStructure` |
| `StackedCompositionBarChart` | 图表 | 100% 横向堆叠构成图 | 年龄结构、份额构成 |
| `DualAxisProjectionLineChart` | 图表 | 双轴历史/预测折线图 | `PopulationTrend` |
| `ComparisonRadarChart` | 图表 | 两个主体的多维能力雷达图 | 技术创新、竞争力、成熟度 |
| `ProjectionLegend` | 图表辅助 | 实线实体图例 + 虚线预测说明 | `PopulationTrend` |
| `AlternatingTimeline` | 时间线 | 横向中轴、菱形节点、上下交错日期和说明 | `HistoricalMilestonesTimeline` |

## Slot 适配

| Slot 类型 | 推荐 Module | 不适合 |
| --- | --- | --- |
| `page-shell` | `ThemeCanvas`, `ThemeContentFrame` | 业务卡片、图表本体 |
| `panel-shell` | `ThemePanelShell` | 页面整体布局、复杂业务逻辑 |
| `page-title` | `ThemeTitleBlock`, `ComparisonHeroTitle`, `ThemeContentFrame` | 大段正文 |
| `meta` / `pill` | `ThemePill`, `IconText`, `StableInlineRow` | 超过 24 字的长说明 |
| `legend` | `EntityLegend`, `ProjectionLegend` | 长解释、复杂表格 |
| `agenda-card-grid` | `AgendaTopicCard` | 图表、长段落 |
| `comparison-metric` | `EntityComparisonMetricCard` | 超过三个主体、复杂表格 |
| `entity-profile` | `EntitySnapshotCard` | 时间序列、长叙事 |
| `insight-sidebar` | `InsightMetricCard`, `TrendInsightCard` | 大段连续正文、复杂矩阵 |
| `chart-shell` | `ChartContainer` | 直接承载正文 |
| `bar-chart` | `VerticalComparisonBarChart` | 份额构成、时间序列 |
| `donut-composition` | `SectorDonutChart`, `SectorStructureCard` | 时间序列、超过两个主卡 |
| `stacked-composition` | `StackedCompositionBarChart` | 绝对量级、时间序列 |
| `projection-trend` | `DualAxisProjectionLineChart`, `ProjectionLegend` | 非时间序列、多图 dashboard |
| `radar-comparison` | `ComparisonRadarChart`, `ComparativeMetricRow`, `StrategicInsightCard` | 时间序列、大表格、超过两个主体 |
| `image-evidence` | `ImageShowcasePanel`, `ComparisonTablePanel` | 多图 gallery、chart-first 页面 |
| `timeline` | `AlternatingTimeline` | 超过六个事件、详细年表、量化趋势图 |
| `decoration` | `CoverComparisonDecorations`, `BalancedComparisonDecorations`, `ThemeSoftCircle` | 任何关键事实、数字或结论 |


## AI 修改规则

- 改某一页的布局、列宽、栅格、字段映射：优先改 `slides/*.tsx`。
- 改跨页共享的默认颜色、阴影或预设：改 `theme/token.default.json`、`theme/token.schema.json` 或命名预设；组件侧统一通过 `theme/tokens.ts` 消费 CSS vars。
- 改跨页共享的视觉单元：改或新增 `components/*.tsx`。
- 做主图表时，先找已有 Recharts 图表 Module；没有合适 Module 时，新增一个 Recharts Module，再让页面蓝图组合它。
- `ChartContainer` 只包裹图表，不能替代图表本体。
- 不把 Chart.js、HTML 模板结构或业务数据写进组件。
