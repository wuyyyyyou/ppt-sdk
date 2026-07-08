# Chart Analytics Canvas 蓝图说明

`chart-analytics-canvas` 是 component-first / canvas-first 的深色分析图表模板组。它保留 `the original Dark Analytics Charts template` 的视觉语言、主题 token 和组件能力，但故意不复制 v1 的具体业务页面蓝图。

## Agent 阅读顺序

1. 先读 `../catalog.json`，按页面意图选择大方向 canvas。
2. 必须读 `../components/README.md`，理解可复用组件、slot 类型、文本容量和导出边界。
3. 再读对应的 `./*.tsx`，派生到 `../slides/*.tsx` 并替换 slot guide。
4. 内容数据放在 `../data/demo/*.json` 或实际 deck JSON 中；结构、组件选择和布局归 `slides/*.tsx`。

## 核心约定

- Canvas blueprint 是品牌框架，不是最终页面答案。
- `group.json.layouts` 和 `manifest.json` 只引用 `slides/*.tsx`。
- 普通内容页优先从 `ContentCanvas` 派生。
- 对比页优先从 `ComparisonCanvas` 派生。
- 主图表、证据、时间线或单图页面优先从 `ChartEvidenceCanvas` 派生。
- 不要把 source HTML 或 `the original Dark Analytics Charts template` 的具体行业页面硬塞进 canvas。
