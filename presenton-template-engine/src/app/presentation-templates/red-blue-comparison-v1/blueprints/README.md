# Red Blue Comparison 蓝图基础页

`red-blue-comparison-v1` 采用 TSX-first 工作流。先选择最接近内容结构的蓝图，再派生到 `../slides/*.tsx`，最后直接编辑最终页面实现。

当前起步蓝图：

| Blueprint | Family | Use for |
| --- | --- | --- |
| `CoverComparison.tsx` | cover | 用带红/蓝主体图例的专业白底画布打开对比型 deck。 |
| `TopicOverview.tsx` | agenda-card-grid | 用 3x2 编号图标卡展示四到六个议题、章节或比较维度。 |
| `EconomySizeGrowth.tsx` | chart-with-metric-cards | 用左侧主柱图和右侧指标卡比较两到三个主体的规模、增速或基准指标。 |
| `EconomicStructure.tsx` | comparison-card-grid | 用两张主体卡、环形占比图、图例和分析框比较结构构成。 |
| `DemographicsSnapshot.tsx` | entity-snapshot-cards | 用两张主体卡展示人口规模、状态和人口相关 KPI。 |
| `AgingDependency.tsx` | stacked-composition-with-insights | 用左侧 100% 堆叠构成图和右侧摘要卡比较年龄结构、依赖风险或其他百分比构成。 |
| `PopulationTrend.tsx` | dual-axis-projection-trend | 用左侧双轴折线图和右侧洞察卡比较历史趋势、预测段和关键拐点。 |
| `TechnologyInnovationKpis.tsx` | radar-kpi-sidebar | 用左侧雷达图和右侧 KPI 行比较两个主体的技术、创新、能力成熟度。 |
| `EvidenceImageTable.tsx` | image-table-evidence | 用一张主图片和右侧紧凑表格展示视觉证据、观察项和红蓝对比信号。 |
| `HistoricalMilestonesTimeline.tsx` | alternating-horizontal-timeline | 用居中标题、横向中轴和上下交错节点展示三到六个关键历史或路线图里程碑。 |
| `ClosingContact.tsx` | closing-contact | 用大号 Thank You、URL pill 和一到三条联系方式结束 deck。 |

`group.json.layouts` 和 `manifest.json` 只引用 `../slides/*.tsx`。
