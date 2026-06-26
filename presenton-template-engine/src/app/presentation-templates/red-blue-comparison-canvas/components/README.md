# Red Blue Comparison Canvas 组件索引

本目录存放 `red-blue-comparison-canvas` 模板组的可复用视觉组件。组件从红蓝对比 v1 组件库迁移而来，用于保留红/蓝/紫/白画布的视觉系统，同时支持 component-first / canvas-first 的页面生成方式。

`red-blue-comparison-canvas` 不提供成品业务页蓝图。AI Agent 应先选择 `blueprints/*.tsx` 中的 cover/content/comparison/chart-evidence/closing canvas，再在 `slides/*.tsx` 中把 slot guide 替换为本目录组件的组合。

## 使用原则

- 页面主结构、列宽、组件编排和字段映射放在 `slides/*.tsx`。
- `blueprints/*.tsx` 只是可复制 canvas 起点，不是最终页面答案。
- 业务数据放在 `data/*.json`，但 JSON 不承载布局、组件选择或页面结构决策。
- 多页复用的视觉单元放在 `components/*.tsx`，保持轻量、纯渲染。
- 颜色、字体、阴影、圆角等常量优先来自 `theme/tokens.ts`。
- 关键标题、说明、数值、标签和表格文字必须保持真实文本节点。
- 图表和复杂 SVG 可通过 `data-pptx-export="screenshot"` 或组件自身策略截图兜底，但旁边的标题、说明和结论应保持可编辑文本。
- 不要把 source HTML、外部成品页或具体业务页面硬塞进 canvas；应从组件重新组合。

## 组件总览

| 组件 | 分层 | 主要用途 | 常见 slot |
| --- | --- | --- | --- |
| `ThemeCanvas` | 页面框架 | 固定 1280x720 画布、字体、背景和可选点阵 | `page-shell`, `decoration` |
| `ThemeContentFrame` | 页面框架 | 内容页标题区、内容区、页脚、页码 | `page-title`, `footer-meta` |
| `ThemePanelShell` | 面板壳 | 统一卡片/图表/表格/图片面板背景、边框和阴影 | `panel-shell`, `card`, `chart-shell` |
| `ThemeTitleBlock` | 标题原语 | 标题、副标题、eyebrow、prefix/highlight 分段标题 | `page-title`, `section-heading` |
| `ComparisonHeroTitle` | 标题原语 | 导出稳定的 `A vs B` 大标题 | `cover-title` |
| `ThemePill` | 基础原语 | 短 meta、状态、分类标签 | `meta`, `pill`, `footer-meta` |
| `StableInlineRow` | 基础原语 | 稳定单行横向对齐 | `meta`, `metric`, `legend` |
| `IconText` | 基础原语 | 图标 + 单行或短文本 | `meta`, `card-heading`, `short-note` |
| `CardAccentRail` | 基础原语 | 导出安全的卡片强调边 | `card-accent` |
| `EntityLegend` | 基础原语 | 两到三个对比主体的颜色图例 | `legend`, `cover`, `chart-meta` |
| `ThemeSoftCircle` | 装饰原语 | rgba / 浅色填充软圆 | `decoration` |
| `CoverComparisonDecorations` | 装饰组合 | 封面圆形、中心圆环、点阵背景 | `cover-decoration` |
| `BalancedComparisonDecorations` | 装饰组合 | 内容页红/蓝/紫软圆组合 | `content-decoration` |
| `AgendaTopicCard` | 卡片 | 编号水印、图标和短说明的议题卡 | `agenda-card-grid` |
| `EntityComparisonMetricCard` | 卡片 | 实体排名或横向条形指标对比 | `comparison-metric` |
| `EntitySnapshotCard` | 卡片 | 主体英雄数值、状态和 KPI 列表 | `entity-profile` |
| `InsightMetricCard` | 卡片 | 数值摘要卡或浅色结论卡 | `metric`, `insight-sidebar` |
| `TrendInsightCard` | 卡片 | 趋势页右侧拐点、降幅、展望洞察卡 | `insight-sidebar` |
| `StrategicInsightCard` | 卡片 | 带强调边的短洞察说明卡 | `callout`, `narrative-text` |
| `ComparativeMetricRow` | 卡片 | 一行指标名 + 两个主体数值的紧凑对照 | `kpi-row`, `comparison` |
| `ChartContainer` | 图表外壳 | 图表标题、meta 和导出控制 | `chart-shell` |
| `ImageShowcasePanel` | 证据面板 | 主图片、标题、说明、来源和占位状态 | `image`, `evidence` |
| `ComparisonTablePanel` | 表格面板 | 3-4 列紧凑比较表、强调单元格和底部证据注释 | `matrix`, `comparison-table` |
| `VerticalComparisonBarChart` | 图表 | 两到三个实体垂直柱图 | `bar-chart` |
| `SectorDonutChart` | 图表 | 截图安全的环形占比图 | `donut-composition` |
| `SectorStructureCard` | 图表卡片 | 主体色条卡 + 环形图 + 图例 + 分析框 | `composition-card` |
| `StackedCompositionBarChart` | 图表 | 100% 横向堆叠构成图 | `stacked-composition` |
| `DualAxisProjectionLineChart` | 图表 | 双轴历史/预测折线图 | `projection-trend` |
| `ComparisonRadarChart` | 图表 | 两个主体的多维能力雷达图 | `radar-comparison` |
| `ProjectionLegend` | 图表辅助 | 实线实体图例 + 虚线预测说明 | `chart-legend` |
| `AlternatingTimeline` | 时间线 | 横向中轴、菱形节点、上下交错日期和说明 | `timeline` |

## Slot 类型与推荐组件

| Slot 类型 | 推荐组件家族 | 不适合 |
| --- | --- | --- |
| `page-shell` | `ThemeCanvas`, `ThemeContentFrame` | 业务卡片、图表本体 |
| `panel-shell` | `ThemePanelShell` | 页面整体布局决策 |
| `page-title` | `ThemeTitleBlock`, `ComparisonHeroTitle`, `ThemeContentFrame` | 大段正文 |
| `meta` / `pill` | `ThemePill`, `IconText`, `StableInlineRow` | 超过 24 字的长说明 |
| `legend` | `EntityLegend`, `ProjectionLegend` | 长解释、复杂表格 |
| `agenda-card-grid` | `AgendaTopicCard` | 图表、长段落 |
| `comparison-metric` | `EntityComparisonMetricCard`, `ComparativeMetricRow` | 超过三个主体、复杂表格 |
| `entity-profile` | `EntitySnapshotCard` | 时间序列、长叙事 |
| `insight-sidebar` | `InsightMetricCard`, `TrendInsightCard`, `StrategicInsightCard` | 大段连续正文、复杂矩阵 |
| `chart-shell` | `ChartContainer` | 直接承载正文 |
| `bar-chart` | `VerticalComparisonBarChart` | 份额构成、时间序列 |
| `donut-composition` | `SectorDonutChart`, `SectorStructureCard` | 时间序列、超过两个主卡 |
| `stacked-composition` | `StackedCompositionBarChart` | 绝对量级、时间序列 |
| `projection-trend` | `DualAxisProjectionLineChart`, `ProjectionLegend` | 非时间序列、多图 dashboard |
| `radar-comparison` | `ComparisonRadarChart`, `ComparativeMetricRow`, `StrategicInsightCard` | 时间序列、大表格、超过两个主体 |
| `image-evidence` | `ImageShowcasePanel`, `ComparisonTablePanel` | 多图 gallery、chart-first 页面 |
| `timeline` | `AlternatingTimeline` | 超过六个事件、详细年表、量化趋势图 |
| `decoration` | `CoverComparisonDecorations`, `BalancedComparisonDecorations`, `ThemeSoftCircle` | 任何关键事实、数字或结论 |

## 文本容量

| 组件 | 建议容量 | 导出注意事项 |
| --- | --- | --- |
| `ThemeTitleBlock` | 标题 36 字以内；副标题 100 字以内 | 必须保持文本 |
| `ThemePanelShell` | 只承载一个清晰内容模块 | 不单独截图；内部复杂图形可截图 |
| `ComparisonHeroTitle` | 左右标题各 28 字以内；连接词 12 字以内 | 超长标题应在 slide 中降字号 |
| `ThemePill` | 24 字以内 | 单行 truncate |
| `IconText` | 单行 48 字以内，非单行模式 2 行以内 | 多行正文不要放这里 |
| `AgendaTopicCard` | 标题 34 字以内；说明 115 字以内 | 过密时减少卡片或拆页 |
| `EntityComparisonMetricCard` | 2-3 个主体；标题 36 字以内；数值 18 字以内 | 超过 3 个主体改矩阵页 |
| `EntitySnapshotCard` | 主体 24 字以内；英雄数值 18 字以内；KPI 2-4 项 | 长解释放到独立文本页 |
| `InsightMetricCard` | 标签 28 字以内；数值 18 字以内；说明 140 字以内 | 长结论改正文卡 |
| `TrendInsightCard` | 标题 28 字以内；数值 18 字以内；说明 160 字以内 | 右栏最多 4 张卡 |
| `StrategicInsightCard` | 标题 34 字以内；说明约 180-220 字以内 | 长正文拆页或提高卡片高度 |
| `ComparativeMetricRow` | 指标名 32 字以内；数值 16 字以内；副标签 24 字以内 | 超过两个主体改矩阵 |
| `ChartContainer` | 标题 56 字以内；副标题 88 字以内 | 图表区域可截图，标题说明保留文本 |
| `ImageShowcasePanel` | 标题 48 字以内；说明约 3 行；来源 90 字以内 | 图片本体保持图片对象，标题说明保留文本 |
| `ComparisonTablePanel` | 3-4 列、2-5 行；单元格值 42 字以内 | 尽量保持文本，大表格拆页 |
| `VerticalComparisonBarChart` | 2-3 个柱；标签 24 字以内 | 图表本体可截图 |
| `StackedCompositionBarChart` | 2-4 行、2-5 个分段 | 小分段可能隐藏内部数值 |
| `DualAxisProjectionLineChart` | 1-3 条线；横轴 2-14 个点 | 复杂趋势拆成多页 |
| `ComparisonRadarChart` | 2 条序列；3-8 个维度 | 维度过多会拥挤 |
| `SectorStructureCard` | 主体 24 字以内；badge 24 字以内；分析说明 110 字以内 | 更多主体拆页 |
| `AlternatingTimeline` | 3-6 个节点；日期 18 字以内；标题 42 字以内；说明 120 字以内 | 长叙事或更多节点拆页 |

## AI 修改规则

- 先选 canvas，再在 `slides/*.tsx` 中派生具体页面。
- 根据页面语义选择组件，不要只按视觉外观拼接。
- 改某一页的布局、列宽、栅格、字段映射：优先改 `slides/*.tsx`。
- 改跨页共享的颜色、字体、阴影、圆角：改 `theme/tokens.ts`。
- 改跨页共享视觉单元：改或新增 `components/*.tsx`。
- 做主图表时，先找已有 Recharts 图表组件；没有合适组件时，再新增一个通用图表组件。
- `ChartContainer` 只包裹图表，不能替代图表本体。
- 不把 Chart.js、source HTML、旧模板 HTML 结构或业务数据写进组件。
