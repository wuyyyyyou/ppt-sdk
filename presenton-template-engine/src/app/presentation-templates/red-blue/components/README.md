# Red Blue 组件索引

本目录存放 `red-blue` 模板组的可复用视觉组件。组件只负责稳定的视觉单元和导出友好的结构；页面级布局、组件编排和字段映射应优先放在 `slides/*.tsx` 中，默认演示内容可以放在对应蓝图的 `sampleData` 或 `data/*.json` 中。

## 使用原则

- 页面主结构放在 `slides/*.tsx`，不要把整页业务逻辑塞进组件。
- 新页面通常先从 `blueprints/*.tsx` 派生，再在 `slides/*.tsx` 中直接修改。
- 多页复用的视觉单元放在 `components/*.tsx`，保持轻量、纯渲染。
- 颜色、字体、阴影等常量优先来自 `theme/tokens.ts`。
- 关键文字、数字和表格内容保持真实文本节点，避免整块截图化。
- 图表本体可以由 SVG、Recharts 或截图兜底承载，但标题、说明、结论和 KPI 数值仍应保持可编辑文本。
- 红色、蓝色和紫色分别用于两侧主体、对照主体和中性连接；不要为单页临时引入新的主色体系。

## 组件总览

| 组件 | 分层 | 主要用途 | 常见依赖 |
| --- | --- | --- | --- |
| `RedBlueCanvas` | 画布基础 | 固定 1280x720 页面画布、背景、基础字体、装饰氛围 | `theme/tokens` |
| `RedBlueContentFrame` | 页面框架 | 普通内容页标题、正文区域、页脚和页码 | `RedBlueCanvas` |
| `RedBlueCoverBackdrop` | 页面框架 | 封面、章节页、收束页的沉浸式背景结构 | `RedBlueCanvas` |
| `RedBlueSectionHeading` | 基础原语 | 小节标题、短说明和强调线 | `theme/tokens` |
| `RedBlueLegend` | 基础原语 | 红蓝紫图例、主体标识和短标签 | `theme/tokens` |
| `RedBlueTopicCard` | 卡片 | 议程、主题、建议和行动项卡片 | `theme/tokens` |
| `RedBlueMetricCard` | 卡片 | 双主体横向数值对比 | `theme/tokens` |
| `RedBlueNumberCallout` | 卡片 | 大数字指标、关键结论和强调数值 | `theme/tokens` |
| `RedBlueCountryCard` | 卡片 | 国家、市场或主体 KPI 摘要卡 | `RedBlueLegend` |
| `RedBlueInsightCard` | 卡片 | 侧边洞察、风险提示、结论说明 | `theme/tokens` |
| `RedBlueChartShell` | 容器壳 | 图表标题、副标题、图例区和图表内容壳 | `RedBlueLegend` |
| `RedBlueTimeline` | 结构化组件 | 交替式里程碑时间线 | `theme/tokens` |
| `RedBlueGanttRoadmap` | 结构化组件 | 甘特式阶段路线图和执行路径 | `theme/tokens` |
| `RedBlueSwotGrid` | 结构化组件 | SWOT 四象限分析网格 | `theme/tokens` |
| `RedBlueStatHero` | 结构化组件 | 收束页的大数字主视觉和关键判断 | `theme/tokens` |

## 分层说明

### 1. 页面框架与画布

- `RedBlueCanvas` 是最低层画布。特殊页可以直接使用；普通内容页优先通过 `RedBlueContentFrame` 获得一致的标题区、内容区和页脚。
- `RedBlueContentFrame` 是内容页首选框架，适合 agenda、对比、图表、路线图和总结类页面。
- `RedBlueCoverBackdrop` 用于封面、章节过渡和强视觉收束页，不承载复杂表格或多列正文。

### 2. 基础原语

- `RedBlueSectionHeading` 用于内容区小节标题，不用于页面主标题；页面主标题应由 slide 或页面框架控制。
- `RedBlueLegend` 用于解释红蓝紫语义，适合图表、对比卡和页脚补充信息。

### 3. 卡片组件

- `RedBlueTopicCard`：承载主题项、议程项和建议项。当前 agenda 页面支持 2-12 个 topic，卡片尺寸应由页面网格决定。
- `RedBlueMetricCard`：表达两个主体的指标对比，适合紧凑横向读数。
- `RedBlueNumberCallout`：强调单个关键数字或短结论，避免塞入长正文。
- `RedBlueCountryCard`：用于国家、市场、区域或业务主体概览，不限定只能用于国家语义。
- `RedBlueInsightCard`：用于解释、风险、行动建议和边栏洞察，可承载比 topic card 更完整的说明。

### 4. 图表与结构化组件

- `RedBlueChartShell` 只负责图表外壳和标题区，不负责具体图表绘制。
- `RedBlueTimeline` 适合有明确先后关系的里程碑，不适合无序分类。
- `RedBlueGanttRoadmap` 适合阶段计划、跨季度推进和执行路线。
- `RedBlueSwotGrid` 适合四象限判断；如果内容不是 SWOT 语义，优先在 slide 中组合普通卡片。
- `RedBlueStatHero` 适合 closing 或 executive takeaway 页，文字容量应保持克制。

## Slot 类型与组件家族

Agent 先选 `blueprints/*.tsx` 基础页，再在 `slides/*.tsx` 中直接组合组件。组件选择必须从页面语义出发，不要只凭组件名拼接。

| Slot 类型 | 推荐组件家族 | 典型组件 | 不适合 |
| --- | --- | --- | --- |
| `page-title` | `page-shell` | `RedBlueContentFrame`, `RedBlueCoverBackdrop` | 长正文、图表本体 |
| `section-heading` | `heading` | `RedBlueSectionHeading` | KPI 网格、大表格 |
| `agenda-topic` | `card` | `RedBlueTopicCard` | 大段正文、复杂图表 |
| `comparison` | `card`, `chart-shell` | `RedBlueCountryCard`, `RedBlueMetricCard`, `RedBlueChartShell` | 单一观点页 |
| `metric` | `card` | `RedBlueMetricCard`, `RedBlueNumberCallout`, `RedBlueStatHero` | 长解释文本 |
| `chart` | `chart-shell` | `RedBlueChartShell` | 非数据装饰 |
| `timeline` | `timeline` | `RedBlueTimeline`, `RedBlueGanttRoadmap` | 无先后顺序的分类 |
| `callout` | `card` | `RedBlueInsightCard`, `RedBlueNumberCallout` | 大段正文 |
| `legend` | `primitive` | `RedBlueLegend` | 正文段落 |
| `decoration` | `page-shell` | `RedBlueCanvas`, `RedBlueCoverBackdrop` | 承载关键事实 |

## 组件边界

| 组件 | 适合 slot | 不适合 slot | 文本容量 | 截图策略 | 跨页复用 |
| --- | --- | --- | --- | --- | --- |
| `RedBlueCanvas` | `page-title`, `decoration` | `narrative-text`, `chart` | 不承载正文 | 不整页截图 | 是 |
| `RedBlueContentFrame` | `page-title`, `footer-meta` | `chart`, `matrix` | 标题 32 字以内 | 框架不单独截图 | 是 |
| `RedBlueCoverBackdrop` | `page-title`, `decoration` | `matrix`, `timeline` | 标题 36 字以内，导语 120 字以内 | 背景可截图，文字保留 | 是 |
| `RedBlueSectionHeading` | `section-heading` | `chart`, `timeline` | 标题 28 字以内 | 必须保持文本 | 是 |
| `RedBlueLegend` | `legend`, `footer-meta` | `narrative-text` | 单项 24 字以内 | 必须保持文本 | 是 |
| `RedBlueTopicCard` | `agenda-topic`, `card` | `chart`, `timeline` | 标题 30 字以内，正文 120 字以内 | 必须保持文本 | 是 |
| `RedBlueMetricCard` | `metric`, `comparison` | `narrative-text` | 双值 + 短标签 | 数值必须保持文本 | 是 |
| `RedBlueNumberCallout` | `metric`, `callout` | `matrix`, `timeline` | 大数字 + 1 段短说明 | 数值必须保持文本 | 是 |
| `RedBlueCountryCard` | `comparison`, `metric` | `chart` | 3-5 个短指标 | 必须保持文本 | 是 |
| `RedBlueInsightCard` | `callout`, `narrative-text` | `chart`, `matrix` | 标题 28 字以内，正文 140 字以内 | 必须保持文本 | 是 |
| `RedBlueChartShell` | `chart` | `narrative-text` | 标题 36 字以内 | 图表区域可截图 | 是 |
| `RedBlueTimeline` | `timeline` | `comparison`, `chart` | 6 个节点以内 | 连接线可截图，文字保留 | 是 |
| `RedBlueGanttRoadmap` | `timeline` | `metric`, `callout` | 6 个阶段以内 | 轨道可截图，文字保留 | 是 |
| `RedBlueSwotGrid` | `matrix`, `comparison` | `timeline`, `chart` | 四象限短文本 | 必须保持文本 | 是 |
| `RedBlueStatHero` | `metric`, `callout` | `matrix`, `chart` | 1 个主数字 + 2-3 条支撑 | 数值必须保持文本 | 是 |

## 依赖关系

常见组合方式：

```text
RedBlueCanvas
├─ RedBlueContentFrame
│  ├─ RedBlueSectionHeading
│  ├─ RedBlueLegend
│  └─ RedBlueTopicCard / RedBlueInsightCard
└─ RedBlueCoverBackdrop
   └─ RedBlueLegend

RedBlueChartShell
├─ RedBlueLegend
└─ 图表本体或本地 SVG

Comparison Page
├─ RedBlueCountryCard
├─ RedBlueMetricCard
└─ RedBlueInsightCard

Roadmap Page
├─ RedBlueTimeline
└─ RedBlueGanttRoadmap

Closing Page
├─ RedBlueStatHero
└─ RedBlueInsightCard
```

依赖选择规则：

- 需要整页框架：先选 `RedBlueContentFrame` 或 `RedBlueCoverBackdrop`。
- 需要多项主题卡：优先用 `RedBlueTopicCard`，由 slide 控制网格数量和高度。
- 需要图表：`RedBlueChartShell` 负责外壳，具体图表只负责绘制。
- 需要对比：先判断是主体对比、指标对比还是结论对比，再选择 country、metric 或 insight 组件。
- 需要路线图：有阶段跨度选 `RedBlueGanttRoadmap`，有事件顺序选 `RedBlueTimeline`。

## AI 修改规则

- 改某一页的布局、列宽、卡片数量、数据映射：优先改 `slides/*.tsx`。
- JSON 只能解决内容替换，不能解决结构不合适、越界或组件组合错误。
- 改某一页的默认内容：同步更新对应 `Schema`、`sampleData` 和 demo data。
- 改多个页面共享的视觉单元：再改 `components/*.tsx`。
- 改颜色、字体、阴影、边框：优先改 `theme/tokens.ts`。
- 不要在组件里硬编码业务文案，默认内容应来自 slide schema、blueprint sample data 或 data JSON。
- 不要新增与现有卡片语义高度重叠的特化组件；只有出现新的稳定视觉语义时才新增组件。
- 纯装饰可以截图化；核心标题、表格文字、KPI 数值和说明文字应保持可编辑。
