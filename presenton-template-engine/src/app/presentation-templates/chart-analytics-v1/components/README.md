# Dark Analytics Charts 组件索引

本目录存放 `chart-analytics-v1` 模板组的跨页复用视觉 Module。组件只负责稳定视觉单元和导出友好的结构；页面结构、字段映射和单页编排应放在 `blueprints/*.tsx` 或派生后的 `slides/*.tsx` 中。

## 使用原则

- 组件只做纯渲染，不内置业务文案。
- 关键标题、主体名称、报告范围、发布方、日期等内容必须保持真实文本节点。
- JSON 只承载内容，不承载页面结构决策。
- 1280x720 是稳定布局基准；固定格式元素应给出明确宽高或 min/max 约束。
- 不依赖 PPT 导出不稳定的 CSS 语义：不要用 `letter-spacing` 表达大字距标签，不要用负坐标或越界 shape 表达装饰，不要手写小行高 italic `vs` 文本盒。
- 封面上的圆环装饰保留在封面蓝图里，不抽成通用组件；但必须使用画布内安全坐标，避免 PPT shape 越界。
- 不新增只服务单页的组件；单页特殊结构直接写在对应 blueprint 或 slide 中。
- 如果页面视觉和 PPT 导出发生冲突，优先选择 PPT 稳定结构，再近似还原 HTML 视觉意图。

## 组件总览

| Module | 类型 | 主要用途 | 适用页 |
| --- | --- | --- | --- |
| `AnalyticsCanvas` | 页面框架 | 固定 1280x720 画布、深色/浅色背景和基础字体 | 封面、结束页、后续内容页 |
| `DarkAnalyticsBackdrop` | 背景层 | 图片洗底、深色遮罩、蓝色叠色和顶部强调线 | 封面、章节重置、thank-you 等低密度暗色页 |
| `ExpandedLabel` | 标题原语 | PPT-safe 大字距 eyebrow / 系列标签 | 封面、章节页、结束页 |
| `ComparisonDivider` | 标题原语 | PPT-safe `vs` 对比分隔行，包含左右线和基线补偿 | 双主体封面、对比章节页 |
| `ComparisonHeroTitle` | 标题组合 | 上下双主体大标题 + `ComparisonDivider` | 对比报告封面 |
| `ReportMetaFooter` | 页脚原语 | 左侧发布方/署名和右侧日期/版本 | 封面、报告收束页、章节重置页 |
| `ExecutiveHeader` | 内容页页眉 | 深色报告页眉、eyebrow、标题、右侧元信息和图标 | 执行摘要、仪表盘、图表内容页 |
| `AnalyticsCardShell` | 卡片容器 | 白色或深色分析卡片、边框、阴影、顶部强调色 | KPI 卡、图表卡、洞察卡 |
| `MetricHighlightCard` | 指标组合 | 大数字 KPI + 进度条、双值块或状态徽章 | 摘要仪表盘、KPI overview |
| `ProgressMeter` | 度量原语 | 固定高度进度条 | KPI、成熟度、占比、状态面板 |
| `StatusBadge` | 状态原语 | 短状态标签 | 风险、趋势、优先级、阶段标签 |
| `ChartPanelShell` | 图表容器 | 图表标题、副标题、legend 和稳定内容区；legend label 使用显式文本节点便于 PPT 抽取 | Recharts 图表页 |
| `AnalyticsGroupedBarChart` | 图表组件 | Recharts 分组柱状图，自带 `data-pptx-export="screenshot"` 边界，避免 SVG 内部文字被二次抽取 | 对比指标、采用率、结构占比 |
| `AnalyticsLineChart` | 图表组件 | Recharts 多系列折线图，支持负值区间、0% 基线和截图导出边界 | 趋势对比、历史波动、长周期指标 |
| `AnalyticsDonutChart` | 图表组件 | Recharts 环形构成图，中心指标固定在图内，自带截图导出边界 | 结构占比、年龄分布、市场份额、组合构成 |
| `TrendStatCard` | 指标组合 | 主体标签、状态徽章、两项关键指标和短解释 | 趋势对比、主体画像、左侧解释栏 |
| `StructureLegendBar` | 图例组合 | 居中胶囊图例，保留可编辑 label 文本 | 构成对比、份额对比、环图页 |
| `StructureComparisonCard` | 指标+图表组合 | 实体身份、总量、环形结构图、中心指标和底部强调指标 | 双实体结构占比对比页 |
| `AnalyticsIcons` | 图标原语 | 当前主题使用的轻量线性图标集合 | 页眉、KPI、洞察、面板标题 |
| `OutlookPanel` | 深色洞察面板 | 时间段列表 + 底部进度指标 | 未来展望、风险判断、行动窗口 |
| `CircularComparisonMetricCard` | 双主体环形指标卡 | 一个指标下的两组环形进度、主次强调和底部简短结论 | 技术能力、采用率、成熟度、覆盖率等双主体指标比较 |
| `AdvantageBarList` | 双向优势条列表 | 左右主体分别从条形两端伸展，展示多个领域的相对优势 | sector dominance、能力矩阵、份额比较 |
| `StrategicInsightPanel` | 战略洞察组合 | 深色洞察卡 + 底部关键统计卡 | 战略分歧、模式对比、行动启示 |

## Slot 适配

| Slot 类型 | 推荐 Module | 不适合 |
| --- | --- | --- |
| `page-shell` | `AnalyticsCanvas` | 业务卡片、图表本体 |
| `dark-background` | `DarkAnalyticsBackdrop` | 内容页普通浅色背景、复杂业务逻辑 |
| `eyebrow-label` | `ExpandedLabel` | 长句、正文段落、超过 48 字的说明 |
| `comparison-title` | `ComparisonHeroTitle` | 三个以上主体、长标题、普通内容页标题 |
| `comparison-divider` | `ComparisonDivider` | 无对比语义的普通分割线 |
| `footer-meta` | `ReportMetaFooter` | 多列联系方式、长版权声明、正文内容 |
| `body-header` | `ExecutiveHeader` | 封面 hero 标题、章节大标题 |
| `metric-card` | `MetricHighlightCard` | 长正文说明、超过三组维度的矩阵 |
| `chart-shell` | `ChartPanelShell` + `AnalyticsGroupedBarChart` / `AnalyticsLineChart` | 单页临时手写 Chart.js、纯装饰图 |
| `composition-donut` | `StructureLegendBar` + `StructureComparisonCard` / `AnalyticsDonutChart` | 超过两个对象的拥挤环图、需要长解释段落的结构页 |
| `trend-stat-card` | `TrendStatCard` | 长正文、超过两项核心指标的详细表格 |
| `dark-insight-panel` | `OutlookPanel` | 需要大段正文或复杂表格的内容 |
| `paired-ring-metrics` | `CircularComparisonMetricCard` | 单实体 KPI、需要精确坐标轴的趋势图 |
| `advantage-bars` | `AdvantageBarList` | 时间序列、超过两个主体的堆叠比较 |
| `strategic-insight-summary` | `StrategicInsightPanel` | 长篇文本、复杂多列表格 |
| `decoration` | 封面蓝图内的安全坐标圆环 | 任何关键事实、数字或结论 |

## AI 修改规则

- 改某一页的布局、列宽、栅格、字段映射：优先改 `slides/*.tsx`。
- 改跨页共享的颜色、字体、阴影、圆角：改 `theme/tokens.ts`。
- 改跨页共享的稳定视觉单元：改或新增 `components/*.tsx`，并同步更新本 README。
- 实现图表页时，优先新增可复用图表容器和 Recharts 图表 Module，不要在 blueprint 中临时手写 Chart.js 或源 HTML 图表结构。
- Recharts 图表组件必须在组件内部设置截图导出边界，避免 PPTX model 同时包含图表截图和轴标签文本框；图表标题、legend、解释文本应放在截图边界外，保持可编辑。
