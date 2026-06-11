# Red Blue 最终页面

这个目录存放 `red-blue` 模板组的生产页面入口。每个 `*.tsx` 都应是可直接被 `manifest.json` 引用、可预览、可导出的最终页面。

## 当前页面

| 页面 | 职责 |
| --- | --- |
| `CoverStatement.tsx` | 封面陈述页 |
| `AgendaOverview.tsx` | Overview / agenda 页 |
| `ThreeTopicCards.tsx` | 三主题洞察页 |
| `ChartMetricBrief.tsx` | 图表 + 指标简报页 |
| `CountryComparison.tsx` | 主体对比页 |
| `TimelineRoadmap.tsx` | 时间线 / 路线图页 |
| `ClosingSummary.tsx` | 收束总结页 |

## 约定

- 每个 slide entry 负责最终页面结构、组件组合、字段映射和导出稳定性。
- 如果需要一个页面从蓝图派生，先复制 `blueprints/*.tsx` 到这里，再修改实现。
- 这里只放生产页面，不放调试页、组件展示页或只读素材页。
- `data/*.json` 只承载内容，不承载列宽、卡片数量、图表类型等版式决策。
- 如果页面结构、组件组合、文本容量或导出稳定性有问题，直接改这里的 TSX。

## 修改清单

- 改 layout：修改当前 slide 的 JSX、CSS class、网格和组件组合。
- 改默认内容：同步 slide schema、blueprint `sampleData` 和 demo data。
- 改共享视觉：抽到或修改 `../components/*.tsx`。
- 改模板发现信息：同步 `../catalog.json`、`../group.json` 和 `manifest.json`。
- 改预览效果：重新生成 template previews，并确认图片顺序与 manifest 一致。
