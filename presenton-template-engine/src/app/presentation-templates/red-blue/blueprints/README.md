# Red Blue 蓝图基础页

`red-blue` 采用 TSX-first 工作流。Agent 在理解完整演示文稿大纲之后，先选择最接近内容结构的 `blueprints/*.tsx`，再复制或派生到 `slides/*.tsx`，最后直接修改页面实现。

这里的蓝图是可复制的 TSX 基础页，不是新的运行时引擎，也不是 JSON DSL。

## 阅读顺序

1. 先读 `../catalog.json`，快速了解可用蓝图基础页。
2. 再读选中的 `blueprints/*.tsx`，确认结构、默认数据、组件组合和可编辑边界。
3. 如果需要组件细节，继续读 `../components/README.md` 和相关组件源码。
4. 最终页面必须落在 `../slides/*.tsx`，并由 `manifest.json` 引用。

## 当前生产蓝图

| 蓝图 | 页面职责 | 适合内容 | 不适合内容 |
| --- | --- | --- | --- |
| `CoverStatement.tsx` | 封面陈述页 | 标题、副标题、三方对比语境、短标签 | 多图表、多正文 |
| `AgendaOverview.tsx` | Overview / agenda 页 | 2-12 个主题卡、章节路径、研究框架 | 长段落、复杂表格 |
| `ThreeTopicCards.tsx` | 三主题洞察页 | 3 个高信息密度 topic、策略/风险/行动组合 | 超过 3 个同级主题 |
| `ChartMetricBrief.tsx` | 图表 + 指标简报页 | 一个主图表、KPI、两条结论 callout | 多图表仪表盘 |
| `CountryComparison.tsx` | 主体对比页 | 中国、日本、韩国或其他主体的 KPI 和判断 | 无对比关系的单主体叙事 |
| `TimelineRoadmap.tsx` | 时间线 / 路线图页 | 阶段计划、里程碑、跨期推进路径 | 无时间顺序的分类 |
| `ClosingSummary.tsx` | 收束总结页 | 关键数字、最终判断、行动建议 | 新增复杂论证 |

## 核心约定

- `blueprints/*.tsx`：可复制的基础页，提供起始架构、schema、metadata 和 `sampleData`。
- `slides/*.tsx`：具体 deck 的最终页面，Agent 可以直接修改。
- `data/*.json`：只承载内容数据，不承载页面结构决策。
- `components/*.tsx`：多页复用的稳定视觉单元。

## 蓝图 TSX 应包含

- `Schema`：页面数据校验结构。
- `layoutId`：稳定的蓝图 id。
- `layoutName`、`layoutDescription`：页面职责说明。
- `layoutTags`、`layoutRole`、`contentElements`：目录和发现用 metadata。
- `useCases`、`suitableFor`、`avoidFor`：给 Agent 的选型提示。
- `density`、`visualWeight`、`editableTextPriority`：默认密度和导出优先级。
- `sampleData`：可渲染、可预览、能代表页面真实容量的默认数据。
- 默认导出的 React 组件：实际可复制和修改的页面实现。

## 使用方式

1. 从 `catalog.json` 找到最接近的蓝图基础页。
2. 复制对应 `blueprints/*.tsx` 到 `slides/*.tsx`，或在现有 slide 上派生修改。
3. 在 slide 文件里直接调整布局、组件组合、字段映射和默认文案。
4. 更新 `manifest.json`，让 `source.path` 指向最终的 `slides/*.tsx`。
5. 只在内容变化时修改 `data/*.json`。

如果页面出现越界、重叠、图表空白、卡片数量不匹配或组件不适合，不要试图通过 JSON 绕过去；应直接修改 `slides/*.tsx`。

## 维护规则

- 新增生产页时，同步更新 `catalog.json`、`group.json`、`manifest.json` 和对应 preview data。
- 移除生产页时，确保它不再被 slide entry、manifest、catalog 或 preview group 引用。
- 改默认内容时，同步 `Schema`、`sampleData` 和 demo JSON，避免预览与实际渲染不一致。
- 卡片数量、网格列数、图表布局等结构性决策属于 TSX，不属于 JSON。
- 共享视觉变化优先沉淀到 `components/*.tsx`，单页差异留在对应 slide。
