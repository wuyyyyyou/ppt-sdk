# Red Blue Comparison 组件

本目录存放 `red-blue-comparison-v1` 模板组的跨页复用视觉组件。

当前起步组件：

| Component | Role | Notes |
| --- | --- | --- |
| `ComparisonCanvas` | 固定 1280x720 画布 | 统一字体、基础背景和文字颜色。 |
| `CoverComparisonDecorations` | 封面装饰系统 | 把源主题里的半透明圆形、中心圆环和点阵背景抽成可复用 TSX。 |
| `EntityLegend` | 对比主体图例 | 支持两到三个对比主体，标签保持可编辑文本。 |

组件只承载跨页复用的视觉原语。页面结构、字段映射和单页组件编排应放在 `blueprints/*.tsx`，或由蓝图派生后的 `slides/*.tsx` 中。
