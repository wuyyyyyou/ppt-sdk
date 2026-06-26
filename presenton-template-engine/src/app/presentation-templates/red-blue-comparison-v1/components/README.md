# Red Blue Comparison 组件索引

本目录存放 `red-blue-comparison-v1` 模板组的跨页复用视觉组件。组件只负责稳定的视觉单元和导出友好的结构；页面结构、字段映射和单页组件编排应放在 `blueprints/*.tsx` 或派生后的 `slides/*.tsx` 中。

## 使用原则

- 组件只做纯渲染，不内置业务文案。
- 关键标题、说明、数值、标签必须保持真实文本节点。
- 装饰圆形、网格、连接线、占位图形可以用 CSS / SVG。
- JSON 只承载内容，不承载页面结构决策。
- 如果布局溢出、重叠或组件组合不合适，优先修改 `slides/*.tsx`。
- 1280x720 是稳定布局基准；固定格式元素应给出明确宽高或 min/max 约束。

## 组件总览

| 组件 | 分层 | 主要用途 | 跨页边界 |
| --- | --- | --- | --- |
| `ThemeCanvas` | 画布基础 | 固定 1280x720 页面画布、字体、背景和可选点阵 | 所有页面可复用 |
| `ComparisonCanvas` | 兼容别名 | 兼容早期 Cover，占位 re-export `ThemeCanvas` | 后续新页面优先用 `ThemeCanvas` |
| `CoverComparisonDecorations` | 装饰 | 封面圆形、中心圆环、点阵背景 | 只承载氛围，不承载事实 |
| `ThemeContentFrame` | 页面框架 | 内容页标题区、meta、内容区、页脚 | 普通内容页首选框架 |
| `ThemeTitleBlock` | 标题原语 | 标题、副标题、eyebrow、强调线 | 页面标题或内容区块标题 |
| `ThemePill` | 标签原语 | meta、状态、主体标签、短分类 | 短文本，不放长句 |
| `StableInlineRow` | 基础原语 | 稳定单行横向对齐 | 图标文字、短指标、meta 行 |
| `IconText` | 基础原语 | 图标 + 单行或短文本 | meta、卡片小标题、短说明 |
| `EntityLegend` | 基础原语 | 两到三个对比主体的颜色图例 | 封面、比较页、图表说明 |
| `ThemeCard` | 内容组件 | 通用图标卡、议题卡、短说明卡 | 卡片网格和侧栏要点 |
| `MetricCard` | 内容组件 | 数值、单位、说明和可选进度条 | KPI、数字强调、左右对比指标 |
| `ChartContainer` | 内容组件 | 图表标题、meta 和图表承载区 | 图表外壳，不负责画图数据 |
| `TimelineNode` | 内容组件 | 时间线节点、日期、标题、说明 | 横向或交错时间线 |
| `ComparisonPanel` | 内容组件 | 多段结构化对比说明 | 国家、市场、方案、能力对比 |
| `ImageShowcasePanel` | 内容组件 | 单图展示、标题、说明、来源 | 图片/截图/地图/视觉证据页 |

## Slot 适配

| Slot 类型 | 推荐组件 | 不适合 |
| --- | --- | --- |
| `page-shell` | `ThemeCanvas`, `ThemeContentFrame` | 业务卡片、图表本体 |
| `page-title` | `ThemeTitleBlock`, `ThemeContentFrame` | 大段正文、矩阵表格 |
| `meta` / `pill` | `ThemePill`, `IconText`, `StableInlineRow` | 超过 24 字的长说明 |
| `legend` | `EntityLegend`, `ThemePill` | 多维表格、长解释 |
| `card-grid` | `ThemeCard`, `MetricCard` | 大段连续正文、复杂时间线 |
| `metric` / `number-callout` | `MetricCard`, `StableInlineRow` | 多段结论或长脚注 |
| `chart` | `ChartContainer` | 非数据装饰、长文本说明 |
| `timeline` | `TimelineNode` | 无顺序的分类信息 |
| `comparison` | `ComparisonPanel`, `ThemeCard`, `EntityLegend` | 单一观点页、纯图表页 |
| `image` | `ImageShowcasePanel` | 多图相册、大数据表 |
| `decoration` | `CoverComparisonDecorations` | 任何关键事实、数字或结论 |

## 文本容量

| 组件 | 建议容量 | 溢出处理 |
| --- | --- | --- |
| `ThemeTitleBlock` | 标题 36 字以内；副标题 80 字以内 | 标题/副标题区域裁切，必要时调小页面标题或改布局 |
| `ThemePill` | 24 字以内 | 单行 truncate |
| `IconText` | 单行 48 字以内，非单行模式 2 行以内 | 固定高度单行；长文本请改为卡片正文 |
| `EntityLegend` | 2-3 个主体，每项 24 字以内 | 单行图例，不承载说明 |
| `ThemeCard` | 标题 28 字以内；说明 80 字以内 | 标题和说明限制高度 |
| `MetricCard` | 数值 10 字以内；说明 40 字以内 | 数值单行 truncate |
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
- `ThemeTitleBlock` 负责标题组合，不承载正文结构。
- `EntityLegend` 只表达对比主体颜色映射。

### 3. 内容组件

- `ThemeCard` 用于卡片网格、议题卡、简短说明卡。
- `MetricCard` 用于 KPI、数字强调和进度类指标。
- `ChartContainer` 只负责图表外壳；图表本体由 slide 或专门图表组件传入。
- `TimelineNode` 是时间线节点，不负责整页路线图布局。
- `ComparisonPanel` 用于多段结构化文本对比，不适合大表格。
- `ImageShowcasePanel` 用于单图展示，图片标题和说明保持可编辑文本。

## AI 修改规则

- 改某一页的布局、列宽、栅格、字段映射：优先改 `slides/*.tsx`。
- 改跨页共享的颜色、字体、阴影、圆角：改 `theme/tokens.ts`。
- 改跨页共享的视觉单元：改或新增 `components/*.tsx`。
- 不要新增只服务单页的组件；单页特殊结构直接写在对应 `slides/*.tsx`。
- 不要把 Chart.js、HTML 模板结构或业务数据写进组件。
