# 最终页面

这个目录存放 `chart-analytics-v1` 具体 deck 的最终页面入口。

约定：

- 每个 `*.tsx` 都是可直接被 `manifest.json` 引用的页面入口。
- `group.json.layouts` 只引用本目录下的文件。
- 入口表顺序应和 `group.json.layouts` / demo `manifest.json` 保持一致：cover -> executive overview -> chart/composition/capability pages -> matrix/timeline -> image evidence -> summary -> closing。
- 如果需要从蓝图派生页面，先复制 `blueprints/*.tsx` 到这里，再修改实现。
- 这里只放最终页面，不放源 HTML 或只读参考页。

## 当前入口

| 文件 | 来源蓝图 | 对应源页 |
| --- | --- | --- |
| `CoverAnalytics.tsx` | `../blueprints/CoverAnalytics.tsx` | `.tmp/Template/图表主题/1.html` |
| `ExecutiveSummaryDashboard.tsx` | `../blueprints/ExecutiveSummaryDashboard.tsx` | `.tmp/Template/图表主题/2.html` |
| `GrowthTrendComparison.tsx` | `../blueprints/GrowthTrendComparison.tsx` | `.tmp/Template/图表主题/4.html` |
| `PopulationStructureComparison.tsx` | `../blueprints/PopulationStructureComparison.tsx` | `.tmp/Template/图表主题/6.html` |
| `TechnologyCapabilityDashboard.tsx` | `../blueprints/TechnologyCapabilityDashboard.tsx` | `.tmp/Template/图表主题/8.html` |
| `BusinessPracticeMatrix.tsx` | `../blueprints/BusinessPracticeMatrix.tsx` | `.tmp/Template/图表主题/9.html` |
| `HistoricalMilestoneTimeline.tsx` | `../blueprints/HistoricalMilestoneTimeline.tsx` | `.tmp/Template/图表主题/10.html` |
| `ImageEvidenceShowcase.tsx` | `../blueprints/ImageEvidenceShowcase.tsx` | `.tmp/Template/图表主题 visual language` |
| `StrategicSummaryTakeaways.tsx` | `../blueprints/StrategicSummaryTakeaways.tsx` | `.tmp/Template/图表主题/14.html` |
| `ClosingAnalytics.tsx` | `../blueprints/ClosingAnalytics.tsx` | `.tmp/Template/图表主题/15.html` / `22.html` |
