# Red Blue 组件索引

本目录把 `~/红蓝主题` 中的 26 个 HTML 参考页抽象成 TSX-first 可复用组件。组件只承载稳定视觉结构；具体页面布局、字段映射和业务文案应放在 `slides/*.tsx` 或后续 `blueprints/*.tsx` 中。

## 视觉语言

- 固定画布：1280 x 720，白色背景。
- 主色：红色代表一侧主体，蓝色代表另一侧主体，紫色作为连接、标题强调和中性判断色。
- 常见元素：柔和圆形背景、点阵底纹、圆角白卡、数值 callout、对比条、图表壳、时间线、SWOT 卡片。
- 参考 HTML 中的 FontAwesome 图标不直接依赖 CDN；组件保留 `icon?: ReactNode` 插槽，由页面传入文本、SVG 或本地 icon。

## 组件总览

| 组件 | 用途 | 对应参考页 |
| --- | --- | --- |
| `RedBlueCanvas` | 固定画布、背景点阵和红蓝紫装饰圆 | 全部页面 |
| `RedBlueContentFrame` | 普通内容页标题、内容区、页脚页码 | 3-10, 12-16, 18-25 |
| `RedBlueCoverBackdrop` | 封面、章节页、Thank You 页背景装饰 | 1, 17, 26 |
| `RedBlueSectionHeading` | 大标题 + 紫色短横线 | 多数内容页标题区 |
| `RedBlueLegend` | 红/蓝/紫图例 | 1, 3, 6-8, 13, 20 |
| `RedBlueTopicCard` | 议程卡、主题卡、建议卡 | 2, 18, 23, 25 |
| `RedBlueMetricCard` | 双主体横向数值条对比 | 3, 5, 10, 19 |
| `RedBlueNumberCallout` | 大数字指标卡 | 3, 6, 8, 9, 20, 22 |
| `RedBlueCountryCard` | 国家/主体 KPI 卡 | 5, 12, 19 |
| `RedBlueChartShell` | 图表容器、标题、副标题、图例区 | 3, 4, 6-10, 13, 20 |
| `RedBlueTimeline` | 交替式里程碑时间线 | 11 |
| `RedBlueGanttRoadmap` | 甘特/项目进度路线图 | 15 |
| `RedBlueSwotGrid` | SWOT 四象限卡片 | 14 |
| `RedBlueInsightCard` | 侧边洞察、结论、风险提示 | 6-10, 13, 16, 20, 24 |
| `RedBlueStatHero` | 单页大数字/关键统计 | 22 |

## 使用原则

- 页面级结构优先放在 `slides/*.tsx`，组件只负责稳定视觉单元。
- 需要换 layout 时，优先改当前 slide TSX 的组件组合，不要把结构塞进 JSON。
- `data/*.json` 只承载内容，不承载列宽、卡片数量、图表类型等版式决策。
- 图表本体后续可以接入 Recharts 或本地 SVG；当前 `RedBlueChartShell` 只提供图表外壳。
- 所有关键文本、数字和表格内容应保持真实 DOM 文本，避免截图化。
- 如果多个页面重复出现新的稳定视觉单元，再新增组件；不要为单页小差异创建特化组件。

## 推荐组合

```text
Cover / Section
RedBlueCanvas
└─ RedBlueCoverBackdrop
   ├─ RedBlueSectionHeading
   └─ RedBlueLegend

Chart + Metrics
RedBlueContentFrame
├─ RedBlueChartShell
└─ RedBlueMetricCard / RedBlueNumberCallout

Comparison
RedBlueContentFrame
├─ RedBlueCountryCard
├─ RedBlueMetricCard
└─ RedBlueInsightCard

Timeline / Roadmap
RedBlueContentFrame
├─ RedBlueTimeline
└─ RedBlueGanttRoadmap

Summary / Recommendation
RedBlueContentFrame
├─ RedBlueTopicCard
├─ RedBlueInsightCard
└─ RedBlueStatHero
```
