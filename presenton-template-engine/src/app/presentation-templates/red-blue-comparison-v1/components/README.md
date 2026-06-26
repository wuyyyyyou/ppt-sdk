# Red Blue Comparison 组件索引

本目录存放 `red-blue-comparison-v1` 模板组的跨页复用视觉组件。组件只负责稳定的视觉单元和导出友好的结构；页面结构、字段映射和单页组件编排应放在 `blueprints/*.tsx` 或派生后的 `slides/*.tsx` 中。

## 使用原则

- 组件只做纯渲染，不内置业务文案。
- 关键标题、说明、数值、标签必须保持真实文本节点。
- 装饰圆形、网格、连接线、占位图形可以用 CSS / SVG。
- 主图表必须优先使用本目录已有的 Recharts 组件，例如 `VerticalComparisonBarChart`、`SectorDonutChart`。不要临时手写 DOM/SVG 图表或把 Chart.js 源 HTML 粘进 TSX。
- 图形主导模块应通过 `ChartContainer exportMode="screenshot"` 或组件自身的 `data-pptx-export="screenshot"` 导出，避免 PPTX 转换丢失图表样式。
- 卡片装饰条必须使用 `CardAccentRail` 或已内置该原语的卡片组件，不要用 CSS `border-left` / `border-top` 表达强调边；该原语会阻断父卡片圆角继承，让 PPTX 以原生矩形导出。
- JSON 只承载内容，不承载页面结构决策。
- 如果布局溢出、重叠或组件组合不合适，优先修改 `slides/*.tsx`。
- 1280x720 是稳定布局基准；固定格式元素应给出明确宽高或 min/max 约束。

## 组件总览

| 组件 | 分层 | 主要用途 | 跨页边界 |
| --- | --- | --- | --- |
| `ThemeCanvas` | 画布基础 | 固定 1280x720 页面画布、字体、背景和可选点阵 | 所有页面可复用 |
| `ComparisonCanvas` | 兼容别名 | 兼容早期 Cover，占位 re-export `ThemeCanvas` | 后续新页面优先用 `ThemeCanvas` |
| `CoverComparisonDecorations` | 装饰 | 封面圆形、中心圆环、点阵背景 | 只承载氛围，不承载事实 |
| `ThemeSoftCircle` | 装饰原语 | 使用 rgba / 浅色填充的导出安全软圆 | 背景装饰、视觉氛围，不承载内容 |
| `ThemeContentFrame` | 页面框架 | 内容页标题区、meta、内容区、页脚 | 普通内容页首选框架 |
| `ThemeTitleBlock` | 标题原语 | 标题、副标题、eyebrow、强调线；支持稳定的 prefix/highlight 分段标题 | 页面标题或内容区块标题 |
| `ComparisonHeroTitle` | 标题原语 | `A vs B` 对比型大标题，三段文本独立渲染 | 封面、章节页、比较页主标题 |
| `ThemePill` | 标签原语 | meta、状态、主体标签、短分类 | 短文本，不放长句 |
| `StableInlineRow` | 基础原语 | 稳定单行横向对齐 | 图标文字、短指标、meta 行 |
| `CardAccentRail` | 基础原语 | 导出安全的卡片上下左右矩形装饰条 | 只能表达装饰边，不承载文本或数据 |
| `IconText` | 基础原语 | 图标 + 单行或短文本 | meta、卡片小标题、短说明 |
| `EntityLegend` | 基础原语 | 两到三个对比主体的颜色图例 | 封面、比较页、图表说明 |
| `ThemeCard` | 内容组件 | 通用图标卡、议题卡、短说明卡 | 卡片网格和侧栏要点 |
| `AgendaTopicCard` | 内容组件 | 编号水印、图标和短说明组合的议题卡 | 目录页、章节总览、主题/维度总览 |
| `MetricCard` | 内容组件 | 数值、单位、说明和可选进度条 | KPI、数字强调、左右对比指标 |
| `VerticalComparisonBarChart` | 内容组件 | 基于 Recharts 的两到三个实体垂直柱图 | 主图表、规模对比、量级比较 |
| `StackedCompositionBarChart` | 内容组件 | 基于 Recharts 的 100% 横向堆叠构成图 | 年龄结构、收入结构、成本构成、份额拆分 |
| `InsightMetricCard` | 内容组件 | 左侧强调线数值摘要卡或浅色结论卡 | 图表侧栏要点、风险提示、执行摘要 |
| `EntityComparisonMetricCard` | 内容组件 | 实体排名卡或横向条形指标卡 | 右侧指标组、红/蓝主体指标对比 |
| `SectorDonutChart` | 内容组件 | 基于 Recharts 且截图安全的环形占比图 | 结构占比、份额构成、组合拆分 |
| `SectorStructureCard` | 内容组件 | 主体色条卡 + 环形图 + 图例 + 分析框 | 双主体结构对比、行业/收入/市场份额拆分 |
| `ChartContainer` | 内容组件 | 图表标题、meta 和图表承载区；可把图表区导出为截图 | 图表外壳，不是图表本体 |
| `TimelineNode` | 内容组件 | 时间线节点、日期、标题、说明 | 横向或交错时间线 |
| `ComparisonPanel` | 内容组件 | 多段结构化对比说明 | 国家、市场、方案、能力对比 |
| `ImageShowcasePanel` | 内容组件 | 单图展示、标题、说明、来源 | 图片/截图/地图/视觉证据页 |

## Slot 适配

| Slot 类型 | 推荐组件 | 不适合 |
| --- | --- | --- |
| `page-shell` | `ThemeCanvas`, `ThemeContentFrame` | 业务卡片、图表本体 |
| `page-title` | `ThemeTitleBlock`, `ComparisonHeroTitle`, `ThemeContentFrame` | 大段正文、矩阵表格 |
| `meta` / `pill` | `ThemePill`, `IconText`, `StableInlineRow` | 超过 24 字的长说明 |
| `legend` | `EntityLegend`, `ThemePill` | 多维表格、长解释 |
| `card-grid` | `ThemeCard`, `MetricCard` | 大段连续正文、复杂时间线 |
| `agenda-card-grid` | `AgendaTopicCard` | 图表、长段落、超过六个议题的目录 |
| `metric` / `number-callout` | `MetricCard`, `StableInlineRow` | 多段结论或长脚注 |
| `chart` | `ChartContainer`, `VerticalComparisonBarChart` | 非数据装饰、长文本说明 |
| `composition` / `stacked-bar` | `StackedCompositionBarChart`, `ChartContainer` | 时间序列、大段解释、非百分比量级对比 |
| `insight-sidebar` | `InsightMetricCard`, `MetricCard` | 大段连续正文、复杂矩阵 |
| `comparison-metric` | `EntityComparisonMetricCard` | 超过三个主体、复杂表格 |
| `composition` / `donut` | `SectorDonutChart`, `SectorStructureCard` | 时间序列、大段解释、超过两个主卡的复杂对比 |
| `timeline` | `TimelineNode` | 无顺序的分类信息 |
| `comparison` | `ComparisonPanel`, `ThemeCard`, `EntityLegend` | 单一观点页、纯图表页 |
| `image` | `ImageShowcasePanel` | 多图相册、大数据表 |
| `decoration` | `CoverComparisonDecorations`, `ThemeSoftCircle` | 任何关键事实、数字或结论 |

## 文本容量

| 组件 | 建议容量 | 溢出处理 |
| --- | --- | --- |
| `ThemeTitleBlock` | 标题 36 字以内；副标题 80 字以内 | 标题/副标题区域裁切，必要时调小页面标题或改布局 |
| `ComparisonHeroTitle` | 左右标题各 28 字以内；连接词 12 字以内 | 三段文本独立渲染，超长标题应在 slide 中降字号 |
| `ThemePill` | 24 字以内 | 单行 truncate |
| `IconText` | 单行 48 字以内，非单行模式 2 行以内 | 固定高度单行；长文本请改为卡片正文 |
| `EntityLegend` | 2-3 个主体，每项 24 字以内 | 单行图例，不承载说明 |
| `ThemeCard` | 标题 28 字以内；说明 80 字以内 | 标题和说明限制高度 |
| `AgendaTopicCard` | 标题 34 字以内；说明 115 字以内 | 固定卡片高度，长文本应拆短或减少卡片数量 |
| `MetricCard` | 数值 10 字以内；说明 40 字以内 | 数值单行 truncate |
| `VerticalComparisonBarChart` | 2-3 个柱；标签 24 字以内；数值标签 18 字以内；需传稳定 width/height | 超过 3 个主体应改图表布局或拆页 |
| `StackedCompositionBarChart` | 2-4 行、2-5 个分段；分段标签 24 字以内；总量应约等于 100 | 小分段会隐藏内部数值标签，复杂构成应拆页 |
| `InsightMetricCard` | 标签 28 字以内；数值 18 字以内；说明 140 字以内 | 说明限制高度，长结论应改为正文页 |
| `EntityComparisonMetricCard` | 2-3 个主体；标题 36 字以内；数值 18 字以内 | 超过 3 个主体或长解释应改矩阵页 |
| `SectorDonutChart` | 2-5 个分段；中心值 12 字以内；中心标签 18 字以内；扇区边界保持直角 | 图表区域截图导出，不承载正文 |
| `SectorStructureCard` | 主体 24 字以内；badge 24 字以内；分析说明 110 字以内 | 两卡并排为主，更多主体应拆页 |
| `ChartContainer` | 标题 36 字以内；副标题 60 字以内 | 标题单行 truncate |
| `TimelineNode` | 日期 16 字以内；标题 28 字以内；说明 60 字以内 | 固定节点宽度和文本高度 |
| `ComparisonPanel` | 每段标题 28 字以内；说明 56 字以内 | 每段限制高度，超过应拆页或改 `slides/*.tsx` |
| `ImageShowcasePanel` | 标题 36 字以内；说明 80 字以内；来源 48 字以内 | 图片区域稳定，文字区限制高度 |

## 分层边界

### 1. 画布和页面框架

- `ThemeCanvas` 是最低层画布。特殊页可直接使用。
- `ThemeContentFrame` 是普通内容页首选框架，统一标题、内容区和页脚。
- 框架组件不决定业务布局，内容区仍由蓝图或最终 slide 编排。

### 2. 基础原语

- `StableInlineRow` 用于解决单行元素在导出时的高度漂移。
- `IconText` 只表达图标和文本的稳定组合。
- `ThemePill` 表达短状态、meta 或主体标签。
- `CardAccentRail` 只表达卡片强调边，支持 top/right/bottom/left 和自定义颜色/尺寸；卡片组件应优先复用它，避免单边 CSS border 在 PPT 中丢失或窄条继承父圆角后弱化。
- `ThemeTitleBlock` 负责标题组合，不承载正文结构。
- 分段标题优先使用 `ThemeTitleBlock` / `ThemeContentFrame` 的 `titlePrefix` 和 `titleHighlight`，不要把普通文本和 `<span>` 混成 React fragment；这样能降低 PPTX 提取时丢字风险。
- `ComparisonHeroTitle` 负责导出稳定的 `A vs B` 标题，避免混合文本节点导致 PPT 丢字。
- `EntityLegend` 只表达对比主体颜色映射。
- `ThemeSoftCircle` 使用 rgba / 浅色填充，不使用元素级 `opacity`，避免 PPT 输出变成深色实心圆。

### 3. 内容组件

- `ThemeCard` 用于卡片网格、议题卡、简短说明卡。
- `AgendaTopicCard` 用于目录或主题总览中的编号议题卡，保留淡化编号、图标和顶部强调条。
- `MetricCard` 用于 KPI、数字强调和进度类指标。
- `VerticalComparisonBarChart` 用 Recharts 渲染基础垂直对比柱图；外层应通过 `ChartContainer exportMode="screenshot"` 进入 PPT，保留图表视觉一致性。
- `StackedCompositionBarChart` 用 Recharts 渲染 100% 横向堆叠构成图；适合百分比分布，不适合绝对量级或时间序列。
- `InsightMetricCard` 用于图表侧栏摘要，保留数值和说明为可编辑文本；结论卡使用浅色底，不承载复杂段落。
- `EntityComparisonMetricCard` 用于实体排名和横向条形指标对比。
- `SectorDonutChart` 用 Recharts 渲染结构占比图，默认截图导出以保留环形分段和中心标签；扇区边界不用圆帽，避免小分段视觉变形。
- `SectorStructureCard` 用于可复用的主体结构卡，顶部色条、badge、图例和分析框保持可编辑文本。
- `ChartContainer` 只负责图表外壳；图表本体由 slide 或专门图表组件传入。图形主导内容优先设置 `exportMode="screenshot"`，让图表区按浏览器截图进入 PPT，避免 gradient、复杂几何或图表库样式丢失。
- `TimelineNode` 是时间线节点，不负责整页路线图布局。
- `ComparisonPanel` 用于多段结构化文本对比，不适合大表格。
- `ImageShowcasePanel` 用于单图展示，图片标题和说明保持可编辑文本。

## AI 修改规则

- 改某一页的布局、列宽、栅格、字段映射：优先改 `slides/*.tsx`。
- 改跨页共享的颜色、字体、阴影、圆角：改 `theme/tokens.ts`。
- 改跨页共享的视觉单元：改或新增 `components/*.tsx`。
- 做主图表时，先找已有 Recharts 组件；没有合适组件时，新增一个 Recharts 组件，再让页面蓝图组合它。
- `ChartContainer` 只能包裹图表，不能替代图表组件；`MetricCard` / `EntityComparisonMetricCard` 只用于 KPI 或指标条，不用于主图表。
- 如果必须做无法由 Recharts 表达的特殊图形，外层必须标记 `data-pptx-export="screenshot"`，并在组件 README 中说明原因。
- 不要新增只服务单页的组件；单页特殊结构直接写在对应 `slides/*.tsx`。
- 不要把 Chart.js、HTML 模板结构或业务数据写进组件。
