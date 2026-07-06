# Chart analytics canvas 主题 token

本模板复用 `chart-analytics-v1` 的 analytics-native 语义 token。token 名称描述的是分析报告里的视觉角色，而不是固定品牌色板。

`chart-analytics-canvas` 与 `chart-analytics-v1` 的组件体系保持一致；区别在于 canvas 蓝图更开放，会给 AI Agent 留出大块 slot guide 来组合组件。slot guide、占位边框、暗色 callout 和装饰环都复用现有 analytics-native token，不新增 canvas-only token。

## 颜色 token

- `canvas`, `surface`, `card`：页面底色、安静的页面承载面、重复卡片背景。
- `textPrimary`, `textMuted`, `textSubtle`, `textInverse`：浅色卡片和强填充区域上的前景层级。
- `stroke`, `strokeSoft`, `grid`：常规边框、弱分隔线、图表网格线。
- `darkCanvas`, `darkPanel`, `darkText`, `darkMutedText`, `darkBorder`, `darkCallout`：暗色分析面板、封面/结尾背景、暗色 callout 表面。
- `signalPrimary`, `signalSecondary`, `signalTertiary`：主要分析强调色，用于 KPI 卡片、图表系列、slot guide、徽标和图标标记。
- `signalRisk`, `signalWarning`, `signalSuccess`, `signalNeutral`：风险、警示、成功/进度、中性对比等分析状态色。
- 每组 `signal*Tint` 和 `signal*Border` 是对应 signal 的低强调背景色和边框色。
- `entityPrimary`, `entitySecondary`：当数据没有显式 legacy 颜色覆盖时，两个对比实体使用的 fallback 颜色。
- `entityPrimaryTint`, `entityPrimaryBorder`, `entitySecondaryTint`, `entitySecondaryBorder`：实体色对应的可见浅底和边框。
- `chart1` 到 `chart6`：通用图表系列 fallback 色板。时间线节点也按索引复用这组色板。
- `chartStructureSegment1` 到 `chartStructureSegment3`：结构图、组成图、donut 图专用分段颜色。

## 阴影 token

- `card`：重复 KPI 卡片或 insight 卡片阴影。
- `panel`：较大的图表面板或媒体面板阴影。
- `darkPanel`：暗色抬升面板阴影。
- `soft`：小型图例、页脚或浅色浮层阴影。

## 预设

- `token.default.json`：中性的蓝/青分析色板，匹配原 chart analytics 设计语言。
- `token.executive-amber.json`：更温暖的 executive report 变体，保持相同语义契约。

## 本地主题文件

源模板不提交 `theme/token.json`。工作区或本地测试如果需要覆盖主题，应从 `token.default.json` 复制生成 `theme/token.json`，该文件由 `.gitignore` 排除。
