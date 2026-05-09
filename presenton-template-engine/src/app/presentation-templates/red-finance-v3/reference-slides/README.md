# 参考页面

这个目录保留上一代模板中选出的成品页面，用作视觉和组件编排参考。

它们不是 V3 的生成入口：

- 不要把这个目录里的文件加入 `group.json.layouts`。
- 不要让 `manifest.json` 指向 `reference-slides/*.tsx`。
- 不要直接复制参考页面作为新 deck 的最终答案。
- 只把它们用于学习视觉密度、组件组合、间距和适合导出的实现模式。

生成 V3 deck 时，按下面顺序阅读：

1. `../catalog.json`
2. `../blueprints/README.md`
3. 选中的 `../blueprints/*.json`
4. `../components/README.md`
5. 如果需要视觉参考，再阅读本目录中的相关文件

## 参考索引

| 参考页面 | 来源 | 可提取模式 | 相关 V3 蓝图 |
| --- | --- | --- | --- |
| `IndustryOverview.tsx` | `red-finance-v2/slides/IndustryOverview.tsx` | 左侧叙事列表 + 右侧图表 + 底部强调结论 | `two-column-insight`, `chart-with-narrative` |
| `MarketTrends.tsx` | `red-finance-v2/slides/MarketTrends.tsx` | 顶部卡片 + 底部图表面板 | `three-column-cards`, `chart-with-narrative` |
| `ChinaUsMarketComparison.tsx` | `red-finance-v2/slides/ChinaUsMarketComparison.tsx` | 对比面板 + 指标 | `comparison-matrix`, `kpi-summary` |
| `StrategicRoadmap.tsx` | `red-finance-v2/slides/StrategicRoadmap.tsx` | 支柱要点 + 路线图 + KPI | `timeline-plan`, `kpi-summary`, `three-column-cards` |
| `ConclusionOutlook.tsx` | `red-finance-v2/slides/ConclusionOutlook.tsx` | 总结优先级 + 行动项 | `closing-actions`, `three-column-cards` |
