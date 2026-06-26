# Dark Analytics Charts 蓝图基础页

`chart-analytics-v1` 采用 TSX-first 工作流。Agent 先从 `catalog.json` 选择最接近页面意图的 `blueprints/*.tsx`，再复制或派生到 `slides/*.tsx`，最后直接修改最终页面实现。

## 当前蓝图

| 蓝图 | 适合 |
| --- | --- |
| `CoverAnalytics.tsx` | 对应 `.tmp/Template/图表主题/1.html` 的数据分析、市场情报、区域对比类 deck 开场封面。 |
| `ExecutiveSummaryDashboard.tsx` | 对应 `.tmp/Template/图表主题/2.html` 的执行摘要仪表盘：三张 KPI 卡、一张分组柱状图、图表洞察和右侧未来展望。 |

## 已实现源页

| 源 HTML | 蓝图 | 页面意图 | 核心结构 |
| --- | --- | --- | --- |
| `.tmp/Template/图表主题/1.html` | `CoverAnalytics.tsx` | 战略对比报告封面 | 深色背景图洗底、系列标签、双主体超大标题、`vs` 分隔、报告范围、发布方和日期页脚。 |
| `.tmp/Template/图表主题/2.html` | `ExecutiveSummaryDashboard.tsx` | 执行摘要和关键指标总览 | 深色内容页页眉、三列 KPI 卡片、技术采用率分组柱状图、短洞察列表、深色未来展望面板。 |

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
