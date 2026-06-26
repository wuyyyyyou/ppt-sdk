# Red Blue Comparison 蓝图基础页

`red-blue-comparison-v1` 采用 TSX-first 工作流。先选择最接近内容结构的蓝图，再派生到 `../slides/*.tsx`，最后直接编辑最终页面实现。

当前起步蓝图：

| Blueprint | Family | Use for |
| --- | --- | --- |
| `CoverComparison.tsx` | cover | 用带红/蓝主体图例的专业白底画布打开对比型 deck。 |
| `TopicOverview.tsx` | agenda-card-grid | 用 3x2 编号图标卡展示四到六个议题、章节或比较维度。 |
| `EconomySizeGrowth.tsx` | chart-with-metric-cards | 用左侧主柱图和右侧指标卡比较两到三个主体的规模、增速或基准指标。 |
| `EconomicStructure.tsx` | comparison-card-grid | 用两张主体卡、环形占比图、图例和分析框比较结构构成。 |

后续规划的蓝图家族记录在 `../catalog.json`。不要把 `.tmp/Template` 里的源 HTML 原样粘进 TSX；应抽象出可复用组件和页面结构。
