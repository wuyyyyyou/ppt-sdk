# Red Finance Canvas 蓝图说明

`red-finance-canvas` 是组件优先的红色金融画布模板组。它故意不提供完整成品页蓝图，只提供封面、普通内容页和章节聚焦页三类可复制起始画布。

## Agent 阅读顺序

1. 先读 `../catalog.json`，确认当前页面应使用哪类 canvas。
2. 必须读 `../components/README.md`，理解所有可用组件、slot 类型、文本容量和组合边界。
3. 再读对应的 `./*.tsx`，把它复制或派生到 `../slides/*.tsx`，并把 slot guide 替换为真实组件组合。
4. 如果需要复用视觉密度，可以参考 `red-finance-v3/reference-slides`，但不要复制成品页结构。

## 核心约定

- Canvas blueprint 是品牌框架，不是最终页面答案。
- 最终页面必须落在 `../slides/*.tsx`，并由 `manifest.json` 引用。
- 普通内容页优先从 `blueprints/ContentCanvas.tsx` 派生。
- 章节页优先从 `blueprints/SectionFocusCanvas.tsx` 派生。
- 封面页优先从 `blueprints/CoverCanvas.tsx` 派生。
- 每页都应根据 page plan、受众、证据类型和内容密度重新选择组件组合。

如果页面看起来只是把 canvas 或其他成品蓝图换了文案，说明没有完成本模板组的目标。
