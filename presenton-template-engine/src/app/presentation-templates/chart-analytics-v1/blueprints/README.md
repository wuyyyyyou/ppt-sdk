# Dark Analytics Charts 蓝图基础页

`chart-analytics-v1` 采用 TSX-first 工作流。Agent 先从 `catalog.json` 选择最接近页面意图的 `blueprints/*.tsx`，再复制或派生到 `slides/*.tsx`，最后直接修改最终页面实现。

## 当前蓝图

| 蓝图 | 适合 |
| --- | --- |
| `CoverAnalytics.tsx` | 对应 `.tmp/Template/图表主题/1.html` 的数据分析、市场情报、区域对比类 deck 开场封面。 |
| `ExecutiveSummaryDashboard.tsx` | 对应 `.tmp/Template/图表主题/2.html` 的执行摘要仪表盘：三张 KPI 卡、一张分组柱状图、图表洞察和右侧未来展望。 |
| `GrowthTrendComparison.tsx` | 对应 `.tmp/Template/图表主题/4.html` 的长周期趋势分析页：左侧主体统计卡和洞察，右侧多系列折线图。 |
| `PopulationStructureComparison.tsx` | 对应 `.tmp/Template/图表主题/6.html` 的双实体构成结构对比页：共享图例、左右实体卡、环形构成图、中心指标和底部比率强调。 |
| `TechnologyCapabilityDashboard.tsx` | 对应 `.tmp/Template/图表主题/8.html` 的技术能力仪表盘：四张双主体环形指标卡、领域优势条和战略分歧洞察。 |
| `BusinessPracticeMatrix.tsx` | 对应 `.tmp/Template/图表主题/9.html` 的商业实践对比矩阵：深色页眉、左右实体列、维度行、双侧对比观点和底部 implication。 |
| `HistoricalMilestoneTimeline.tsx` | 对应 `.tmp/Template/图表主题/10.html` 的历史脉络时间轴：深色页眉、横向年份轴、节点、里程碑卡片和来源页脚。 |
| `ClosingAnalytics.tsx` | 对应 `.tmp/Template/图表主题/15.html` / `22.html` 的暗色收束页：感谢标题、下一步/决策 callout、联系人和日期。 |

## 已实现源页

| 源 HTML | 蓝图 | 页面意图 | 核心结构 |
| --- | --- | --- | --- |
| `.tmp/Template/图表主题/1.html` | `CoverAnalytics.tsx` | 战略对比报告封面 | 深色背景图洗底、系列标签、双主体超大标题、`vs` 分隔、报告范围、发布方和日期页脚。 |
| `.tmp/Template/图表主题/2.html` | `ExecutiveSummaryDashboard.tsx` | 执行摘要和关键指标总览 | 深色内容页页眉、三列 KPI 卡片、技术采用率分组柱状图、短洞察列表、深色未来展望面板。 |
| `.tmp/Template/图表主题/4.html` | `GrowthTrendComparison.tsx` | 历史增长趋势和波动收敛分析 | 深色内容页页眉、左侧两张主体统计卡、深色战略洞察、右侧长周期多系列折线图和资料页脚。 |
| `.tmp/Template/图表主题/6.html` | `PopulationStructureComparison.tsx` | 人口或市场结构构成对比 | 深色内容页页眉、居中共享图例、左右等宽实体卡、环形构成图、中心关键指标、底部比率指标和来源页脚。 |
| `.tmp/Template/图表主题/8.html` | `TechnologyCapabilityDashboard.tsx` | 技术能力和领域优势对比 | 深色内容页页眉、四列双主体环形指标卡、左侧 sector dominance 条形列表、右侧深色战略分歧洞察和关键统计。 |
| `.tmp/Template/图表主题/9.html` | `BusinessPracticeMatrix.tsx` | 商业文化和实践差异对比 | 深色内容页页眉、2+5+5 对比矩阵、维度图标、两侧观点说明、底部 implication 行。 |
| `.tmp/Template/图表主题/10.html` | `HistoricalMilestoneTimeline.tsx` | 关键历史节点和转折点梳理 | 深色内容页页眉、浅色画布、横向时间轴、4-6 个节点卡片、来源页脚。 |
| `.tmp/Template/图表主题/15.html` / `22.html` | `ClosingAnalytics.tsx` | 感谢和收束 | 暗色背景、短标题、下一步 callout、联系人和报告日期页脚。 |

## 阅读顺序

1. 先读 `../catalog.json`，确认页面意图和可用蓝图。
2. 再读选中的 `blueprints/*.tsx`，理解 Schema、组件组合和可编辑边界。
3. 如果需要共享组件细节，读 `../components/README.md` 和相关组件源码。
4. 最终注册页面必须落在 `../slides/*.tsx`，并由 `manifest.json` 引用。

## 约定

- `blueprints/*.tsx` 是可复制基础页，不是运行时 DSL。
- `slides/*.tsx` 是最终页面入口，`group.json.layouts` 只引用这里。
- `data/*.json` 只承载内容数据；结构、列宽、组件选择和越界修复应改 TSX。
- 不要把 `.tmp/Template/图表主题` 的 HTML 原样塞进 TSX。
- 上移到 `components/` 的标准：跨两页以上复用、或者属于稳定页面原语（页眉、页脚、图表壳、卡片壳、洞察面板、对比卡、timeline/outlook 面板）。单页专属装饰和特殊栅格留在 blueprint。
