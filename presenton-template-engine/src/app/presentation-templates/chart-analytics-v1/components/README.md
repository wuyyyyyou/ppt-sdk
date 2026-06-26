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

## Slot 适配

| Slot 类型 | 推荐 Module | 不适合 |
| --- | --- | --- |
| `page-shell` | `AnalyticsCanvas` | 业务卡片、图表本体 |
| `dark-background` | `DarkAnalyticsBackdrop` | 内容页普通浅色背景、复杂业务逻辑 |
| `eyebrow-label` | `ExpandedLabel` | 长句、正文段落、超过 48 字的说明 |
| `comparison-title` | `ComparisonHeroTitle` | 三个以上主体、长标题、普通内容页标题 |
| `comparison-divider` | `ComparisonDivider` | 无对比语义的普通分割线 |
| `footer-meta` | `ReportMetaFooter` | 多列联系方式、长版权声明、正文内容 |
| `decoration` | 封面蓝图内的安全坐标圆环 | 任何关键事实、数字或结论 |

## AI 修改规则

- 改某一页的布局、列宽、栅格、字段映射：优先改 `slides/*.tsx`。
- 改跨页共享的颜色、字体、阴影、圆角：改 `theme/tokens.ts`。
- 改跨页共享的稳定视觉单元：改或新增 `components/*.tsx`，并同步更新本 README。
- 实现图表页时，优先新增可复用图表容器和 Recharts 图表 Module，不要在 blueprint 中临时手写 Chart.js 或源 HTML 图表结构。